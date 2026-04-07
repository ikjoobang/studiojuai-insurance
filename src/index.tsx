import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { runAutoUpdate } from './auto-update'
import { syncSurgeryDataFromHIRA, searchSurgeryByName } from './hira-api'
import { searchSurgeryWithGPT } from './gpt-search'
import { searchAllInsuranceCompanies, convertToDBFormat } from './realtime-insurance-search'
import { hybridSearch } from './hybrid-search'

type Bindings = {
  DB: D1Database
  OPENAI_API_KEY: string
  PERPLEXITY_API_KEY: string
  HIRA_API_KEY: string
  GEMINI_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS 설정
app.use('/api/*', cors())

// 관리자 API 비밀번호 보호
app.use('/api/admin/*', async (c, next) => {
  const pw = c.req.header('X-Admin-Password') || c.req.query('pw')
  if (pw !== 'xivix2026') {
    return c.json({ error: '관리자 인증이 필요합니다' }, 401)
  }
  await next()
})

// 정적 파일 제공
app.use('/static/*', serveStatic({ root: './public' }))

// ==================== API 라우트 ====================

// 수술 검색 API
app.get('/api/search/surgery', async (c) => {
  const query = c.req.query('q')
  
  if (!query) {
    return c.json({ error: '검색어를 입력해주세요' }, 400)
  }

  try {
    // D1 데이터베이스가 없는 경우 빈 배열 반환
    if (!c.env.DB) {
      return c.json({ surgeries: [] })
    }
    
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description
      FROM surgeries
      WHERE name LIKE ? OR edi_code LIKE ? OR kcd_code LIKE ?
      ORDER BY name
      LIMIT 20
    `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all()

    return c.json({ surgeries: results })
  } catch (error) {
    console.error('Search error:', error)
    return c.json({ surgeries: [] })
  }
})

// 수술 상세 정보 조회
app.get('/api/surgery/:id', async (c) => {
  const surgeryId = c.req.param('id')

  try {
    // D1 데이터베이스가 없는 경우
    if (!c.env.DB) {
      return c.json({ error: 'D1 데이터베이스가 설정되지 않았습니다' }, 503)
    }
    
    // 수술 기본 정보
    const surgery = await c.env.DB.prepare(`
      SELECT * FROM surgeries WHERE id = ?
    `).bind(surgeryId).first()

    if (!surgery) {
      return c.json({ error: '수술 정보를 찾을 수 없습니다' }, 404)
    }

    // 리스크 정보
    const risk = await c.env.DB.prepare(`
      SELECT * FROM surgery_risks WHERE surgery_id = ?
    `).bind(surgeryId).first()

    return c.json({ surgery, risk })
  } catch (error) {
    console.error('Fetch error:', error)
    return c.json({ error: '조회 중 오류가 발생했습니다' }, 500)
  }
})

// 보험사별 1-5종 수술비 특약 조회
app.get('/api/surgery/:id/type-benefits', async (c) => {
  const surgeryId = c.req.param('id')

  try {
    const { results } = await c.env.DB.prepare(`
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
    `).bind(surgeryId).all()

    return c.json({ benefits: results })
  } catch (error) {
    console.error('Type benefits error:', error)
    return c.json({ error: '조회 중 오류가 발생했습니다' }, 500)
  }
})

// 보험사별 N대 수술비 특약 조회
app.get('/api/surgery/:id/n-benefits', async (c) => {
  const surgeryId = c.req.param('id')

  try {
    const { results } = await c.env.DB.prepare(`
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
    `).bind(surgeryId).all()

    return c.json({ benefits: results })
  } catch (error) {
    console.error('N benefits error:', error)
    return c.json({ error: '조회 중 오류가 발생했습니다' }, 500)
  }
})

// 종합 분석 리포트 생성
app.get('/api/surgery/:id/report', async (c) => {
  const surgeryId = c.req.param('id')

  try {
    // 수술 기본 정보
    const surgery = await c.env.DB.prepare(`
      SELECT * FROM surgeries WHERE id = ?
    `).bind(surgeryId).first()

    if (!surgery) {
      return c.json({ error: '수술 정보를 찾을 수 없습니다' }, 404)
    }

    // 1-5종 특약 정보
    const { results: typeBenefits } = await c.env.DB.prepare(`
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
    `).bind(surgeryId).all()

    // N대 특약 정보
    const { results: nBenefits } = await c.env.DB.prepare(`
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
    `).bind(surgeryId).all()

    // 리스크 정보
    const risk = await c.env.DB.prepare(`
      SELECT * FROM surgery_risks WHERE surgery_id = ?
    `).bind(surgeryId).first()

    // 검색 로그 업데이트
    // 기존 로그 확인
    const existingLog = await c.env.DB.prepare(`
      SELECT id, search_count FROM search_logs WHERE surgery_name = ?
    `).bind(surgery.name).first()
    
    if (existingLog) {
      // 기존 로그 업데이트
      await c.env.DB.prepare(`
        UPDATE search_logs 
        SET search_count = ?, last_searched_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(existingLog.search_count + 1, existingLog.id).run()
    } else {
      // 새 로그 생성
      await c.env.DB.prepare(`
        INSERT INTO search_logs (surgery_name, surgery_code, search_count, last_searched_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      `).bind(surgery.name, surgery.edi_code).run()
    }

    return c.json({
      surgery,
      typeBenefits,
      nBenefits,
      risk,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Report error:', error)
    return c.json({ error: '리포트 생성 중 오류가 발생했습니다' }, 500)
  }
})

// 보험사 목록 조회
app.get('/api/insurance-companies', async (c) => {
  try {
    // D1 데이터베이스가 없는 경우 빈 배열 반환
    if (!c.env.DB) {
      return c.json({ companies: [] })
    }
    
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM insurance_companies ORDER BY name
    `).all()

    return c.json({ companies: results })
  } catch (error) {
    console.error('Companies error:', error)
    return c.json({ companies: [] })
  }
})

// 수술 데이터 추가 (관리자용)
app.post('/api/admin/surgery', async (c) => {
  try {
    const data = await c.req.json()
    const { name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description } = data

    const result = await c.env.DB.prepare(`
      INSERT INTO surgeries (name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description).run()

    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (error) {
    console.error('Insert error:', error)
    return c.json({ error: '추가 중 오류가 발생했습니다' }, 500)
  }
})

// 1-5종 특약 데이터 추가 (관리자용)
app.post('/api/admin/type-benefit', async (c) => {
  try {
    const data = await c.req.json()
    const { insurance_company_id, surgery_id, benefit_name, surgery_type, benefit_amount, benefit_conditions } = data

    const result = await c.env.DB.prepare(`
      INSERT INTO surgery_type_benefits 
      (insurance_company_id, surgery_id, benefit_name, surgery_type, benefit_amount, benefit_conditions)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(insurance_company_id, surgery_id, benefit_name, surgery_type, benefit_amount, benefit_conditions).run()

    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (error) {
    console.error('Insert error:', error)
    return c.json({ error: '추가 중 오류가 발생했습니다' }, 500)
  }
})

// N대 특약 상세 추가 (관리자용)
app.post('/api/admin/n-benefit-detail', async (c) => {
  try {
    const data = await c.req.json()
    const { n_benefit_id, surgery_id, is_covered, sub_category, benefit_amount, notes } = data

    const result = await c.env.DB.prepare(`
      INSERT INTO n_surgery_details 
      (n_benefit_id, surgery_id, is_covered, sub_category, benefit_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(n_benefit_id, surgery_id, is_covered, sub_category, benefit_amount, notes).run()

    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (error) {
    console.error('Insert error:', error)
    return c.json({ error: '추가 중 오류가 발생했습니다' }, 500)
  }
})

// 인기 검색어 조회
app.get('/api/popular-searches', async (c) => {
  try {
    // D1 데이터베이스가 없는 경우 빈 배열 반환
    if (!c.env.DB) {
      return c.json({ searches: [] })
    }
    
    const { results } = await c.env.DB.prepare(`
      SELECT surgery_name, surgery_code, search_count, last_searched_at
      FROM search_logs
      ORDER BY search_count DESC, last_searched_at DESC
      LIMIT 10
    `).all()

    return c.json({ searches: results })
  } catch (error) {
    console.error('Popular searches error:', error)
    // 에러 발생 시에도 빈 배열 반환 (500 에러 방지)
    return c.json({ searches: [] })
  }
})

// ==================== 보험 보장 내역 편집/저장 API ====================

// 보장 내역 조회 (D1에서 저장된 데이터 우선)
app.get('/api/coverage/search', async (c) => {
  const surgeryName = c.req.query('surgery')
  
  if (!surgeryName) {
    return c.json({ error: '수술명을 입력해주세요' }, 400)
  }

  try {
    if (!c.env.DB) {
      return c.json({ coverages: [] })
    }
    
    // D1에서 저장된 보장 내역 조회
    const { results } = await c.env.DB.prepare(`
      SELECT 
        id,
        surgery_name,
        surgery_code,
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
    `).bind(surgeryName).all()

    return c.json({ 
      coverages: results,
      fromDatabase: results.length > 0
    })
  } catch (error) {
    console.error('Coverage search error:', error)
    return c.json({ coverages: [], error: '조회 중 오류가 발생했습니다' }, 500)
  }
})

// 보장 내역 저장/수정
app.post('/api/coverage/save', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ error: 'D1 데이터베이스가 설정되지 않았습니다' }, 503)
    }

    const data = await c.req.json()
    const {
      id,
      surgery_name,
      surgery_code,
      company_name,
      coverage_amount,
      coverage_options,
      coverage_type,
      source_url,
      notes,
      updated_by,
      verified
    } = data

    // 필수 필드 검증
    if (!surgery_name || !company_name || !coverage_amount) {
      return c.json({ error: '필수 항목을 입력해주세요' }, 400)
    }

    if (id) {
      // 기존 데이터 업데이트
      await c.env.DB.prepare(`
        UPDATE insurance_coverage
        SET surgery_name = ?,
            surgery_code = ?,
            company_name = ?,
            coverage_amount = ?,
            coverage_options = ?,
            coverage_type = ?,
            source_url = ?,
            notes = ?,
            updated_by = ?,
            verified = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        surgery_name,
        surgery_code || null,
        company_name,
        coverage_amount,
        coverage_options || null,
        coverage_type || null,
        source_url || null,
        notes || null,
        updated_by || null,
        verified ? 1 : 0,
        id
      ).run()

      return c.json({ success: true, id, message: '수정되었습니다' })
    } else {
      // 신규 데이터 삽입
      const result = await c.env.DB.prepare(`
        INSERT INTO insurance_coverage (
          surgery_name, surgery_code, company_name, coverage_amount,
          coverage_options, coverage_type, source_url, notes,
          updated_by, verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        surgery_name,
        surgery_code || null,
        company_name,
        coverage_amount,
        coverage_options || null,
        coverage_type || null,
        source_url || null,
        notes || null,
        updated_by || null,
        verified ? 1 : 0
      ).run()

      return c.json({ 
        success: true, 
        id: result.meta.last_row_id,
        message: '저장되었습니다'
      })
    }
  } catch (error) {
    console.error('Coverage save error:', error)
    return c.json({ error: '저장 중 오류가 발생했습니다' }, 500)
  }
})

// 보장 내역 삭제
app.delete('/api/coverage/:id', async (c) => {
  const id = c.req.param('id')

  try {
    if (!c.env.DB) {
      return c.json({ error: 'D1 데이터베이스가 설정되지 않았습니다' }, 503)
    }

    await c.env.DB.prepare(`
      DELETE FROM insurance_coverage WHERE id = ?
    `).bind(id).run()

    return c.json({ success: true, message: '삭제되었습니다' })
  } catch (error) {
    console.error('Coverage delete error:', error)
    return c.json({ error: '삭제 중 오류가 발생했습니다' }, 500)
  }
})

// GPT 결과를 D1에 일괄 저장
app.post('/api/coverage/bulk-save', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ error: 'D1 데이터베이스가 설정되지 않았습니다' }, 503)
    }

    const { coverages } = await c.req.json()
    
    if (!Array.isArray(coverages) || coverages.length === 0) {
      return c.json({ error: '저장할 데이터가 없습니다' }, 400)
    }

    let savedCount = 0
    
    for (const item of coverages) {
      const { surgery_name, surgery_code, company_name, coverage_amount, coverage_options, coverage_type } = item
      
      if (!surgery_name || !company_name || !coverage_amount) {
        continue
      }

      try {
        await c.env.DB.prepare(`
          INSERT INTO insurance_coverage (
            surgery_name, surgery_code, company_name, coverage_amount,
            coverage_options, coverage_type, verified
          ) VALUES (?, ?, ?, ?, ?, ?, 0)
        `).bind(
          surgery_name,
          surgery_code || null,
          company_name,
          coverage_amount,
          coverage_options || null,
          coverage_type || null
        ).run()
        
        savedCount++
      } catch (err) {
        console.error(`Failed to save ${company_name}:`, err)
      }
    }

    return c.json({ 
      success: true, 
      savedCount,
      message: `${savedCount}개 항목이 저장되었습니다`
    })
  } catch (error) {
    console.error('Bulk save error:', error)
    return c.json({ error: '일괄 저장 중 오류가 발생했습니다' }, 500)
  }
})

// ==================== 프론트엔드 페이지 ====================

app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>보험스캔 - ICD-10 진단코드 검색 + 의료영상 AI 판독</title>
        <meta name="description" content="ICD-10 진단코드 검색, 11개 보험사 수술비 특약 비교, 의료영상 AI 판독(교육용)을 하나의 사이트에서 제공합니다.">
        <meta property="og:title" content="보험스캔">
        <meta property="og:description" content="ICD-10 진단코드 검색 + 의료영상 AI 판독">
        <meta property="og:type" content="website">
        <meta property="og:url" content="https://studiojuai-insurance.pages.dev">
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300C853'/><text x='50' y='68' font-size='55' font-family='sans-serif' font-weight='bold' fill='white' text-anchor='middle'>스</text></svg>">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                fontFamily: {
                  sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                },
                colors: {
                  primary: '#00C853',
                }
              }
            }
          }
        </script>
        <style>
          :root {
            --bg: #FAFAF8;
            --card: #FFFFFF;
            --card-border: rgba(0,0,0,0.06);
            --text-1: #111111;
            --text-2: #333333;
            --text-3: #666666;
            --green: #00C853;
            --green-light: #69F0AE;
            --red: #dc2626;
          }
          [data-theme="dark"] {
            --bg: #0a0a0a;
            --card: #111111;
            --card-border: rgba(255,255,255,0.06);
            --text-1: #FFFFFF;
            --text-2: #E0E0E0;
            --text-3: #999999;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body {
            font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg);
            color: var(--text-1);
            overflow-x: hidden;
          }
          .t1 { color: var(--text-1); }
          .t2 { color: var(--text-2); }
          .t3 { color: var(--text-3); }
          .container-main { max-width: 1100px; margin: 0 auto; }
          .hero-gradient {
            background: linear-gradient(180deg, var(--bg) 0%, #f0f0ee 50%, var(--bg) 100%);
            position: relative;
          }
          .hero-gradient::before {
            content: '';
            position: absolute;
            top: 0; left: 50%; transform: translateX(-50%);
            width: 100%; max-width: 1200px; height: 100%;
            background: radial-gradient(ellipse at center top, rgba(0,200,83,0.08) 0%, transparent 60%);
            pointer-events: none;
          }
          [data-theme="dark"] .hero-gradient {
            background: linear-gradient(180deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%);
          }
          [data-theme="dark"] .hero-gradient::before {
            background: radial-gradient(ellipse at center top, rgba(0,200,83,0.15) 0%, transparent 60%);
          }
          .glass-card {
            background: var(--card);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          }
          [data-theme="dark"] .glass-card {
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            box-shadow: none;
          }
          .search-input {
            background: #F5F5F5;
            border: 1px solid rgba(0,0,0,0.08);
            color: var(--text-1);
            transition: all 0.3s ease;
          }
          .search-input::placeholder { color: var(--text-3); }
          .search-input:focus {
            background: #FFFFFF;
            border-color: var(--green);
            box-shadow: 0 0 0 4px rgba(0,200,83,0.12);
            outline: none;
          }
          [data-theme="dark"] .search-input {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
          }
          [data-theme="dark"] .search-input:focus {
            background: rgba(255,255,255,0.08);
          }
          .btn-primary {
            background: linear-gradient(135deg, #00C853 0%, #00A844 100%);
            transition: all 0.3s ease;
            min-height: 44px;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(0,200,83,0.3);
          }
          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          .feature-card {
            background: var(--card);
            border: 1px solid var(--card-border);
            transition: all 0.3s ease;
          }
          .feature-card:hover {
            border-color: rgba(0,200,83,0.3);
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.08);
          }
          [data-theme="dark"] .feature-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.06);
          }
          [data-theme="dark"] .feature-card:hover {
            background: rgba(255,255,255,0.05);
            box-shadow: none;
          }
          .result-card {
            background: var(--card);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          }
          [data-theme="dark"] .result-card {
            background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: none;
          }
          .badge {
            background: linear-gradient(135deg, rgba(0,200,83,0.1) 0%, rgba(0,200,83,0.05) 100%);
            border: 1px solid rgba(0,200,83,0.2);
          }
          .tab-btn {
            min-height: 44px;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          .tab-btn.active {
            background: var(--green) !important;
            color: #FFFFFF !important;
          }
          .tab-btn:not(.active) {
            background: rgba(0,0,0,0.04);
            color: var(--text-3);
          }
          .tab-btn:not(.active):hover {
            background: rgba(0,0,0,0.08);
          }
          [data-theme="dark"] .tab-btn:not(.active) {
            background: rgba(255,255,255,0.05);
          }
          [data-theme="dark"] .tab-btn:not(.active):hover {
            background: rgba(255,255,255,0.1);
          }
          .chip { min-height: 44px; display: inline-flex; align-items: center; }
          .upload-area {
            border: 2px dashed var(--card-border);
            transition: all 0.3s ease;
            cursor: pointer;
          }
          .upload-area:hover, .upload-area.dragover {
            border-color: var(--green);
            background: rgba(0,200,83,0.05);
          }
          @keyframes countUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .stat-number { animation: countUp 0.6s ease-out forwards; }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
          .spinner {
            border: 3px solid rgba(0,200,83,0.2);
            border-top-color: var(--green);
            border-radius: 50%;
            width: 40px; height: 40px;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .suggestion-item { transition: all 0.2s ease; }
          .suggestion-item:hover { background: rgba(0,200,83,0.1); }
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); }
          ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
          [data-theme="dark"] ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
          [data-theme="dark"] ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
          @media (max-width: 768px) {
            .hero-title { font-size: 2rem !important; line-height: 1.2 !important; }
            .hero-subtitle { font-size: 1rem !important; }
          }
        </style>
    </head>
    <body class="min-h-screen">
        <!-- Navigation -->
        <nav class="fixed top-0 left-0 right-0 z-50 px-4 py-4" style="background: var(--bg); border-bottom: 1px solid var(--card-border);">
            <div class="container-main flex items-center justify-between">
                <a href="/" class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #00C853;">
                        <span class="text-white font-bold text-lg">스</span>
                    </div>
                    <span class="text-xl font-bold t1">보험스캔</span>
                </a>
                <div class="flex items-center gap-4">
                    <button onclick="toggleTheme()" class="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style="border: 1px solid var(--card-border);">
                        <i id="themeIcon" class="fas fa-moon t3"></i>
                    </button>
                    <button onclick="showAdminPanel()" class="hidden md:flex items-center gap-2 px-4 py-2 rounded-full t3 transition-all text-sm" style="border: 1px solid var(--card-border);">
                        <i class="fas fa-cog"></i>
                        <span>관리자</span>
                    </button>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <section class="hero-gradient min-h-screen flex items-center justify-center px-4 pt-20 pb-16">
            <div class="container-main text-center">
                <!-- Badge -->
                <div class="inline-flex items-center gap-2 badge rounded-full px-4 py-2 mb-8 fade-in-up">
                    <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span class="text-sm font-medium" style="color: var(--green);">AI 기반 보험 분석 + 의료영상 판독</span>
                </div>

                <!-- Hero Title -->
                <h1 class="hero-title text-4xl md:text-6xl lg:text-7xl font-black t1 mb-6 leading-tight fade-in-up" style="animation-delay: 0.1s">
                    보험스캔<br>
                    <span class="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">진단코드 + 영상판독</span>
                </h1>

                <!-- Hero Subtitle -->
                <p class="hero-subtitle text-lg md:text-xl t3 mb-12 max-w-2xl mx-auto fade-in-up" style="animation-delay: 0.2s">
                    ICD-10 진단코드 검색, 11개 보험사 특약 비교,<br class="hidden md:block">
                    의료영상 AI 판독(교육용)을 한곳에서
                </p>

                <!-- Main Tab Buttons -->
                <div class="flex gap-3 max-w-3xl mx-auto mb-6 fade-in-up" style="animation-delay: 0.25s">
                    <button id="mainTabDiagnosis" onclick="switchMainTab('diagnosis')" class="tab-btn active flex-1 py-3 px-4 rounded-xl text-sm font-semibold">
                        <i class="fas fa-stethoscope mr-2"></i>진단코드 검색
                    </button>
                    <button id="mainTabImaging" onclick="switchMainTab('imaging')" class="tab-btn flex-1 py-3 px-4 rounded-xl text-sm font-semibold">
                        <i class="fas fa-x-ray mr-2"></i>영상판독(교육용)
                    </button>
                </div>

                <!-- Diagnosis Search Section -->
                <div id="diagnosisSection" class="glass-card p-6 md:p-8 max-w-3xl mx-auto fade-in-up" style="animation-delay: 0.3s">
                    <!-- Sub-Tab Buttons -->
                    <div class="flex gap-2 mb-6">
                        <button id="tabICD" onclick="switchTab('icd')" class="tab-btn active flex-1 py-3 px-4 rounded-xl text-sm font-semibold">
                            <i class="fas fa-search mr-2"></i>ICD-10 진단코드
                        </button>
                        <button id="tabAI" onclick="switchTab('ai')" class="tab-btn flex-1 py-3 px-4 rounded-xl text-sm font-semibold">
                            <i class="fas fa-robot mr-2"></i>AI 보험 분석
                        </button>
                    </div>

                    <!-- ICD Search -->
                    <div id="icdSearch" class="space-y-4">
                        <div class="relative">
                            <input
                                type="text"
                                id="dbSearchInput"
                                placeholder="예: 백내장, H25, 심근경색, I21, 뇌경색"
                                class="search-input w-full px-6 py-5 rounded-2xl text-lg"
                                onkeypress="if(event.key==='Enter') searchFromDB()"
                                oninput="showDBSuggestions(this.value)"
                                autocomplete="off"
                            >
                            <button onclick="searchFromDB()" class="absolute right-3 top-1/2 -translate-y-1/2 btn-primary px-6 py-3 rounded-xl text-white font-semibold">
                                <i class="fas fa-search mr-2"></i>검색
                            </button>
                        </div>
                        <div id="dbSuggestions" class="hidden absolute left-0 right-0 mt-2 glass-card rounded-xl overflow-hidden max-h-80 overflow-y-auto z-50"></div>
                    </div>

                    <!-- AI Search -->
                    <div id="aiSearch" class="hidden space-y-4">
                        <div class="relative">
                            <input
                                type="text"
                                id="searchInput"
                                placeholder="예: H40.1, 원발개방각녹내장, H25 백내장"
                                class="search-input w-full px-6 py-5 rounded-2xl text-lg"
                                onkeypress="if(event.key==='Enter') searchWithGPT()"
                                autocomplete="off"
                            >
                            <button onclick="searchWithGPT()" class="absolute right-3 top-1/2 -translate-y-1/2 btn-primary px-6 py-3 rounded-xl text-white font-semibold">
                                <i class="fas fa-robot mr-2"></i>AI 분석
                            </button>
                        </div>
                    </div>

                    <!-- Quick Tags -->
                    <div class="flex flex-wrap gap-2 mt-6 justify-center">
                        <span class="t3 text-sm">인기 검색:</span>
                        <button onclick="quickSearch('백내장 H25')" class="px-3 py-1 rounded-lg text-sm transition-colors" style="background: rgba(0,200,83,0.08); color: var(--text-2);">백내장</button>
                        <button onclick="quickSearch('심근경색 I21')" class="px-3 py-1 rounded-lg text-sm transition-colors" style="background: rgba(0,200,83,0.08); color: var(--text-2);">심근경색</button>
                        <button onclick="quickSearch('녹내장 H40')" class="px-3 py-1 rounded-lg text-sm transition-colors" style="background: rgba(0,200,83,0.08); color: var(--text-2);">녹내장</button>
                        <button onclick="quickSearch('뇌경색 I63')" class="px-3 py-1 rounded-lg text-sm transition-colors" style="background: rgba(0,200,83,0.08); color: var(--text-2);">뇌경색</button>
                    </div>
                </div>

                <!-- Medical Image Analysis Section -->
                <div id="imagingSection" class="hidden glass-card p-6 md:p-8 max-w-3xl mx-auto fade-in-up" style="animation-delay: 0.3s">
                    <!-- Disclaimer -->
                    <div class="p-4 rounded-xl mb-6 text-left" style="background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15);">
                        <div class="flex items-start gap-3">
                            <i class="fas fa-exclamation-triangle mt-1" style="color: var(--red);"></i>
                            <div>
                                <p class="font-semibold t1 text-sm">교육용 참고 자료</p>
                                <p class="t3 text-xs mt-1">본 분석은 교육용 참고 자료이며 실제 진단을 대체하지 않습니다. 정확한 진단은 반드시 전문 의료진과 상담하세요.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Image Upload Area -->
                    <div id="uploadArea" class="upload-area rounded-2xl p-12 text-center mb-6" onclick="document.getElementById('imageFileInput').click()" ondragover="event.preventDefault(); this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="handleImageDrop(event)">
                        <input type="file" id="imageFileInput" accept="image/*" class="hidden" onchange="handleImageSelect(this)">
                        <div id="uploadPlaceholder">
                            <i class="fas fa-cloud-upload-alt text-4xl mb-4" style="color: var(--green);"></i>
                            <p class="t1 font-semibold mb-2">의료 영상 업로드</p>
                            <p class="t3 text-sm">CT, X-ray, MRI 등 의료 영상을 드래그하거나 클릭하세요</p>
                            <p class="t3 text-xs mt-2">지원 형식: JPG, PNG, WEBP</p>
                        </div>
                        <div id="uploadPreview" class="hidden">
                            <img id="previewImage" class="max-h-64 mx-auto rounded-xl mb-4" alt="">
                            <p id="previewFileName" class="t2 text-sm font-medium"></p>
                        </div>
                    </div>

                    <!-- Patient Info (Optional) -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-left">
                        <div>
                            <label class="block text-sm font-medium t2 mb-2">환자명 (선택)</label>
                            <input type="text" id="patientName" class="search-input w-full px-4 py-3 rounded-xl text-sm" placeholder="홍길동">
                        </div>
                        <div>
                            <label class="block text-sm font-medium t2 mb-2">검사일 (선택)</label>
                            <input type="date" id="examDate" class="search-input w-full px-4 py-3 rounded-xl text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium t2 mb-2">검사 유형</label>
                            <select id="examType" class="search-input w-full px-4 py-3 rounded-xl text-sm">
                                <option value="">선택하세요</option>
                                <option value="X-ray">X-ray</option>
                                <option value="CT">CT</option>
                                <option value="MRI">MRI</option>
                                <option value="Ultrasound">초음파</option>
                                <option value="PET-CT">PET-CT</option>
                                <option value="Mammography">유방촬영</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>
                    </div>

                    <!-- Analyze Button -->
                    <button id="analyzeImageBtn" onclick="analyzeImage()" class="w-full btn-primary py-4 rounded-xl text-white font-semibold" disabled>
                        <i class="fas fa-microscope mr-2"></i>AI 영상 분석 시작
                    </button>

                    <!-- Analysis Results -->
                    <div id="imageAnalysisResult" class="hidden mt-6 text-left"></div>
                </div>

                <!-- Stats -->
                <div class="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-16 fade-in-up" style="animation-delay: 0.4s">
                    <div class="text-center">
                        <div class="stat-number text-3xl md:text-4xl font-bold t1 mb-2">11+</div>
                        <div class="t3 text-sm">보험사 분석</div>
                    </div>
                    <div class="text-center">
                        <div class="stat-number text-3xl md:text-4xl font-bold t1 mb-2">50+</div>
                        <div class="t3 text-sm">진단코드 DB</div>
                    </div>
                    <div class="text-center">
                        <div class="stat-number text-3xl md:text-4xl font-bold t1 mb-2">24/7</div>
                        <div class="t3 text-sm">실시간 분석</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Results Section -->
        <section id="resultsSection" class="hidden py-16 px-4">
            <div class="container-main">
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h2 class="text-2xl md:text-3xl font-bold t1 mb-2">검색 결과</h2>
                        <p id="resultsQuery" class="t3"></p>
                    </div>
                    <div id="downloadButtons" class="hidden flex gap-3">
                        <button onclick="downloadAsPDF()" class="chip flex items-center gap-2 px-4 py-2 rounded-xl transition-colors" style="background: rgba(220,38,38,0.08); color: var(--red);">
                            <i class="fas fa-file-pdf"></i>
                            <span class="hidden md:inline">PDF</span>
                        </button>
                        <button onclick="downloadAsTXT()" class="chip flex items-center gap-2 px-4 py-2 rounded-xl transition-colors" style="background: rgba(0,0,0,0.05); color: var(--text-3);">
                            <i class="fas fa-file-alt"></i>
                            <span class="hidden md:inline">TXT</span>
                        </button>
                    </div>
                </div>
                <div id="searchResults" class="space-y-6"></div>
                <div id="dbSearchResults" class="space-y-6"></div>
            </div>
        </section>

        <!-- Features Section -->
        <section class="py-20 px-4">
            <div class="container-main">
                <div class="text-center mb-16">
                    <h2 class="text-3xl md:text-4xl font-bold t1 mb-4">보험스캔의 핵심 기능</h2>
                    <p class="t3 text-lg">보험 분석과 의료영상 판독을 한곳에서</p>
                </div>

                <div class="grid md:grid-cols-3 gap-6">
                    <div class="feature-card rounded-2xl p-8">
                        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style="background: rgba(0,200,83,0.1);">
                            <i class="fas fa-bolt text-2xl" style="color: var(--green);"></i>
                        </div>
                        <h3 class="text-xl font-bold t1 mb-3">실시간 AI 분석</h3>
                        <p class="t3 leading-relaxed">Perplexity + GPT 하이브리드 검색으로 최신 보험 정보를 실시간 분석합니다.</p>
                        <ul class="mt-4 space-y-2">
                            <li class="flex items-center gap-2 t3 text-sm"><i class="fas fa-check" style="color: var(--green);"></i>실시간 웹 검색</li>
                            <li class="flex items-center gap-2 t3 text-sm"><i class="fas fa-check" style="color: var(--green);"></i>GPT 기반 분석</li>
                        </ul>
                    </div>

                    <div class="feature-card rounded-2xl p-8">
                        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style="background: rgba(59,130,246,0.1);">
                            <i class="fas fa-database text-blue-500 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold t1 mb-3">ICD-10 진단코드 DB</h3>
                        <p class="t3 leading-relaxed">병원 진단서에 표기되는 실제 질병분류코드를 정확하게 검색합니다.</p>
                        <ul class="mt-4 space-y-2">
                            <li class="flex items-center gap-2 t3 text-sm"><i class="fas fa-check text-blue-500"></i>정확도 100%</li>
                            <li class="flex items-center gap-2 t3 text-sm"><i class="fas fa-check text-blue-500"></i>실제 의료 코드</li>
                        </ul>
                    </div>

                    <div class="feature-card rounded-2xl p-8">
                        <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style="background: rgba(139,92,246,0.1);">
                            <i class="fas fa-x-ray text-purple-500 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold t1 mb-3">의료영상 AI 판독</h3>
                        <p class="t3 leading-relaxed">X-ray, CT, MRI 영상을 AI가 분석하여 교육용 참고 소견을 제공합니다.</p>
                        <ul class="mt-4 space-y-2">
                            <li class="flex items-center gap-2 t3 text-sm"><i class="fas fa-check text-purple-500"></i>OpenAI Vision</li>
                            <li class="flex items-center gap-2 t3 text-sm"><i class="fas fa-check text-purple-500"></i>교육용 참고 자료</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <!-- Quick Links Section -->
        <section class="py-20 px-4" style="border-top: 1px solid var(--card-border);">
            <div class="container-main">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold t1 mb-4">빠른 링크</h2>
                    <p class="t3">보험 및 유관기관 바로가기</p>
                </div>

                <div class="grid md:grid-cols-3 gap-6">
                    <div class="glass-card rounded-2xl p-6">
                        <button onclick="toggleOrgSection('insurance')" class="w-full flex items-center justify-between text-left">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(59,130,246,0.1);">
                                    <i class="fas fa-building text-blue-500"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold t1">보험기관</h3>
                                    <p class="text-sm t3" id="insuranceCount"></p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-down t3 transition-transform" id="insuranceChevron"></i>
                        </button>
                        <div id="insuranceOrgs" class="hidden mt-4 space-y-2 max-h-64 overflow-y-auto"></div>
                    </div>

                    <div class="glass-card rounded-2xl p-6">
                        <button onclick="toggleOrgSection('related')" class="w-full flex items-center justify-between text-left">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(0,200,83,0.1);">
                                    <i class="fas fa-university" style="color: var(--green);"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold t1">유관기관</h3>
                                    <p class="text-sm t3" id="relatedCount"></p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-down t3 transition-transform" id="relatedChevron"></i>
                        </button>
                        <div id="relatedOrgs" class="hidden mt-4 space-y-2 max-h-64 overflow-y-auto"></div>
                    </div>

                    <div class="glass-card rounded-2xl p-6">
                        <button onclick="toggleOrgSection('overseas')" class="w-full flex items-center justify-between text-left">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(139,92,246,0.1);">
                                    <i class="fas fa-globe text-purple-500"></i>
                                </div>
                                <div>
                                    <h3 class="font-bold t1">해외보험기관</h3>
                                    <p class="text-sm t3" id="overseasCount"></p>
                                </div>
                            </div>
                            <i class="fas fa-chevron-down t3 transition-transform" id="overseasChevron"></i>
                        </button>
                        <div id="overseasOrgs" class="hidden mt-4 space-y-2 max-h-64 overflow-y-auto"></div>
                    </div>
                </div>
            </div>
        </section>

        <!-- AI Disclaimer -->
        <section class="py-8 px-4" style="background: rgba(0,200,83,0.03); border-top: 1px solid var(--card-border); border-bottom: 1px solid var(--card-border);">
            <div class="container-main">
                <div class="flex items-start gap-4">
                    <i class="fas fa-info-circle text-xl mt-1" style="color: var(--green);"></i>
                    <div>
                        <p class="font-semibold t1 mb-1">AI 분석 안내</p>
                        <p class="t3 text-sm leading-relaxed">본 서비스의 모든 AI 분석 결과(보험 특약 분석, 의료영상 판독)는 교육용 참고 자료이며 실제 진단이나 보험 심사를 대체하지 않습니다. 정확한 판단은 전문 의료진 및 보험 전문가와 상담하세요.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer class="py-12 px-4" style="border-top: 1px solid var(--card-border);">
            <div class="container-main">
                <div class="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #00C853;">
                            <span class="text-white font-bold text-lg">스</span>
                        </div>
                        <span class="text-xl font-bold t1">보험스캔</span>
                    </div>

                    <div class="flex items-center gap-6">
                        <a href="https://www.studiojuai.com" target="_blank" class="t3 hover:opacity-70 transition-colors">
                            <i class="fas fa-globe mr-2"></i>Website
                        </a>
                        <a href="https://www.instagram.com/STUDIO_JU_AI" target="_blank" class="t3 hover:opacity-70 transition-colors">
                            <i class="fab fa-instagram mr-2"></i>Instagram
                        </a>
                        <a href="mailto:ikjoobang@gmail.com" class="t3 hover:opacity-70 transition-colors">
                            <i class="fas fa-envelope mr-2"></i>Contact
                        </a>
                    </div>
                </div>

                <div class="text-center mt-8 pt-8" style="border-top: 1px solid var(--card-border);">
                    <p class="t3 text-sm">&copy; 2025 보험스캔. All rights reserved.</p>
                </div>
            </div>
        </footer>

        <!-- Admin Modal -->
        <div id="adminModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="glass-card rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold t1">관리자 패널</h2>
                    <button onclick="closeAdminPanel()" class="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style="border: 1px solid var(--card-border);">
                        <i class="fas fa-times t3"></i>
                    </button>
                </div>

                <div class="space-y-3">
                    <button onclick="showPDFUpload()" class="w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left" style="background: rgba(220,38,38,0.06);">
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(220,38,38,0.1);">
                            <i class="fas fa-file-pdf" style="color: var(--red);"></i>
                        </div>
                        <div>
                            <div class="font-semibold t1">PDF 업로드</div>
                            <div class="text-sm t3">보험 약관 분석</div>
                        </div>
                    </button>

                    <button onclick="syncHIRAData()" class="w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left" style="background: rgba(59,130,246,0.06);">
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(59,130,246,0.1);">
                            <i class="fas fa-database text-blue-500"></i>
                        </div>
                        <div>
                            <div class="font-semibold t1">HIRA 동기화</div>
                            <div class="text-sm t3">건강보험심사평가원 데이터</div>
                        </div>
                    </button>

                    <button onclick="triggerAutoUpdate()" class="w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left" style="background: rgba(0,200,83,0.06);">
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: rgba(0,200,83,0.1);">
                            <i class="fas fa-sync-alt" style="color: var(--green);"></i>
                        </div>
                        <div>
                            <div class="font-semibold t1">자동 업데이트</div>
                            <div class="text-sm t3">데이터 갱신</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>

        <!-- PDF Upload Modal -->
        <div id="pdfUploadModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="glass-card rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold t1">PDF 업로드</h2>
                    <button onclick="closePDFUpload()" class="w-10 h-10 rounded-full flex items-center justify-center transition-colors" style="border: 1px solid var(--card-border);">
                        <i class="fas fa-times t3"></i>
                    </button>
                </div>

                <div class="space-y-6">
                    <div class="p-4 rounded-xl" style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.15);">
                        <h3 class="font-semibold text-blue-500 mb-2">
                            <i class="fas fa-info-circle mr-2"></i>사용 방법
                        </h3>
                        <ol class="text-sm t2 space-y-1">
                            <li>1. 보험사 선택</li>
                            <li>2. 보험사 약관 PDF 파일 업로드</li>
                            <li>3. AI가 PDF를 분석하여 수술 코드별 보험 등급 추출</li>
                        </ol>
                    </div>

                    <div>
                        <label class="block text-sm font-medium t2 mb-2">보험사 선택</label>
                        <select id="insuranceCompanySelect" class="w-full px-4 py-3 rounded-xl search-input">
                            <option value="">보험사를 선택하세요</option>
                            <option value="삼성화재">삼성화재 (111대)</option>
                            <option value="현대해상">현대해상 (119대)</option>
                            <option value="DB손보">DB손보 (119대)</option>
                            <option value="KB손보">KB손보 (112대)</option>
                            <option value="농협손보">농협손보 (144대)</option>
                            <option value="한화손보">한화손보 (124대)</option>
                            <option value="메리츠화재">메리츠화재 (119대)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-medium t2 mb-2">PDF 파일</label>
                        <input type="file" id="pdfFileInput" accept=".pdf" class="w-full px-4 py-3 rounded-xl search-input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:cursor-pointer">
                    </div>

                    <button onclick="uploadAndAnalyzePDF()" class="w-full btn-primary py-4 rounded-xl text-white font-semibold">
                        <i class="fas fa-upload mr-2"></i>PDF 업로드 및 분석
                    </button>

                    <div id="pdfAnalysisProgress" class="hidden">
                        <div class="flex items-center gap-4 p-4 rounded-xl" style="background: rgba(234,179,8,0.08); border: 1px solid rgba(234,179,8,0.2);">
                            <div class="spinner"></div>
                            <div>
                                <div class="font-semibold" style="color: #ca8a04;">PDF 분석 중...</div>
                                <div id="pdfAnalysisStatus" class="text-sm t3">업로드 중입니다...</div>
                            </div>
                        </div>
                    </div>

                    <div id="pdfAnalysisResult" class="hidden"></div>
                </div>
            </div>
        </div>

        <!-- Loading Overlay -->
        <div id="loadingOverlay" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div class="text-center">
                <div class="spinner mx-auto mb-4"></div>
                <p class="text-white font-medium">AI가 분석 중입니다...</p>
                <p class="text-gray-400 text-sm mt-2">잠시만 기다려주세요</p>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// ==================== 자동 업데이트 API ====================

// 수동 업데이트 트리거 (관리자용)
app.post('/api/admin/auto-update', async (c) => {
  try {
    const { company_url, company_code } = await c.req.json()
    
    if (!company_url || !company_code) {
      return c.json({ error: '보험사 URL과 코드를 입력해주세요' }, 400)
    }
    
    const result = await runAutoUpdate(
      {
        DB: c.env.DB,
        OPENAI_API_KEY: c.env.OPENAI_API_KEY
      },
      company_url,
      company_code
    )
    
    return c.json(result)
  } catch (error) {
    console.error('Auto-update API error:', error)
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, 500)
  }
})

// 업데이트 상태 조회
app.get('/api/admin/update-status', async (c) => {
  try {
    // 최근 업데이트 통계
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(DISTINCT id) as total_surgeries,
        COUNT(DISTINCT CASE WHEN updated_at > datetime('now', '-7 days') THEN id END) as updated_this_week,
        MAX(updated_at) as last_update
      FROM surgeries
    `).first()
    
    return c.json({ stats })
  } catch (error) {
    console.error('Status error:', error)
    return c.json({ error: '조회 중 오류가 발생했습니다' }, 500)
  }
})

// ==================== HIRA 공공데이터 API 연동 ====================

// HIRA API로 수술 코드 동기화
app.post('/api/admin/hira-sync', async (c) => {
  try {
    const apiKey = c.env.HIRA_API_KEY
    
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      return c.json({ 
        error: 'HIRA API 키가 설정되지 않았습니다. .dev.vars 파일에서 HIRA_API_KEY를 설정해주세요.' 
      }, 400)
    }

    console.log('HIRA API 동기화 시작...')
    const result = await syncSurgeryDataFromHIRA(apiKey, c.env.DB)
    
    return c.json({
      success: true,
      message: 'HIRA API 동기화 완료',
      total: result.total,
      saved: result.saved
    })
  } catch (error) {
    console.error('HIRA sync error:', error)
    return c.json({ 
      error: 'HIRA API 동기화 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// HIRA API에서 수술 검색 (실시간)
app.get('/api/admin/hira-search', async (c) => {
  const query = c.req.query('q')
  
  if (!query) {
    return c.json({ error: '검색어를 입력해주세요' }, 400)
  }

  try {
    const apiKey = c.env.HIRA_API_KEY
    
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      return c.json({ 
        error: 'HIRA API 키가 설정되지 않았습니다.' 
      }, 400)
    }

    const results = await searchSurgeryByName(apiKey, query)
    
    return c.json({
      success: true,
      count: results.length,
      results: results
    })
  } catch (error) {
    console.error('HIRA search error:', error)
    return c.json({ 
      error: 'HIRA API 검색 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// ==================== PDF 분석 및 저장 API ====================

// PDF 업로드 및 분석
app.post('/api/admin/analyze-pdf', async (c) => {
  try {
    const formData = await c.req.formData()
    const company = formData.get('company') as string
    const file = formData.get('file') as File

    if (!company || !file) {
      return c.json({ error: '보험사와 PDF 파일을 모두 제공해주세요' }, 400)
    }

    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, 400)
    }

    // PDF를 base64로 변환
    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    console.log(`📄 PDF 분석 시작: ${company} (${file.size} bytes)`)

    // OpenAI API로 PDF 분석
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `당신은 보험 약관 분석 전문가입니다. ${company}의 N대 수술비 특약 PDF 문서를 분석하여 다음 정보를 추출해주세요:

**목표**: ICD-10 진단코드 또는 수술명과 해당하는 N대 수술비 등급 매칭

**추출할 정보**:
1. ICD-10 진단코드 (예: H25.0, I21.0 등)
2. 진단명/수술명 (한글)
3. 해당하는 N대 수술비 등급 (예: 27대, 59대, 43대 등)
4. 1-5종 수술 분류 (해당되는 경우)

**JSON 형식으로 응답해주세요**:
\`\`\`json
{
  "company": "${company}",
  "total_n": "119대",
  "items": [
    {
      "code": "H25.0",
      "name": "노년성 초기백내장",
      "n_grade": "27대",
      "type_1to5": "3종"
    }
  ]
}
\`\`\`

**주의사항**:
- ICD-10 코드가 명시된 경우 반드시 포함
- N대 등급이 명확한 경우만 포함
- 최대한 많은 매칭 정보 추출 (최소 20개 이상 목표)
- 불확실한 정보는 제외`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API 오류:', error)
      return c.json({ 
        error: 'OpenAI API 호출 실패', 
        details: error 
      }, 500)
    }

    const result = await response.json()
    const content = result.choices[0]?.message?.content

    if (!content) {
      return c.json({ error: 'GPT 응답이 비어있습니다' }, 500)
    }

    // JSON 추출
    let extracted = null
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                     content.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      extracted = JSON.parse(jsonStr)
    } else {
      return c.json({ 
        error: 'JSON 형식 응답을 추출할 수 없습니다',
        rawContent: content 
      }, 500)
    }

    console.log(`✅ PDF 분석 완료: ${extracted.items?.length || 0}개 항목 추출`)

    return c.json({
      success: true,
      data: extracted,
      itemCount: extracted.items?.length || 0
    })
  } catch (error) {
    console.error('PDF 분석 오류:', error)
    return c.json({ 
      error: 'PDF 분석 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// ==================== Gemini API 프록시 (보안: 키 노출 방지) ====================

// Gemini API 프록시 - 프론트엔드에서 직접 호출하지 않고 백엔드를 통해 호출
app.post('/api/gemini/generate', async (c) => {
  const apiKey = c.env.GEMINI_API_KEY
  
  if (!apiKey) {
    return c.json({ 
      error: 'Gemini API 키가 설정되지 않았습니다',
      code: 'MISSING_API_KEY'
    }, 500)
  }

  try {
    const body = await c.req.json() as {
      prompt?: string
      model?: string
      maxTokens?: number
      temperature?: number
    }
    
    const { prompt, model = 'gemini-2.0-flash', maxTokens = 2048, temperature = 0.7 } = body
    
    if (!prompt) {
      return c.json({ error: '프롬프트가 필요합니다' }, 400)
    }

    console.log(`🤖 Gemini API 호출: model=${model}, prompt 길이=${prompt.length}`)

    // Gemini API 호출 (v1beta 엔드포인트)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: temperature
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      return c.json({ 
        error: 'Gemini API 호출 실패',
        status: response.status,
        details: errorText
      }, response.status as any)
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    }
    
    // 응답에서 텍스트 추출
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    console.log(`✅ Gemini 응답 완료: ${text.length}자`)

    return c.json({
      success: true,
      text,
      model,
      source: 'gemini-api-proxy'
    })
  } catch (error) {
    console.error('Gemini proxy error:', error)
    return c.json({ 
      error: 'Gemini API 프록시 오류',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// Gemini API를 활용한 보험 약관 분석
app.post('/api/gemini/analyze-insurance', async (c) => {
  const apiKey = c.env.GEMINI_API_KEY
  
  if (!apiKey) {
    return c.json({ 
      error: 'Gemini API 키가 설정되지 않았습니다',
      code: 'MISSING_API_KEY'
    }, 500)
  }

  try {
    const body = await c.req.json() as {
      surgeryName?: string
      icdCode?: string
      insuranceCompany?: string
    }
    
    const { surgeryName, icdCode, insuranceCompany } = body
    
    if (!surgeryName && !icdCode) {
      return c.json({ error: '수술명 또는 ICD 코드가 필요합니다' }, 400)
    }

    const searchTerm = surgeryName || icdCode
    const companyFilter = insuranceCompany ? `특히 ${insuranceCompany}` : '주요 손해보험사(삼성화재, 현대해상, DB손보, KB손보, 메리츠화재)'

    const prompt = `당신은 한국 보험 전문가입니다. 다음 수술/진단에 대한 보험 보장 정보를 분석해주세요.

검색어: ${searchTerm}
${icdCode ? `ICD-10 코드: ${icdCode}` : ''}

다음 정보를 JSON 형식으로 제공해주세요:
1. 수술명 (한글/영문)
2. 관련 ICD-10 코드들
3. ${companyFilter}의 1-5종 수술비 특약 분류
4. N대 수술비 특약 보장 여부 및 등급
5. 예상 보장금액 범위
6. 보험 청구 시 주의사항

JSON 형식:
{
  "surgeryName": "수술명",
  "surgeryNameEn": "영문명",
  "relatedCodes": ["ICD코드1", "ICD코드2"],
  "typeBenefits": [
    {"company": "보험사", "type": "1-5종", "amount": "금액"}
  ],
  "nBenefits": [
    {"company": "보험사", "grade": "N대 등급", "covered": true/false}
  ],
  "estimatedAmount": "예상금액 범위",
  "notes": ["주의사항1", "주의사항2"],
  "confidence": "정확도 (high/medium/low)",
  "lastUpdated": "정보 기준일"
}`

    console.log(`🔍 Gemini 보험 분석 시작: ${searchTerm}`)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.3
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      return c.json({ 
        error: 'Gemini API 호출 실패',
        status: response.status
      }, response.status as any)
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>
        }
      }>
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // JSON 추출 시도
    let analysisResult = null
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        analysisResult = JSON.parse(jsonMatch[0])
      } catch {
        // JSON 파싱 실패 시 텍스트 그대로 반환
      }
    }

    console.log(`✅ Gemini 보험 분석 완료: ${searchTerm}`)

    return c.json({
      success: true,
      query: searchTerm,
      analysis: analysisResult,
      rawText: text,
      source: 'gemini-insurance-analysis'
    })
  } catch (error) {
    console.error('Gemini insurance analysis error:', error)
    return c.json({ 
      error: '보험 분석 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// ==================== 하이브리드 검색 (DB + GPT) ====================

// 하이브리드 검색: DB 우선, GPT 보완
app.get('/api/gpt-search', async (c) => {
  const query = c.req.query('q')
  
  if (!query) {
    return c.json({ error: '검색어를 입력해주세요' }, 400)
  }

  try {
    const apiKey = c.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return c.json({ 
        error: 'OpenAI API 키가 설정되지 않았습니다.' 
      }, 400)
    }

    console.log(`🔍 하이브리드 검색 시작: "${query}"`)
    const startTime = Date.now()
    
    // 하이브리드 검색 실행 (Perplexity API 포함)
    const perplexityApiKey = c.env.PERPLEXITY_API_KEY
    const result = await hybridSearch(query, c.env.DB, apiKey, perplexityApiKey)
    
    const searchTime = Date.now() - startTime
    console.log(`✅ 검색 완료: ${result.stats.totalResults}개 (DB: ${result.stats.fromDB}, GPT: ${result.stats.fromGPT}, ${searchTime}ms)`)

    return c.json({
      success: result.success,
      results: result.results,
      answer: result.summary,
      source: 'hybrid (database + gpt-3.5-turbo)',
      stats: result.stats,
      searchTime: new Date().toISOString(),
      error: result.error
    })
  } catch (error) {
    console.error('Hybrid search error:', error)
    return c.json({ 
      error: '검색 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// ==================== 의료 영상 판독 API ====================

app.post('/api/analyze-image', async (c) => {
  const apiKey = c.env.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ error: 'OpenAI API 키가 설정되지 않았습니다' }, 500)
  }

  try {
    const formData = await c.req.formData()
    const imageFile = formData.get('image') as File
    const patientName = (formData.get('patientName') as string) || ''
    const examDate = (formData.get('examDate') as string) || ''
    const examType = (formData.get('examType') as string) || ''

    if (!imageFile) {
      return c.json({ error: '이미지 파일을 업로드해주세요' }, 400)
    }

    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const mimeType = imageFile.type || 'image/png'

    console.log(`[영상판독] 분석 시작: ${examType || 'unknown'} (${imageFile.size} bytes)`)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `당신은 의료 영상 판독 보조 AI 시스템입니다.

주요 역할:
- 의료 영상(X-ray, CT, MRI 등)을 분석하여 소견을 제공합니다
- 교육 및 연구 목적의 참고 자료를 생성합니다
- 이 결과는 진단 도구가 아니며, 반드시 전문 의료진의 판독이 필요합니다

응답 형식 (반드시 JSON):
{
  "findings": "주요 소견 (한국어로 상세히 기술)",
  "impression": "종합 인상 (한국어)",
  "icd10_codes": [{"code": "코드", "name": "질환명"}],
  "recommended_tests": ["권장 추가 검사 목록"],
  "recommended_departments": ["권장 진료과"],
  "cautions": ["주의사항 및 참고사항"],
  "confidence": "분석 신뢰도 (high/medium/low)"
}

중요 규칙:
1. 반드시 한국어로 응답
2. 환자 개인정보(이름, 주민번호 등)가 영상에 보이면 분석을 거부하고 error 필드로 알림
3. 반드시 유효한 JSON 형식으로만 응답 (마크다운 코드블록 없이 순수 JSON)
4. 불확실한 소견은 명시적으로 "불확실" 표시
5. 항상 전문의 상담을 권장하는 문구 포함`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `다음 의료 영상을 분석해주세요.${examType ? ' 검사 유형: ' + examType : ''}${patientName ? ' 환자명: ' + patientName : ''}${examDate ? ' 검사일: ' + examDate : ''}\n\nJSON 형식으로만 응답해주세요.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[영상판독] OpenAI API 오류:', errorText)
      return c.json({ error: 'OpenAI API 호출 실패', details: errorText }, 500)
    }

    const result = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string
        }
      }>
    }
    const content = result.choices?.[0]?.message?.content

    if (!content) {
      return c.json({ error: 'AI 응답이 비어있습니다' }, 500)
    }

    // Safety filter detection
    if (content.includes("I can't assist") || content.includes("I cannot assist") || content.includes("I'm unable")) {
      return c.json({
        error: '이미지 분석이 거부되었습니다. 개인정보가 포함되었거나 부적절한 이미지일 수 있습니다.'
      }, 400)
    }

    // JSON extraction
    let analysis = null
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[1] || jsonMatch[0])
      } catch {
        analysis = { findings: content, raw: true }
      }
    } else {
      analysis = { findings: content, raw: true }
    }

    console.log(`[영상판독] 분석 완료`)

    return c.json({
      success: true,
      analysis,
      examType,
      analyzedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[영상판독] 오류:', error)
    return c.json({
      error: '영상 분석 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// Cloudflare Workers Cron Job (매주 일요일 오전 2시 실행)
export default {
  ...app,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log('Running scheduled auto-update...')
    
    // 주요 보험사 URL 목록
    const insuranceCompanies = [
      { code: 'SAMSUNG', url: 'https://www.samsungfire.com' },
      { code: 'HYUNDAI', url: 'https://www.hi.co.kr' },
      { code: 'DB', url: 'https://www.idbins.com' },
      // 추가 보험사...
    ]
    
    for (const company of insuranceCompanies) {
      try {
        await runAutoUpdate(
          {
            DB: env.DB,
            OPENAI_API_KEY: env.OPENAI_API_KEY
          },
          company.url,
          company.code
        )
        
        // 각 회사 간 1초 대기 (Rate limiting)
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Failed to update ${company.code}:`, error)
      }
    }
    
    console.log('Scheduled auto-update completed')
  }
} as ExportedHandler<Bindings>
