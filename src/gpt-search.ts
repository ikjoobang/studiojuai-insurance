/**
 * Perplexity + GPT 기반 수술 코드 검색 시스템
 * 로컬 보험 데이터 우선 검색 → Perplexity 웹 검색 → GPT 분석
 */

import OpenAI from 'openai'
import insuranceData from './insurance-data.json'

/**
 * Perplexity 실시간 웹 검색
 */
async function searchWithPerplexity(
  query: string,
  perplexityApiKey: string
): Promise<string> {
  try {
    console.log('🔍 Perplexity 웹 검색 시작:', query)
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: '당신은 한국 보험 전문 검색 어시스턴트입니다. 실시간 웹 검색으로 정확한 보험 정보를 찾아 제공합니다.'
          },
          {
            role: 'user',
            content: `"${query}"에 대한 다음 정보를 실시간 웹 검색으로 찾아주세요:

1. ICD-10 진단코드 (예: H25.9)
2. 1-5종 수술 분류
3. 2025년 현재 주요 보험사별 보장 한도:
   - 삼성화재 111대 수술비
   - 현대해상 119대 수술비
   - DB손보 119대 수술비
   - 메리츠화재 119대 수술비
   - 농협손보 144대 수술비
   - KB손보 112대 수술비
   - 한화손보
   - 롯데손보
   - 흥국화재
   - MG손보
   - 동부손보

각 보험사의 공식 웹사이트, 약관 PDF, 상품 안내 페이지를 검색해서 정확한 금액을 찾아주세요.`
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      throw new Error(`Perplexity API 오류: ${response.status}`)
    }

    const data = await response.json()
    const searchResult = data.choices[0]?.message?.content || ''
    
    console.log('✅ Perplexity 검색 완료, 길이:', searchResult.length)
    console.log('📄 검색 결과 미리보기:', searchResult.substring(0, 300))
    
    return searchResult
  } catch (error) {
    console.error('❌ Perplexity 검색 실패:', error)
    return '' // 실패시 빈 문자열 반환
  }
}

/**
 * 하이브리드 검색: D1 저장 데이터 우선 → Perplexity 웹 검색 → GPT 분석
 */
export async function searchSurgeryWithGPT(
  query: string,
  openaiApiKey: string,
  perplexityApiKey?: string,
  db?: D1Database
): Promise<{
  success: boolean
  results?: Array<{
    code: string
    name: string
    description?: string
  }>
  answer?: string
  error?: string
  source?: 'database' | 'gpt' | 'perplexity'
}> {
  try {
    // 1단계: D1 데이터베이스에서 저장된 데이터 확인
    if (db) {
      try {
        const { results } = await db.prepare(`
          SELECT 
            company_name,
            coverage_amount,
            coverage_options,
            coverage_type,
            source_url,
            notes,
            verified,
            updated_at
          FROM insurance_coverage
          WHERE surgery_name = ?
          ORDER BY company_name
        `).bind(query).all()

        // D1에 데이터가 있으면 즉시 반환 (빠르고 정확함)
        if (results && results.length > 0) {
          const answer = formatDatabaseResults(query, results)
          return {
            success: true,
            answer,
            source: 'database',
            results: []
          }
        }
      } catch (dbError) {
        console.error('D1 query error:', dbError)
        // D1 에러는 무시하고 GPT로 진행
      }
    }

    // 2단계: Perplexity로 실시간 웹 검색
    let webSearchResults = ''
    if (perplexityApiKey) {
      webSearchResults = await searchWithPerplexity(query, perplexityApiKey)
    }

    // 3단계: GPT로 최종 분석
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    // 제공된 보험 데이터를 문자열로 변환
    const insuranceDataStr = JSON.stringify(insuranceData, null, 2)

    // Perplexity 웹 검색 결과 기반 프롬프트
    const prompt = `
### 🔍 실시간 웹 검색 결과 기반 분석

당신은 국내 보험 전문가입니다. **아래 실시간 웹 검색 결과**를 바탕으로 정확하게 답변하세요.

### 사용자 검색어: "${query}"

### 📊 실시간 웹 검색 결과 (Perplexity):
${webSearchResults || '웹 검색 결과 없음 - 일반 지식 기반 답변'}

### ⚠️ 할루시네이션 절대 금지!
- 추측 금지: "가입금액×?%" 같은 표현 사용 금지
- 웹 검색 결과 우선: 위 검색 결과에 있는 정보를 최우선으로 사용
- 모르면 정직하게: 확실하지 않으면 "약관 확인 필요" 명시
- ICD-10 코드: 정확한 의학 진단 코드 사용

### 실제 약관 참고 데이터 (2024-2025 기준)

**1-5종 수술비 분류 (손해보험사 공통):**
- 1종: 호흡기/눈구 등 (예: 백내장, 편도수술) - 일반적으로 50만~200만원
- 2종: 피부/유방 등 - 일반적으로 100만~300만원  
- 3종: 상기 이외 개복술 (예: 맹장수술, 담낭수술) - 일반적으로 200만~500만원
- 4종: 호흡기/흉부/복강 내 주요 수술 - 일반적으로 300만~1,000만원
- 5종: 개두/개심/장기이식 등 (예: 심장수술, 뇌수술) - 일반적으로 500만~2,000만원

**실제 보험사 보장 한도 참고치 (약관마다 상이):**
- 삼성화재 111대: 1-5종 각 종별 보장 (플랜별 상이)
- 현대해상 119대: 기본형/확대형 선택 가능
- DB손보 119대: 3단계 또는 5단계 선택
- 메리츠 119대: 기본/확대 2단계
- 농협손보 144대: 5단계 세부 선택

### STEP 1: ICD-10 코드 + 수술명 정확성 검증 (웹 검색 필수)

**필수 웹 검색 실행:**
1. "${query} ICD-10 코드"
2. "${query} 건강보험 수가 EDI 코드"
3. "${query} 의학적 분류"
4. "${query} 1-5종 수술 분류"
5. "${query} 수술 난이도"

**검증 항목:**
- ✅ ICD-10 코드 (예: H25.9 백내장, I21 심근경색)
- ✅ 정확한 한글/영문 명칭
- ✅ EDI 수가코드 (있는 경우)
- ✅ 1-5종 분류 (손해보험 기준)
- ✅ 의학적 정의 및 동의어

**웹 검색 결과 예시:**
- 백내장 = H25 (ICD-10) = 1종 수술
- 심근경색 = I21 (ICD-10) = 5종 수술  
- 맹장수술 = 충수돌기절제술 = K35 (ICD-10) = 3종 수술

### STEP 2: 실제 보험사 약관 한도 검색 (웹 검색 필수)

**검색 대상 보험사 (11개):**
1. 삼성화재 - 111대 수술비 특약
2. 현대해상 - 119대 수술비 특약
3. DB손보 - 119대 수술비 특약
4. KB손보 - 112대 수술비 특약
5. 농협손보 - 144대 수술비 특약
6. 한화손보 - 124대 수술비 특약
7. 메리츠화재 - 119대 수술비 특약
8. 동부손보 - 119대 수술비 특약
9. 롯데손보 - 112대 수술비 특약
10. 흥국화재 - 112대 수술비 특약
11. MG손보 - 119대 수술비 특약

### 🔍 필수 웹 검색 키워드 (각 보험사별로):

#### 1-5종 수술비 특약 한도 검색:
- "[보험사명] 1-5종 수술비 특약 보장한도"
- "[보험사명] [수술명] 수술비 보장금액"
- "[보험사명] 1종 2종 3종 4종 5종 수술비 최대 한도"
- "[보험사명] 수술비 특약 가입금액 선택한도"
- "[보험사명] 건강보험 수술비 특약 상품 설명서"

#### N대 수술비 특약 한도 검색:
- "[보험사명] 111대/119대/112대/144대/124대 수술비 최대 한도"
- "[보험사명] 27대 질병수술비 보장금액"
- "[보험사명] N대 수술비 약관 한도"
- "[보험사명] 고액 수술비 보장 한도"

#### 생명보험사 질병/만성질환 담보 검색 (해당 시):
- "[생명보험사명] 고혈압 진단비 보장한도"
- "[생명보험사명] 당뇨 약물치료비 최대 금액"
- "[생명보험사명] 3대 만성질환 보장한도"
- "한화생명 The H 고혈압 진단 20만원 수술 1,000만원"
- "라이나생명 고고당 5,000만원 보장"

### 💡 한도 금액 표현 가이드:
1. **구체적 금액 우선**: "500만원", "1,000만원", "최대 3,000만원"
2. **선택 범위 표시**: "500만원 ~ 3,000만원 (5단계)"
3. **기본/업그레이드 구분**: "기본 500만원, 업그레이드 1,000만원"
4. **플랜별 차이**: "실속형 500만원 / 든든형 1,000만원"
5. **조건부 표시**: "자기부담금 10만원 조건 시 최대 2,000만원"

### ⚠️ 금액을 못 찾은 경우에만:
- "약관별 상이 (설계서 확인 필요)"
- "가입 시 선택 (일반적으로 500만~3,000만원)"

## 출력 형식 (마크다운 표 형식 필수)

### 1단계 검증 결과
\`\`\`
수술 정보 검증 완료 (웹 검색 확인)
- 입력값: [사용자가 입력한 값]
- 정확한 명칭: [웹 검색 확인된 표준명]
- 수술코드: [EDI/ICD-10 코드]
- 의학적 분류: [상세 분류]
- 난이도: [1-5종]
- 특이사항: [동의어, 주의사항]
\`\`\`

### 보험사별 1-5종 수술비 특약 보장 현황 (실제 한도 금액)
\`\`\`
┌────────────────────────────────────────────────────────────────────────────────┐
│ 보험사명 │ 특약명      │ 해당종류 │ 실제 보장한도 (약관상 명시)    │ 비고        │
├────────────────────────────────────────────────────────────────────────────────┤
│ KB손보   │ 1-5종수술비 │ ?종수술  │ 최대 ?만원 (선택: ?만/?만)     │ 급여기준    │
│ DB손보   │ 1-5종수술비 │ ?종수술  │ ?만원~?만원 (?단계 선택)       │ 급여기준    │
│ 메리츠   │ 1-5종수술비 │ ?종수술  │ 기본 ?만원 / 확대 ?만원        │ 급여기준    │
│ 롯데손보 │ 1-5종수술비 │ ?종수술  │ ?만원~?만원                    │ 급여기준    │
│ 삼성화재 │ 1-5종수술비 │ ?종수술  │ 최대 ?만원 (플랜별 상이)       │ 급여기준    │
│ 농협손보 │ 1-5종수술비 │ ?종수술  │ ?만원~?만원                    │ 급여기준    │
│ 현대해상 │ 1-5종수술비 │ ?종수술  │ 기본 ?만원 / 업그레이드 ?만원  │ 급여기준    │
│ 한화손보 │ 1-5종수술비 │ ?종수술  │ ?만원~?만원                    │ 급여기준    │
│ 흥국화재 │ 1-5종수술비 │ ?종수술  │ 최대 ?만원                     │ 급여기준    │
│ MG손보   │ 1-5종수술비 │ ?종수술  │ ?만원~?만원 (선택형)           │ 급여기준    │
│ 동부손보 │ 1-5종수술비 │ ?종수술  │ 기본 ?만원                     │ 급여기준    │
└────────────────────────────────────────────────────────────────────────────────┘
* 웹 검색으로 찾은 실제 약관상 한도 금액을 반드시 기입할 것!
* "가입금액×?%" 같은 추정치 사용 금지!
\`\`\`

### N대 수술비 특약 세부등급 보장 현황 (실제 한도 금액)
\`\`\`
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 보험사명 │ N대특약명   │ 전체구성         │ 보장여부 │ 세부등급     │ 실제 한도 금액    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ 삼성화재 │ 111대수술비 │ 27+11+46+24+3   │ 포함     │ ?대수술비    │ 최대 ?만원        │
│ 현대해상 │ 119대수술비 │ 27+11+59+19+3   │ 포함     │ ?대수술비    │ ?만원~?만원       │
│ DB손보   │ 119대수술비 │ 27+11+59+19+3   │ 포함     │ ?대수술비    │ 기본 ?만원        │
│ KB손보   │ 112대수술비 │ 27+11+53+18+3   │ 포함     │ ?대수술비    │ ?만원~?만원       │
│ 농협손보 │ 144대수술비 │ 27+11+59+43+다빈도4│ 포함   │ ?대수술비    │ 최대 ?만원        │
│ 한화손보 │ 124대수술비 │ 27+11+64+19+3   │ 포함     │ ?대수술비    │ ?만원~?만원       │
│ 메리츠   │ 119대수술비 │ 27+11+59+19+3   │ 포함     │ ?대수술비    │ ?만원 (표준)      │
│ 동부손보 │ 119대수술비 │ 27+11+59+19+3   │ 포함     │ ?대수술비    │ 기본 ?만원        │
│ 롯데손보 │ 112대수술비 │ 27+11+53+18+3   │ 포함     │ ?대수술비    │ ?만원~?만원       │
│ 흥국화재 │ 112대수술비 │ 27+11+53+18+3   │ 포함     │ ?대수술비    │ 최대 ?만원        │
│ MG손보   │ 119대수술비 │ 27+11+59+19+3   │ 포함     │ ?대수술비    │ ?만원 (선택형)    │
└─────────────────────────────────────────────────────────────────────────────────────┘
* 웹 검색으로 찾은 실제 약관상 한도 금액을 반드시 기입할 것!
* 예: "500만원", "1,000만원~3,000만원", "최대 5,000만원" 등
\`\`\`

### 가능성 정보 (리스크 대비)
- 재발 가능성: [높음/보통/낮음 + 설명]
- 재수술 필요성: [가능성 및 이유]
- 합병증 위험: [주요 합병증]
- 보험 청구 주의사항: [보험사별 특이사항]

### 고객 상담 포인트 (구체적 금액 비교)
- 최고 보장: [보험사명 - 실제 금액] (예: 한화생명 - 최대 1,000만원)
- 최저 보장: [보험사명 - 실제 금액] (예: 흥국화재 - 기본 30만원)
- 1-5종 특약: [각 보험사별 몇 종 분류 + 실제 한도]
- N대 특약: [각 보험사별 실제 한도 금액 비교]

### 중요 유의사항
- 위 금액은 웹 검색 기준 (2025년 현재)
- 약관 변경 가능성 있으므로 최신 설계서 확인 필수
- 프로모션/회차에 따라 한도 변동 가능 (예: 신한 1,000만→500만)
- 자기부담금·면책·감액 조건 별도 확인 필요

### 🚨 최종 확인 (FACT_CHECK 필수)

**다음 항목을 웹 검색으로 재확인:**
1. ✅ ICD-10 코드 정확성 → FACT_CHECK("${query} ICD-10")
2. ✅ 1-5종 분류 정확성 → FACT_CHECK("${query} 수술 난이도 분류")
3. ✅ 각 보험사 실제 한도 → FACT_CHECK("[보험사명] ${query} 보장 한도")
4. ✅ 특약명 정확성 → FACT_CHECK("[보험사명] N대 수술비")

**출력 전 체크리스트:**
- [ ] 모든 정보가 웹 검색으로 확인되었는가?
- [ ] "가입금액×?%" 같은 추정치가 없는가?
- [ ] ICD-10 코드가 정확한가?
- [ ] 실제 보험사 약관 기반 금액인가?
- [ ] 모르는 정보는 "약관 확인 필요"로 표시했는가?

**🔥 절대 금지:**
❌ 추측하지 마세요
❌ 할루시네이션 금지
❌ 가입금액×% 표현 금지
❌ 확인되지 않은 정보 출력 금지

**✅ 반드시 실행:**
✓ 모든 정보 웹 검색 확인
✓ ICD-10 코드 실시간 검색
✓ 실제 약관 한도 금액 검색
✓ 못 찾으면 정직하게 "확인 필요" 표시
`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 국내 보험업계 수술비 특약 전문 분석가입니다. 보험설계사들이 고객에게 정확한 정보를 제공할 수 있도록 돕는 것이 주요 임무입니다. 한국어로 정확하고 전문적으로 답변하며, 반드시 표 형식을 지켜서 응답합니다. 반드시 웹 검색을 통해 정확한 정보를 확인하고, 11개 보험사 모두의 정보를 찾아서 정확히 작성합니다. 할루시네이션은 절대 금지입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    })

    const gptAnswer = response.choices[0]?.message?.content || ''
    
    console.log('✅ GPT 응답 받음, 길이:', gptAnswer.length)
    console.log('GPT 응답 샘플:', gptAnswer.substring(0, 500))

    // GPT 응답이 없으면 에러
    if (!gptAnswer || gptAnswer.trim().length === 0) {
      console.error('❌ GPT 응답이 비어있습니다')
      return {
        success: false,
        error: 'GPT 응답이 비어있습니다',
      }
    }

    // JSON 파싱 시도 (선택사항)
    try {
      const jsonMatch = gptAnswer.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('✅ JSON 파싱 성공')
        return {
          success: true,
          results: parsed.results || [],
          source: 'gpt',
          answer: parsed.summary || gptAnswer,
        }
      }
    } catch (e) {
      console.log('⚠️ JSON 파싱 실패, 텍스트로 반환')
    }

    // JSON이 아니면 텍스트 그대로 반환 (마크다운 표 포함)
    return {
      success: true,
      results: [],
      answer: gptAnswer,
      source: 'gpt',
    }
  } catch (error) {
    console.error('❌ GPT search error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * D1 데이터베이스 결과를 표 형식으로 포맷
 */
function formatDatabaseResults(surgeryName: string, results: any[]): string {
  const header = `# ${surgeryName} - 보험사별 보장 한도 (저장된 데이터)

아래 정보는 사용자가 검증하고 저장한 데이터입니다.

## 보험사별 보장 내역

| 보험사 | 보장 한도 | 선택 옵션 | 특약 유형 | 검증 여부 | 업데이트 |
|--------|----------|----------|----------|----------|----------|
`

  const rows = results.map((row: any) => {
    const verified = row.verified ? '✅ 검증됨' : '⚠️ 미검증'
    const options = row.coverage_options || '-'
    const type = row.coverage_type || '-'
    const updatedDate = row.updated_at ? new Date(row.updated_at).toLocaleDateString('ko-KR') : '-'
    
    return `| ${row.company_name} | ${row.coverage_amount} | ${options} | ${type} | ${verified} | ${updatedDate} |`
  }).join('\n')

  const footer = `

---

**데이터 출처**: 사용자 직접 입력 및 검증
**총 ${results.length}개 보험사 정보**

💡 **편집 기능**: 각 항목을 클릭하여 수정하거나 추가 정보를 입력할 수 있습니다.
`

  return header + rows + footer
}

/**
 * 고급 GPT 검색 (파일 기반)
 * 나중에 구현: OpenAI File Upload + Assistants API
 */
export async function searchSurgeryWithGPTAdvanced(
  query: string,
  openaiApiKey: string,
  fileId?: string
): Promise<any> {
  // TODO: Assistants API 구현
  // 1. 엑셀 파일을 OpenAI에 업로드
  // 2. Assistant 생성
  // 3. 파일을 참조해서 검색
  
  return searchSurgeryWithGPT(query, openaiApiKey)
}
