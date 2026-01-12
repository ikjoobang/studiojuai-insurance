-- 보험사별 수술 보장 정보 테이블
CREATE TABLE IF NOT EXISTS insurance_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surgery_name TEXT NOT NULL,           -- 수술명 (예: "백내장", "심근경색")
  surgery_code TEXT,                     -- 수술 코드 (예: "S5110", ICD-10)
  company_name TEXT NOT NULL,            -- 보험사명 (예: "삼성화재")
  coverage_amount TEXT NOT NULL,         -- 보장 한도 (예: "최대 1,000만원")
  coverage_options TEXT,                 -- 선택 옵션 (예: "500만/1,000만/2,000만")
  coverage_type TEXT,                    -- 특약 유형 (예: "1-5종 수술비", "27대 수술비")
  source_url TEXT,                       -- 출처 URL (약관 링크)
  notes TEXT,                            -- 추가 설명
  updated_by TEXT,                       -- 수정자 (선택)
  verified BOOLEAN DEFAULT 0,            -- 검증 여부 (0: 미검증, 1: 검증됨)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_surgery_name ON insurance_coverage(surgery_name);
CREATE INDEX IF NOT EXISTS idx_surgery_code ON insurance_coverage(surgery_code);
CREATE INDEX IF NOT EXISTS idx_company_name ON insurance_coverage(company_name);
CREATE INDEX IF NOT EXISTS idx_verified ON insurance_coverage(verified);

-- 검색 로그 테이블 (기존)
CREATE TABLE IF NOT EXISTS search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surgery_name TEXT NOT NULL,
  surgery_code TEXT,
  search_count INTEGER DEFAULT 1,
  last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(surgery_name, surgery_code)
);

CREATE INDEX IF NOT EXISTS idx_search_count ON search_logs(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_last_searched ON search_logs(last_searched_at DESC);
