/**
 * DB + GPT 하이브리드 검색 시스템
 * 
 * 검색 흐름:
 * 1️⃣ DB 우선 검색 (빠른 응답, 높은 신뢰도)
 * 2️⃣ DB에 없으면 GPT 보완 검색 (완전한 커버리지)
 * 3️⃣ 결과 통합 & 출처 명시
 */

import { searchSurgeryWithGPT } from './gpt-search'
import { searchAllInsuranceCompanies, convertToDBFormat } from './realtime-insurance-search'

export interface HybridSearchResult {
  success: boolean
  results: Array<{
    // 수술 기본 정보
    code: string
    name: string
    description?: string
    
    // 데이터 출처
    dataSource: 'database' | 'gpt' | 'hybrid'
    dbConfidence: 'high' | 'medium' | 'low' | 'none'
    
    // 수술 정보
    surgery?: any
    
    // 보험 특약 정보
    typeBenefits?: any[]
    nBenefits?: any[]
    risk?: any
    
    // GPT 생성 정보 (참고용)
    gptSummary?: string
    consultingPoints?: string
    
    // 메타데이터
    hasData: boolean
    lastUpdated?: string
    warning?: string
  }>
  
  // 검색 통계
  stats: {
    totalResults: number
    fromDB: number
    fromGPT: number
    searchTime: number
  }
  
  // 전체 요약
  summary?: string
  error?: string
}

/**
 * 하이브리드 검색 메인 함수
 */
export async function hybridSearch(
  query: string,
  db: D1Database | undefined,
  openaiApiKey: string,
  perplexityApiKey?: string
): Promise<HybridSearchResult> {
  const startTime = Date.now()
  
  console.log(`🔍 하이브리드 검색 시작: "${query}"`)
  
  try {
    // ========================================
    // 1️⃣ DB 우선 검색 (로컬 데이터)
    // ========================================
    console.log(`📊 1단계: DB 검색 중...`)
    const dbResults = await searchInDatabase(query, db)
    
    const dbResultsWithData = dbResults.filter(r => r.hasData)
    console.log(`✅ DB 검색 완료: ${dbResultsWithData.length}개 발견`)
    
    // DB에서 충분한 결과를 찾으면 즉시 반환
    if (dbResultsWithData.length >= 3) {
      const searchTime = Date.now() - startTime
      console.log(`⚡ DB에서 충분한 결과 발견, GPT 생략 (${searchTime}ms)`)
      
      return {
        success: true,
        results: dbResults,
        stats: {
          totalResults: dbResults.length,
          fromDB: dbResults.length,
          fromGPT: 0,
          searchTime
        },
        summary: `DB에서 ${dbResults.length}개의 수술 정보를 찾았습니다.`
      }
    }
    
    // ========================================
    // 2️⃣ Perplexity + GPT 보완 검색 (DB에 없는 경우)
    // ========================================
    console.log(`🤖 2단계: Perplexity + GPT 보완 검색 중...`)
    const gptResult = await searchSurgeryWithGPT(query, openaiApiKey, perplexityApiKey)
    
    if (!gptResult.success || !gptResult.results) {
      console.log(`❌ GPT 검색 실패, DB 결과만 반환`)
      const searchTime = Date.now() - startTime
      
      return {
        success: true,
        results: dbResults,
        stats: {
          totalResults: dbResults.length,
          fromDB: dbResults.length,
          fromGPT: 0,
          searchTime
        },
        summary: gptResult.error || 'GPT 검색에 실패했습니다.',
        error: gptResult.error
      }
    }
    
    console.log(`✅ GPT 검색 완료: ${gptResult.results.length}개 후보 발견`)
    
    // ========================================
    // 3️⃣ GPT 결과 보강 (보험사 정보 추가)
    // ========================================
    console.log(`💼 3단계: GPT 결과에 보험사 정보 추가 중...`)
    const enrichedGPTResults = await enrichGPTResults(
      gptResult.results,
      db,
      openaiApiKey,
      dbResults // DB에서 이미 찾은 것은 제외
    )
    
    console.log(`✅ 보강 완료: ${enrichedGPTResults.length}개 추가 결과`)
    
    // ========================================
    // 4️⃣ 결과 통합 및 중복 제거
    // ========================================
    const allResults = [...dbResults, ...enrichedGPTResults]
    const uniqueResults = deduplicateResults(allResults)
    
    // DB 결과를 앞에 배치 (높은 신뢰도)
    uniqueResults.sort((a, b) => {
      const scoreA = getConfidenceScore(a)
      const scoreB = getConfidenceScore(b)
      return scoreB - scoreA
    })
    
    const searchTime = Date.now() - startTime
    console.log(`🎯 검색 완료: 총 ${uniqueResults.length}개 (DB: ${dbResultsWithData.length}, GPT: ${enrichedGPTResults.length}, ${searchTime}ms)`)
    
    return {
      success: true,
      results: uniqueResults,
      stats: {
        totalResults: uniqueResults.length,
        fromDB: dbResultsWithData.length,
        fromGPT: enrichedGPTResults.length,
        searchTime
      },
      summary: gptResult.answer || `총 ${uniqueResults.length}개의 수술 정보를 찾았습니다.`
    }
    
  } catch (error) {
    console.error('❌ 하이브리드 검색 오류:', error)
    
    return {
      success: false,
      results: [],
      stats: {
        totalResults: 0,
        fromDB: 0,
        fromGPT: 0,
        searchTime: Date.now() - startTime
      },
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * DB에서 수술 검색
 */
async function searchInDatabase(
  query: string,
  db: D1Database | undefined
): Promise<HybridSearchResult['results']> {
  // DB가 없으면 빈 배열 반환
  if (!db) {
    console.log(`⚠️ DB가 없어서 검색 생략`)
    return []
  }
  
  try {
    // 수술 기본 정보 검색
    const { results: surgeries } = await db.prepare(`
      SELECT id, name, name_en, edi_code, kcd_code, 
             medical_classification, difficulty_level, description,
             updated_at
      FROM surgeries
      WHERE name LIKE ? OR edi_code LIKE ? OR kcd_code LIKE ? OR description LIKE ?
      ORDER BY 
        CASE 
          WHEN name = ? THEN 1
          WHEN name LIKE ? THEN 2
          WHEN edi_code = ? THEN 3
          ELSE 4
        END,
        name
      LIMIT 10
    `).bind(
      `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`,
      query, `${query}%`, query
    ).all()
    
    if (!surgeries || surgeries.length === 0) {
      return []
    }
    
    // 각 수술에 대한 보험 정보 조회
    const enrichedResults = []
    
    for (const surgery of surgeries) {
      try {
        // 1-5종 특약 조회
        const { results: typeBenefits } = await db.prepare(`
          SELECT 
            ic.name as company_name,
            ic.code as company_code,
            stb.benefit_name,
            stb.surgery_type,
            stb.benefit_amount,
            stb.benefit_conditions
          FROM surgery_type_benefits stb
          JOIN insurance_companies ic ON stb.insurance_company_id = ic.id
          WHERE stb.surgery_id = ?
          ORDER BY ic.name
        `).bind(surgery.id).all()
        
        // N대 특약 조회
        const { results: nBenefits } = await db.prepare(`
          SELECT 
            ic.name as company_name,
            ic.code as company_code,
            nsb.total_n,
            nsb.benefit_structure,
            nsd.is_covered,
            nsd.sub_category,
            nsd.benefit_amount,
            nsd.notes
          FROM n_surgery_details nsd
          JOIN n_surgery_benefits nsb ON nsd.n_benefit_id = nsb.id
          JOIN insurance_companies ic ON nsb.insurance_company_id = ic.id
          WHERE nsd.surgery_id = ?
          ORDER BY ic.name
        `).bind(surgery.id).all()
        
        // 리스크 정보 조회
        const risk = await db.prepare(`
          SELECT * FROM surgery_risks WHERE surgery_id = ?
        `).bind(surgery.id).first()
        
        const hasData = typeBenefits.length > 0 || nBenefits.length > 0
        
        enrichedResults.push({
          code: surgery.edi_code,
          name: surgery.name,
          description: surgery.description,
          dataSource: 'database' as const,
          dbConfidence: hasData ? 'high' : 'medium',
          surgery,
          typeBenefits: typeBenefits || [],
          nBenefits: nBenefits || [],
          risk: risk || undefined,
          hasData,
          lastUpdated: surgery.updated_at,
          warning: hasData ? undefined : '⚠️ 보험사 정보가 없습니다. 데이터베이스 업데이트가 필요합니다.'
        })
      } catch (error) {
        console.error(`Error enriching surgery ${surgery.id}:`, error)
        
        enrichedResults.push({
          code: surgery.edi_code,
          name: surgery.name,
          description: surgery.description,
          dataSource: 'database' as const,
          dbConfidence: 'low',
          surgery,
          hasData: false,
          warning: '⚠️ 데이터 조회 중 오류가 발생했습니다.'
        })
      }
    }
    
    return enrichedResults
    
  } catch (error) {
    console.error('DB search error:', error)
    return []
  }
}

/**
 * GPT 결과에 보험사 정보 추가
 */
async function enrichGPTResults(
  gptResults: Array<{ code: string; name: string; description?: string }>,
  db: D1Database | undefined,
  openaiApiKey: string,
  existingDBResults: HybridSearchResult['results']
): Promise<HybridSearchResult['results']> {
  const enriched = []
  
  // DB에서 이미 찾은 수술은 제외
  const existingCodes = new Set(existingDBResults.map(r => r.code))
  const newGPTResults = gptResults.filter(r => !existingCodes.has(r.code))
  
  console.log(`🔍 GPT 결과 ${gptResults.length}개 중 ${newGPTResults.length}개 신규 발견`)
  
  // 최대 5개만 처리 (비용 절감)
  const limitedResults = newGPTResults.slice(0, 5)
  
  for (const item of limitedResults) {
    try {
      console.log(`🏥 GPT 결과 보강: ${item.name} (${item.code})`)
      
      // DB에 있는지 먼저 확인 (DB가 있을 경우만)
      if (db) {
        const existing = await db.prepare(`
          SELECT * FROM surgeries WHERE edi_code = ? OR name LIKE ?
        `).bind(item.code, `%${item.name}%`).first()
        
        if (existing) {
          console.log(`ℹ️ DB에 이미 존재, DB 결과로 대체: ${item.name}`)
          continue
        }
      }
      
      // 실시간 보험사 검색 (GPT 기반)
      console.log(`🔎 실시간 보험사 검색 중...`)
      const insuranceBenefits = await searchAllInsuranceCompanies(
        item.name,
        item.code,
        openaiApiKey
      )
      
      const { typeBenefits, nBenefits } = convertToDBFormat(insuranceBenefits)
      
      console.log(`✅ 보험사 검색 완료: 1-5종 ${typeBenefits.length}개, N대 ${nBenefits.length}개`)
      
      // 리스크 정보 추출
      const riskInfos = insuranceBenefits
        .filter(b => b.riskInfo)
        .map(b => b.riskInfo)
      
      const consultingPoints = insuranceBenefits
        .filter(b => b.consultingPoints)
        .map(b => `[${b.companyName}] ${b.consultingPoints}`)
        .join('\n\n')
      
      enriched.push({
        code: item.code,
        name: item.name,
        description: item.description,
        dataSource: 'gpt' as const,
        dbConfidence: 'low',
        surgery: {
          name: item.name,
          edi_code: item.code,
          description: item.description
        },
        typeBenefits,
        nBenefits,
        risk: riskInfos.length > 0 ? {
          recurrence_risk: riskInfos[0],
          insurance_notes: insuranceBenefits
            .filter(b => b.notes)
            .map(b => `${b.companyName}: ${b.notes}`)
            .join('\n')
        } : undefined,
        gptSummary: item.description,
        consultingPoints,
        hasData: typeBenefits.length > 0 || nBenefits.length > 0,
        lastUpdated: new Date().toISOString(),
        warning: '⚠️ GPT 기반 실시간 검색 결과입니다. 참고용으로만 사용하세요.'
      })
      
    } catch (error) {
      console.error(`Error enriching GPT result ${item.name}:`, error)
      
      enriched.push({
        code: item.code,
        name: item.name,
        description: item.description,
        dataSource: 'gpt' as const,
        dbConfidence: 'none',
        hasData: false,
        warning: '⚠️ GPT 검색 결과이나 보험사 정보를 가져오지 못했습니다.'
      })
    }
  }
  
  return enriched
}

/**
 * 결과 중복 제거
 */
function deduplicateResults(
  results: HybridSearchResult['results']
): HybridSearchResult['results'] {
  const seen = new Map<string, HybridSearchResult['results'][0]>()
  
  for (const result of results) {
    const key = result.code || result.name
    
    if (!seen.has(key)) {
      seen.set(key, result)
    } else {
      // 이미 있으면 신뢰도가 높은 것을 선택
      const existing = seen.get(key)!
      if (getConfidenceScore(result) > getConfidenceScore(existing)) {
        seen.set(key, result)
      }
    }
  }
  
  return Array.from(seen.values())
}

/**
 * 신뢰도 점수 계산
 */
function getConfidenceScore(result: HybridSearchResult['results'][0]): number {
  let score = 0
  
  // 데이터 출처
  if (result.dataSource === 'database') score += 100
  else if (result.dataSource === 'gpt') score += 50
  
  // DB 신뢰도
  if (result.dbConfidence === 'high') score += 30
  else if (result.dbConfidence === 'medium') score += 20
  else if (result.dbConfidence === 'low') score += 10
  
  // 데이터 완전성
  if (result.hasData) score += 20
  if (result.typeBenefits && result.typeBenefits.length > 0) score += 15
  if (result.nBenefits && result.nBenefits.length > 0) score += 15
  if (result.risk) score += 10
  
  return score
}
