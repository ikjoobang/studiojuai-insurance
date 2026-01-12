-- 보험사 기본 데이터 입력
INSERT OR IGNORE INTO insurance_companies (code, name, name_en) VALUES 
  ('SAMSUNG', '삼성화재', 'Samsung Fire & Marine Insurance'),
  ('HYUNDAI', '현대해상', 'Hyundai Marine & Fire Insurance'),
  ('DB', 'DB손보', 'DB Insurance'),
  ('KB', 'KB손보', 'KB Insurance'),
  ('NH', '농협손보', 'NH Insurance'),
  ('HANWHA', '한화손보', 'Hanwha General Insurance'),
  ('MERITZ', '메리츠화재', 'Meritz Fire & Marine Insurance'),
  ('DONGBU', '동부손보', 'Dongbu Insurance'),
  ('LOTTE', '롯데손보', 'Lotte Insurance'),
  ('HEUNGKUK', '흥국화재', 'Heungkuk Fire & Marine Insurance'),
  ('MG', 'MG손보', 'MG Insurance');

-- N대 수술비 특약 기본 구조 입력
INSERT OR IGNORE INTO n_surgery_benefits (insurance_company_id, total_n, benefit_structure)
VALUES
  (1, 111, '27+11+46+24+3'),
  (2, 119, '27+11+59+19+3'),
  (3, 119, '27+11+59+19+3'),
  (4, 112, '27+11+53+18+3'),
  (5, 144, '27+11+59+43+다빈도4'),
  (6, 124, '27+11+64+19+3'),
  (7, 119, '27+11+59+19+3'),
  (8, 119, '27+11+59+19+3'),
  (9, 112, '27+11+53+18+3'),
  (10, 112, '27+11+53+18+3'),
  (11, 119, '27+11+59+19+3');

-- 샘플 수술 데이터 (자주 조회되는 수술들)
INSERT OR IGNORE INTO surgeries (name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description) VALUES
  ('백내장 수술', 'Cataract Surgery', 'S5061', 'H25', '안과 수술', 4, '수정체 혼탁 제거 및 인공수정체 삽입술'),
  ('충수절제술 (맹장수술)', 'Appendectomy', 'Q2801', 'K35', '복부 수술', 3, '충수돌기 절제술'),
  ('제왕절개술', 'Cesarean Section', 'R4562', 'O82', '산부인과 수술', 3, '제왕절개 분만'),
  ('치핵 근치수술 (치질수술)', 'Hemorrhoidectomy', 'Q2851', 'K64', '항문 수술', 3, '내치핵 또는 외치핵 절제술'),
  ('반월상연골판 절제술', 'Meniscectomy', 'N2721', 'M23', '정형외과 수술', 3, '무릎 반월상 연골 절제술'),
  ('담낭절제술', 'Cholecystectomy', 'Q2811', 'K80', '복부 수술', 3, '담낭 제거술 (복강경 또는 개복)'),
  ('자궁근종 절제술', 'Myomectomy', 'R3031', 'D25', '산부인과 수술', 3, '자궁 근종 제거술'),
  ('갑상선 절제술', 'Thyroidectomy', 'P2261', 'E04', '내분비외과 수술', 2, '갑상선 부분 또는 전체 절제술'),
  ('척추 후궁절제술', 'Laminectomy', 'N1493', 'M48', '척추 수술', 2, '척추 후궁 제거술 (디스크 치료)'),
  ('관상동맥우회술', 'CABG', 'O1641', 'I25', '심장 수술', 1, '관상동맥 우회로 이식술');

-- 검색 로그 초기화
INSERT OR IGNORE INTO search_logs (surgery_name, surgery_code, search_count) VALUES
  ('백내장 수술', 'S5061', 0),
  ('충수절제술', 'Q2801', 0),
  ('제왕절개술', 'R4562', 0);
