-- 보험사 정보 테이블
CREATE TABLE IF NOT EXISTS insurance_companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 수술 기본 정보 테이블
CREATE TABLE IF NOT EXISTS surgeries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  edi_code TEXT,
  kcd_code TEXT,
  medical_classification TEXT,
  difficulty_level INTEGER, -- 1-5종 분류
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1-5종 수술비 특약 정보
CREATE TABLE IF NOT EXISTS surgery_type_benefits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insurance_company_id INTEGER NOT NULL,
  surgery_id INTEGER NOT NULL,
  benefit_name TEXT NOT NULL, -- 특약명 (예: 1-5종수술비, 1-8종수술비)
  surgery_type INTEGER NOT NULL, -- 몇 종 수술인지 (1-5 또는 1-8)
  benefit_amount INTEGER, -- 보장금액 (원)
  benefit_conditions TEXT, -- 보장조건
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insurance_company_id) REFERENCES insurance_companies(id),
  FOREIGN KEY (surgery_id) REFERENCES surgeries(id)
);

-- N대 수술비 특약 정보
CREATE TABLE IF NOT EXISTS n_surgery_benefits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  insurance_company_id INTEGER NOT NULL,
  total_n INTEGER NOT NULL, -- 전체 N대 (예: 111, 119, 144)
  benefit_structure TEXT NOT NULL, -- 구성 (예: 27+11+59+43+다빈도4)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (insurance_company_id) REFERENCES insurance_companies(id)
);

-- N대 수술비 특약 상세 (수술별)
CREATE TABLE IF NOT EXISTS n_surgery_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  n_benefit_id INTEGER NOT NULL,
  surgery_id INTEGER NOT NULL,
  is_covered BOOLEAN DEFAULT 0, -- 보장 여부
  sub_category TEXT, -- 세부등급 (예: 27대, 11대, 59대, 43대, 다빈도4대)
  benefit_amount INTEGER, -- 보장금액
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (n_benefit_id) REFERENCES n_surgery_benefits(id),
  FOREIGN KEY (surgery_id) REFERENCES surgeries(id)
);

-- 수술 리스크 정보
CREATE TABLE IF NOT EXISTS surgery_risks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surgery_id INTEGER NOT NULL,
  recurrence_risk TEXT, -- 재발 가능성 (높음/보통/낮음)
  recurrence_description TEXT,
  reoperation_risk TEXT, -- 재수술 필요성
  complication_risk TEXT, -- 합병증 위험
  additional_treatment TEXT, -- 추가 치료 가능성
  insurance_notes TEXT, -- 보험 청구 시 주의사항
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (surgery_id) REFERENCES surgeries(id)
);

-- 검색 로그 (분석 기록)
CREATE TABLE IF NOT EXISTS search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surgery_name TEXT NOT NULL,
  surgery_code TEXT,
  search_count INTEGER DEFAULT 1,
  last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_surgeries_name ON surgeries(name);
CREATE INDEX IF NOT EXISTS idx_surgeries_edi_code ON surgeries(edi_code);
CREATE INDEX IF NOT EXISTS idx_surgeries_kcd_code ON surgeries(kcd_code);
CREATE INDEX IF NOT EXISTS idx_surgery_type_benefits_company ON surgery_type_benefits(insurance_company_id);
CREATE INDEX IF NOT EXISTS idx_surgery_type_benefits_surgery ON surgery_type_benefits(surgery_id);
CREATE INDEX IF NOT EXISTS idx_n_surgery_details_benefit ON n_surgery_details(n_benefit_id);
CREATE INDEX IF NOT EXISTS idx_n_surgery_details_surgery ON n_surgery_details(surgery_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_name ON search_logs(surgery_name);
