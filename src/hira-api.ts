/**
 * 건강보험심사평가원 공공데이터 API 연동
 * https://www.data.go.kr/data/15021028/openapi.do
 */

interface HIRASurgeryItem {
  의료수가코드: string
  의료수가코드명: string
  의료수가분류번호: string
  적용일자시작: string
  적용일자종료: string
  급여구분: string
  상대가치점수: string
}

interface HIRAAPIResponse {
  response: {
    header: {
      resultCode: string
      resultMsg: string
    }
    body: {
      items: {
        item: HIRASurgeryItem[]
      }
      numOfRows: number
      pageNo: number
      totalCount: number
    }
  }
}

/**
 * 건강보험심사평가원 API에서 수술 코드 조회
 */
export async function fetchSurgeryCodesFromHIRA(
  serviceKey: string,
  pageNo: number = 1,
  numOfRows: number = 1000
): Promise<HIRASurgeryItem[]> {
  const baseUrl = 'http://apis.data.go.kr/B551182/MdclExpnItmInfoService'
  const endpoint = `${baseUrl}/getMdclExpnItmList`

  // URL 파라미터 구성
  const params = new URLSearchParams({
    serviceKey: serviceKey,
    pageNo: pageNo.toString(),
    numOfRows: numOfRows.toString(),
    _type: 'json'
  })

  try {
    const response = await fetch(`${endpoint}?${params}`)
    
    if (!response.ok) {
      throw new Error(`HIRA API 요청 실패: ${response.status} ${response.statusText}`)
    }

    const data: HIRAAPIResponse = await response.json()

    // 응답 에러 체크
    if (data.response.header.resultCode !== '00') {
      throw new Error(`HIRA API 에러: ${data.response.header.resultMsg}`)
    }

    // 아이템이 없으면 빈 배열 반환
    if (!data.response.body.items || !data.response.body.items.item) {
      return []
    }

    return Array.isArray(data.response.body.items.item) 
      ? data.response.body.items.item 
      : [data.response.body.items.item]
      
  } catch (error) {
    console.error('HIRA API 호출 실패:', error)
    throw error
  }
}

/**
 * 전체 수술 코드 데이터 수집 (페이징 처리)
 */
export async function fetchAllSurgeryCodes(serviceKey: string): Promise<HIRASurgeryItem[]> {
  const allItems: HIRASurgeryItem[] = []
  let pageNo = 1
  const numOfRows = 1000
  let hasMore = true

  console.log('HIRA API에서 수술 코드 수집 시작...')

  while (hasMore) {
    try {
      console.log(`페이지 ${pageNo} 조회 중...`)
      const items = await fetchSurgeryCodesFromHIRA(serviceKey, pageNo, numOfRows)
      
      if (items.length === 0) {
        hasMore = false
        break
      }

      allItems.push(...items)
      console.log(`페이지 ${pageNo}: ${items.length}개 수집 (누적: ${allItems.length}개)`)

      // 마지막 페이지인지 확인
      if (items.length < numOfRows) {
        hasMore = false
      } else {
        pageNo++
        // API 호출 제한을 고려해 1초 대기
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`페이지 ${pageNo} 조회 실패:`, error)
      hasMore = false
    }
  }

  console.log(`총 ${allItems.length}개의 수술 코드 수집 완료`)
  return allItems
}

/**
 * 수술 코드 검색 (이름으로)
 */
export async function searchSurgeryByName(
  serviceKey: string,
  searchTerm: string
): Promise<HIRASurgeryItem[]> {
  // 먼저 1페이지만 가져와서 검색
  const items = await fetchSurgeryCodesFromHIRA(serviceKey, 1, 100)
  
  // 클라이언트 사이드 필터링
  return items.filter(item => 
    item.의료수가코드명.includes(searchTerm) ||
    item.의료수가코드.includes(searchTerm)
  )
}

/**
 * D1 데이터베이스에 수술 데이터 저장
 */
export async function saveSurgeryToDB(
  db: D1Database,
  items: HIRASurgeryItem[]
): Promise<number> {
  let savedCount = 0

  for (const item of items) {
    try {
      // 수술 코드가 이미 존재하는지 확인
      const existing = await db.prepare(`
        SELECT id FROM surgeries WHERE edi_code = ?
      `).bind(item.의료수가코드).first()

      if (!existing) {
        // 신규 데이터 삽입
        await db.prepare(`
          INSERT INTO surgeries (
            name, 
            name_en, 
            edi_code, 
            medical_classification, 
            description
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          item.의료수가코드명,
          '', // 영문명은 나중에 추가
          item.의료수가코드,
          item.의료수가분류번호,
          `급여구분: ${item.급여구분}, 상대가치점수: ${item.상대가치점수}`
        ).run()

        savedCount++
      }
    } catch (error) {
      console.error(`수술 코드 ${item.의료수가코드} 저장 실패:`, error)
    }
  }

  console.log(`${savedCount}개의 새로운 수술 코드가 데이터베이스에 저장되었습니다.`)
  return savedCount
}

/**
 * HIRA API에서 데이터를 가져와 DB에 저장하는 통합 함수
 */
export async function syncSurgeryDataFromHIRA(
  serviceKey: string,
  db: D1Database
): Promise<{ total: number; saved: number }> {
  console.log('HIRA API 동기화 시작...')
  
  // 전체 데이터 수집
  const allItems = await fetchAllSurgeryCodes(serviceKey)
  
  // DB에 저장
  const savedCount = await saveSurgeryToDB(db, allItems)
  
  return {
    total: allItems.length,
    saved: savedCount
  }
}
