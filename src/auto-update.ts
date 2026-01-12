// 자동 업데이트 시스템 - OpenAI API를 사용한 보험 약관 분석

export interface UpdateContext {
  DB: D1Database
  OPENAI_API_KEY: string
}

/**
 * OpenAI API를 사용하여 보험 약관 텍스트 분석
 */
export async function analyzeInsuranceTerms(termsText: string, apiKey: string): Promise<{
  surgeries: Array<{
    name: string
    name_en: string
    edi_code: string
    kcd_code: string
    medical_classification: string
    difficulty_level: number
    description: string
  }>
  benefits: Array<{
    surgery_name: string
    company_code: string
    benefit_type: '1-5종' | 'N대'
    surgery_type?: number
    sub_category?: string
    benefit_amount?: number
    benefit_conditions?: string
  }>
}> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 국내 보험 약관 전문 분석가입니다. 
보험사의 수술비 특약 약관을 분석하여 다음 정보를 JSON 형식으로 추출하세요:

1. surgeries: 약관에 언급된 수술 목록
   - name: 수술명 (한글)
   - name_en: 수술명 (영문)
   - edi_code: EDI 코드 (없으면 빈 문자열)
   - kcd_code: KCD 코드 (없으면 빈 문자열)
   - medical_classification: 의학적 분류 (예: 안과 수술, 정형외과 수술)
   - difficulty_level: 난이도 1-5종 (1이 가장 어려움)
   - description: 수술 설명

2. benefits: 보험사별 보장 내용
   - surgery_name: 수술명
   - company_code: 보험사 코드 (예: SAMSUNG, HYUNDAI)
   - benefit_type: '1-5종' 또는 'N대'
   - surgery_type: 1-5종인 경우 몇 종인지
   - sub_category: N대인 경우 세부등급 (예: 27대, 59대)
   - benefit_amount: 보장금액 (원)
   - benefit_conditions: 보장조건

정확한 정보만 추출하고, 불확실한 정보는 제외하세요.`
        },
        {
          role: 'user',
          content: termsText
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  return JSON.parse(content)
}

/**
 * 웹 페이지에서 최신 약관 정보 크롤링
 */
export async function fetchInsuranceTerms(companyUrl: string): Promise<string> {
  try {
    const response = await fetch(companyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const html = await response.text()
    
    // HTML에서 약관 텍스트 추출 (간단한 파싱)
    // 실제로는 보험사별 구조에 맞게 조정 필요
    const textContent = html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    return textContent
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}

/**
 * 수술 정보를 데이터베이스에 저장
 */
export async function saveSurgeryData(
  db: D1Database,
  surgery: {
    name: string
    name_en: string
    edi_code: string
    kcd_code: string
    medical_classification: string
    difficulty_level: number
    description: string
  }
): Promise<number> {
  // 중복 확인
  const existing = await db.prepare(`
    SELECT id FROM surgeries WHERE name = ? OR edi_code = ?
  `).bind(surgery.name, surgery.edi_code).first()

  if (existing) {
    // 업데이트
    await db.prepare(`
      UPDATE surgeries 
      SET name_en = ?, kcd_code = ?, medical_classification = ?, 
          difficulty_level = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      surgery.name_en,
      surgery.kcd_code,
      surgery.medical_classification,
      surgery.difficulty_level,
      surgery.description,
      existing.id
    ).run()
    
    return existing.id as number
  } else {
    // 신규 삽입
    const result = await db.prepare(`
      INSERT INTO surgeries (name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      surgery.name,
      surgery.name_en,
      surgery.edi_code,
      surgery.kcd_code,
      surgery.medical_classification,
      surgery.difficulty_level,
      surgery.description
    ).run()
    
    return result.meta.last_row_id as number
  }
}

/**
 * 보험 특약 정보를 데이터베이스에 저장
 */
export async function saveBenefitData(
  db: D1Database,
  benefit: {
    surgery_name: string
    company_code: string
    benefit_type: '1-5종' | 'N대'
    surgery_type?: number
    sub_category?: string
    benefit_amount?: number
    benefit_conditions?: string
  }
): Promise<void> {
  // 수술 ID 조회
  const surgery = await db.prepare(`
    SELECT id FROM surgeries WHERE name = ?
  `).bind(benefit.surgery_name).first()

  if (!surgery) {
    console.warn(`Surgery not found: ${benefit.surgery_name}`)
    return
  }

  // 보험사 ID 조회
  const company = await db.prepare(`
    SELECT id FROM insurance_companies WHERE code = ?
  `).bind(benefit.company_code).first()

  if (!company) {
    console.warn(`Company not found: ${benefit.company_code}`)
    return
  }

  if (benefit.benefit_type === '1-5종' && benefit.surgery_type) {
    // 1-5종 특약 저장
    const existing = await db.prepare(`
      SELECT id FROM surgery_type_benefits 
      WHERE insurance_company_id = ? AND surgery_id = ?
    `).bind(company.id, surgery.id).first()

    if (existing) {
      // 업데이트
      await db.prepare(`
        UPDATE surgery_type_benefits 
        SET surgery_type = ?, benefit_amount = ?, benefit_conditions = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(benefit.surgery_type, benefit.benefit_amount || 0, benefit.benefit_conditions || '', existing.id).run()
    } else {
      // 신규 삽입
      await db.prepare(`
        INSERT INTO surgery_type_benefits 
        (insurance_company_id, surgery_id, benefit_name, surgery_type, benefit_amount, benefit_conditions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        company.id,
        surgery.id,
        '질병 1-5종수술비',
        benefit.surgery_type,
        benefit.benefit_amount || 0,
        benefit.benefit_conditions || ''
      ).run()
    }
  } else if (benefit.benefit_type === 'N대' && benefit.sub_category) {
    // N대 특약 저장
    const nBenefit = await db.prepare(`
      SELECT id FROM n_surgery_benefits WHERE insurance_company_id = ?
    `).bind(company.id).first()

    if (nBenefit) {
      const existing = await db.prepare(`
        SELECT id FROM n_surgery_details 
        WHERE n_benefit_id = ? AND surgery_id = ?
      `).bind(nBenefit.id, surgery.id).first()

      if (existing) {
        // 업데이트
        await db.prepare(`
          UPDATE n_surgery_details 
          SET is_covered = 1, sub_category = ?, benefit_amount = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(benefit.sub_category, benefit.benefit_amount || 0, existing.id).run()
      } else {
        // 신규 삽입
        await db.prepare(`
          INSERT INTO n_surgery_details 
          (n_benefit_id, surgery_id, is_covered, sub_category, benefit_amount)
          VALUES (?, ?, 1, ?, ?)
        `).bind(nBenefit.id, surgery.id, benefit.sub_category, benefit.benefit_amount || 0).run()
      }
    }
  }
}

/**
 * 메인 자동 업데이트 함수
 */
export async function runAutoUpdate(ctx: UpdateContext, companyUrl: string, companyCode: string): Promise<{
  success: boolean
  surgeries_added: number
  benefits_added: number
  error?: string
}> {
  try {
    console.log(`Starting auto-update for ${companyCode}...`)
    
    // 1. 약관 크롤링
    const termsText = await fetchInsuranceTerms(companyUrl)
    console.log(`Fetched terms text: ${termsText.length} characters`)
    
    // 2. OpenAI로 분석
    const analysis = await analyzeInsuranceTerms(termsText, ctx.OPENAI_API_KEY)
    console.log(`Analyzed: ${analysis.surgeries.length} surgeries, ${analysis.benefits.length} benefits`)
    
    // 3. 데이터베이스에 저장
    let surgeriesAdded = 0
    let benefitsAdded = 0
    
    for (const surgery of analysis.surgeries) {
      await saveSurgeryData(ctx.DB, surgery)
      surgeriesAdded++
    }
    
    for (const benefit of analysis.benefits) {
      await saveBenefitData(ctx.DB, benefit)
      benefitsAdded++
    }
    
    console.log(`Auto-update completed: ${surgeriesAdded} surgeries, ${benefitsAdded} benefits`)
    
    return {
      success: true,
      surgeries_added: surgeriesAdded,
      benefits_added: benefitsAdded
    }
  } catch (error) {
    console.error('Auto-update error:', error)
    return {
      success: false,
      surgeries_added: 0,
      benefits_added: 0,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
