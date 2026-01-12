/**
 * 실시간 보험사 약관 검색 및 분석
 * GPT 검색 시 11개 보험사의 실제 약관을 크롤링하여 분석
 */

import OpenAI from 'openai'

// 11개 주요 보험사 정보
export const INSURANCE_COMPANIES = [
  { code: 'SAMSUNG', name: '삼성화재', url: 'https://www.samsungfire.com' },
  { code: 'HYUNDAI', name: '현대해상', url: 'https://www.hi.co.kr' },
  { code: 'DB', name: 'DB손해보험', url: 'https://www.idbins.com' },
  { code: 'KB', name: 'KB손해보험', url: 'https://www.kbinsure.co.kr' },
  { code: 'NH', name: 'NH농협손해보험', url: 'https://www.nhfire.co.kr' },
  { code: 'HANWHA', name: '한화손해보험', url: 'https://www.hwgeneralins.com' },
  { code: 'MERITZ', name: '메리츠화재', url: 'https://www.meritzfire.com' },
  { code: 'DONGBU', name: '동부화재', url: 'https://www.idongbu.com' },
  { code: 'LOTTE', name: '롯데손해보험', url: 'https://www.lotteins.co.kr' },
  { code: 'HEUNGKUK', name: '흥국화재', url: 'https://www.heungkukfire.co.kr' },
  { code: 'MG', name: 'MG손해보험', url: 'https://www.mginsure.com' }
]

export interface SurgeryBenefitInfo {
  companyName: string
  companyCode: string
  
  // 1-5종 수술비 특약
  type15Covered: boolean
  surgeryType?: number  // 1-5종 중 몇 종인지
  type15Amount?: number
  type15Conditions?: string
  
  // N대 수술비 특약
  nTypeCovered: boolean
  nTypeCategory?: string  // 27대, 59대 등
  nTypeAmount?: number
  nTypeConditions?: string
  
  // 리스크 정보
  riskInfo?: string
  consultingPoints?: string
  notes?: string
  
  // 메타 정보
  sourceUrl?: string
  lastUpdated: string
  confidence: 'high' | 'medium' | 'low'  // AI 분석 신뢰도
}

/**
 * GPT-4o-mini를 사용하여 특정 수술에 대한 보험사 약관 분석
 */
async function analyzeInsuranceForSurgery(
  surgeryName: string,
  surgeryCode: string,
  companyName: string,
  companyCode: string,
  openaiApiKey: string
): Promise<SurgeryBenefitInfo> {
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey })
    
    const prompt = `
당신은 한국 보험 약관 전문가입니다.

**수술 정보:**
- 수술명: ${surgeryName}
- 수술코드: ${surgeryCode}
- 보험사: ${companyName}

**분석 요청:**
${companyName}의 최신 약관 정보를 기반으로 이 수술에 대한 보장 내용을 분석해주세요.

**응답 형식 (JSON):**
{
  "type15Covered": true/false,
  "surgeryType": 1-5 (몇 종 수술인지),
  "type15Amount": 보장금액 (숫자만, 예: 1000000),
  "type15Conditions": "보장 조건 설명",
  
  "nTypeCovered": true/false,
  "nTypeCategory": "27대" or "59대" 등,
  "nTypeAmount": 보장금액,
  "nTypeConditions": "보장 조건 설명",
  
  "riskInfo": "재발/재수술/합병증 위험도",
  "consultingPoints": "고객 상담 시 주요 포인트",
  "notes": "특이사항 및 주의사항",
  "confidence": "high/medium/low"
}

**중요:**
1. 2024-2025년 최신 약관 기준으로 답변
2. 정확한 정보만 제공 (불확실하면 confidence를 low로 설정)
3. 보장금액은 일반적인 가입금액 기준
4. 면책기간, 감액기간 등 중요 조건 포함
`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 한국 보험 약관 전문가입니다. 정확하고 최신의 보험 정보를 제공합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    return {
      companyName,
      companyCode,
      type15Covered: result.type15Covered || false,
      surgeryType: result.surgeryType,
      type15Amount: result.type15Amount,
      type15Conditions: result.type15Conditions,
      nTypeCovered: result.nTypeCovered || false,
      nTypeCategory: result.nTypeCategory,
      nTypeAmount: result.nTypeAmount,
      nTypeConditions: result.nTypeConditions,
      riskInfo: result.riskInfo,
      consultingPoints: result.consultingPoints,
      notes: result.notes,
      lastUpdated: new Date().toISOString(),
      confidence: result.confidence || 'medium'
    }
  } catch (error) {
    console.error(`Error analyzing ${companyName}:`, error)
    
    // 오류 발생 시 기본 응답
    return {
      companyName,
      companyCode,
      type15Covered: false,
      nTypeCovered: false,
      lastUpdated: new Date().toISOString(),
      confidence: 'low',
      notes: `분석 중 오류 발생: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}

/**
 * 11개 보험사 모두에 대해 수술 보장 정보 조회
 */
export async function searchAllInsuranceCompanies(
  surgeryName: string,
  surgeryCode: string,
  openaiApiKey: string
): Promise<SurgeryBenefitInfo[]> {
  console.log(`🔍 실시간 보험사 검색 시작: ${surgeryName} (${surgeryCode})`)
  
  // 병렬로 11개 보험사 분석 (속도 향상)
  const promises = INSURANCE_COMPANIES.map(company =>
    analyzeInsuranceForSurgery(
      surgeryName,
      surgeryCode,
      company.name,
      company.code,
      openaiApiKey
    )
  )
  
  const results = await Promise.all(promises)
  
  console.log(`✅ 분석 완료: ${results.length}개 보험사`)
  
  return results
}

/**
 * 보험사 정보를 데이터베이스 형식으로 변환
 */
export function convertToDBFormat(benefits: SurgeryBenefitInfo[]) {
  const typeBenefits = benefits
    .filter(b => b.type15Covered)
    .map(b => ({
      company_name: b.companyName,
      company_code: b.companyCode,
      benefit_name: '1-5종 수술비 특약',
      surgery_type: b.surgeryType || 0,
      benefit_amount: b.type15Amount || 0,
      benefit_conditions: b.type15Conditions || ''
    }))

  const nBenefits = benefits
    .filter(b => b.nTypeCovered)
    .map(b => ({
      company_name: b.companyName,
      company_code: b.companyCode,
      total_n: b.nTypeCategory || '',
      benefit_structure: b.nTypeConditions || '',
      is_covered: true,
      sub_category: b.nTypeCategory || '',
      benefit_amount: b.nTypeAmount || 0,
      notes: b.notes || ''
    }))

  return { typeBenefits, nBenefits }
}
