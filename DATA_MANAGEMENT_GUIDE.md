# 데이터 관리 가이드

## 📌 개요

이 문서는 보험 수술비 특약 분석 시스템의 데이터를 추가하고 관리하는 방법을 설명합니다.

## 🔍 왜 API 연동이 아니라 직접 데이터베이스 구축인가?

### 국내 보험사 API 현황
❌ **공개 API 없음**: 국내 보험사들은 수술비 특약 정보를 API로 제공하지 않습니다  
❌ **실시간 동기화 불가**: 약관은 PDF 문서로만 제공되며 구조화된 데이터가 없습니다  
❌ **자동 파싱 어려움**: 보험 약관의 법률 용어와 복잡한 구조는 자동 파싱이 거의 불가능합니다

### 해결 방안
✅ **전문가 기반 데이터베이스**: 보험 전문가가 직접 약관을 분석하고 입력  
✅ **검증된 정보**: 실제 보험금 지급 사례와 대조하여 검증  
✅ **체계적 관리**: 구조화된 데이터베이스로 빠른 검색과 비교 가능

## 📊 데이터 수집 프로세스

### 1단계: 수술 정보 수집

#### 주요 정보원
- **건강보험심사평가원**: EDI 코드, 수가 정보
- **한국표준질병사인분류(KCD)**: 질병 분류 코드
- **의료기관**: 수술 상세 정보, 의학적 분류

#### 필수 수집 항목
```
✓ 수술명 (한글 표준명)
✓ 수술명 (영문)
✓ EDI 코드 (건강보험 수가코드)
✓ KCD 코드 (질병분류코드)
✓ 의학적 분류 (안과, 정형외과 등)
✓ 난이도 (1-5종 분류)
✓ 수술 설명
```

#### 예시: 백내장 수술 정보 수집
```
수술명: 백내장 수술
영문명: Cataract Surgery
EDI 코드: S5061
KCD 코드: H25
의학적 분류: 안과 수술
난이도: 4종 수술
설명: 수정체 혼탁 제거 및 인공수정체 삽입술
```

### 2단계: 보험사 약관 분석

#### 약관 입수 방법
1. **보험사 공식 홈페이지**: 약관 다운로드 페이지
2. **금융감독원 파인**: 통합 약관 조회
3. **보험개발원**: 표준약관 확인

#### 1-5종 수술비 특약 분석
각 보험사별로 다음 정보 확인:
```
✓ 특약명 (예: 질병 1-5종수술비 특약)
✓ 해당 수술의 종 분류 (1종~5종)
✓ 종별 보장금액
✓ 보장조건 (면책기간, 감액기간 등)
```

#### N대 수술비 특약 분석
```
✓ 전체 N대 개수 (예: 111대, 119대, 144대)
✓ 세부등급 구조 (예: 27+11+59+43+다빈도4)
✓ 해당 수술이 속하는 세부등급 (예: 27대, 59대)
✓ 보장금액
✓ 보장 여부
```

### 3단계: 리스크 정보 조사

#### 의학 문헌 조사
- 재발률 통계
- 재수술 필요성
- 주요 합병증 및 발생 확률
- 후속 치료 가능성

#### 보험 청구 실무 경험
- 거절 사유 분석
- 까다로운 조건
- 주의사항

## 💾 데이터 입력 방법

### 방법 1: Wrangler CLI 사용 (권장)

#### 수술 정보 추가
```bash
cd /home/user/webapp

npx wrangler d1 execute webapp-production --local --command="
INSERT INTO surgeries (name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description)
VALUES (
  '백내장 수술',
  'Cataract Surgery',
  'S5061',
  'H25',
  '안과 수술',
  4,
  '수정체 혼탁 제거 및 인공수정체 삽입술'
);
"
```

#### 1-5종 특약 정보 추가
```bash
# 먼저 수술 ID와 보험사 ID 확인
npx wrangler d1 execute webapp-production --local --command="
SELECT id, name FROM surgeries WHERE name = '백내장 수술';
"
# 결과: id=1

npx wrangler d1 execute webapp-production --local --command="
SELECT id, name FROM insurance_companies WHERE code = 'SAMSUNG';
"
# 결과: id=1

# 특약 정보 입력
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO surgery_type_benefits 
(insurance_company_id, surgery_id, benefit_name, surgery_type, benefit_amount, benefit_conditions)
VALUES (
  1,
  1,
  '질병 1-5종수술비 특약',
  4,
  500000,
  '계약일로부터 90일 경과 후 보장'
);
"
```

#### N대 특약 정보 추가
```bash
# N대 특약 구조 ID 확인
npx wrangler d1 execute webapp-production --local --command="
SELECT id, total_n FROM n_surgery_benefits 
WHERE insurance_company_id = 1;
"
# 결과: id=1 (삼성화재 111대)

# 세부 정보 입력
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO n_surgery_details 
(n_benefit_id, surgery_id, is_covered, sub_category, benefit_amount, notes)
VALUES (
  1,
  1,
  1,
  '27대',
  1000000,
  '백내장 수술은 27대 수술에 포함'
);
"
```

#### 리스크 정보 추가
```bash
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO surgery_risks 
(surgery_id, recurrence_risk, recurrence_description, reoperation_risk, complication_risk, additional_treatment, insurance_notes)
VALUES (
  1,
  '낮음',
  '백내장은 재발하지 않으나 후발성 백내장 발생 가능',
  '후발성 백내장 발생 시 YAG 레이저 시술 필요 (재수술 아님)',
  '낮음 - 안내염, 망막박리 등 합병증 발생률 1% 미만',
  '시력 저하 시 안경 처방 필요',
  '수술 전후 검사비용은 별도 청구 가능'
);
"
```

### 방법 2: REST API 사용

#### 수술 정보 추가
```bash
curl -X POST http://localhost:3000/api/admin/surgery \
  -H "Content-Type: application/json" \
  -d '{
    "name": "백내장 수술",
    "name_en": "Cataract Surgery",
    "edi_code": "S5061",
    "kcd_code": "H25",
    "medical_classification": "안과 수술",
    "difficulty_level": 4,
    "description": "수정체 혼탁 제거 및 인공수정체 삽입술"
  }'
```

#### 1-5종 특약 정보 추가
```bash
curl -X POST http://localhost:3000/api/admin/type-benefit \
  -H "Content-Type: application/json" \
  -d '{
    "insurance_company_id": 1,
    "surgery_id": 1,
    "benefit_name": "질병 1-5종수술비 특약",
    "surgery_type": 4,
    "benefit_amount": 500000,
    "benefit_conditions": "계약일로부터 90일 경과 후 보장"
  }'
```

#### N대 특약 상세 추가
```bash
curl -X POST http://localhost:3000/api/admin/n-benefit-detail \
  -H "Content-Type: application/json" \
  -d '{
    "n_benefit_id": 1,
    "surgery_id": 1,
    "is_covered": true,
    "sub_category": "27대",
    "benefit_amount": 1000000,
    "notes": "백내장 수술은 27대 수술에 포함"
  }'
```

### 방법 3: SQL 파일 사용 (대량 입력)

#### bulk_insert.sql 파일 생성
```sql
-- 수술 정보 여러 개 동시 입력
INSERT INTO surgeries (name, name_en, edi_code, kcd_code, medical_classification, difficulty_level, description)
VALUES 
  ('백내장 수술', 'Cataract Surgery', 'S5061', 'H25', '안과 수술', 4, '수정체 혼탁 제거 및 인공수정체 삽입술'),
  ('녹내장 수술', 'Glaucoma Surgery', 'S5071', 'H40', '안과 수술', 3, '안압 조절을 위한 수술'),
  ('망막박리 수술', 'Retinal Detachment Surgery', 'S5091', 'H33', '안과 수술', 2, '박리된 망막 복원 수술');

-- 1-5종 특약 정보 일괄 입력 (삼성화재 예시)
INSERT INTO surgery_type_benefits (insurance_company_id, surgery_id, benefit_name, surgery_type, benefit_amount, benefit_conditions)
VALUES 
  (1, 1, '질병 1-5종수술비', 4, 500000, '90일 경과 후'),
  (1, 2, '질병 1-5종수술비', 3, 700000, '90일 경과 후'),
  (1, 3, '질병 1-5종수술비', 2, 1000000, '90일 경과 후');
```

#### 실행
```bash
npx wrangler d1 execute webapp-production --local --file=./bulk_insert.sql
```

## 📋 데이터 입력 체크리스트

### 새로운 수술 추가 시
- [ ] 수술 기본 정보 입력 (surgeries 테이블)
- [ ] 11개 보험사별 1-5종 특약 정보 조사 및 입력
- [ ] 11개 보험사별 N대 특약 포함 여부 확인 및 입력
- [ ] 리스크 정보 조사 및 입력
- [ ] 실제 데이터로 검색 및 리포트 테스트
- [ ] 검증 완료 후 production 데이터베이스에 동기화

### 보험사 약관 변경 시
- [ ] 변경된 약관 다운로드 및 분석
- [ ] 영향받는 수술 목록 확인
- [ ] 변경된 정보 업데이트 (UPDATE 쿼리)
- [ ] 변경 이력 기록
- [ ] 사용자에게 업데이트 공지

## 🔧 데이터 관리 스크립트

### 모든 수술 목록 조회
```bash
npx wrangler d1 execute webapp-production --local --command="
SELECT id, name, edi_code, difficulty_level FROM surgeries ORDER BY name;
"
```

### 특정 보험사의 특약 정보 조회
```bash
npx wrangler d1 execute webapp-production --local --command="
SELECT 
  s.name as surgery_name,
  stb.benefit_name,
  stb.surgery_type,
  stb.benefit_amount
FROM surgery_type_benefits stb
JOIN surgeries s ON stb.surgery_id = s.id
JOIN insurance_companies ic ON stb.insurance_company_id = ic.id
WHERE ic.code = 'SAMSUNG'
ORDER BY s.name;
"
```

### 데이터 업데이트
```bash
npx wrangler d1 execute webapp-production --local --command="
UPDATE surgery_type_benefits 
SET benefit_amount = 600000, updated_at = CURRENT_TIMESTAMP
WHERE insurance_company_id = 1 AND surgery_id = 1;
"
```

### 데이터 삭제 (주의!)
```bash
npx wrangler d1 execute webapp-production --local --command="
DELETE FROM surgery_type_benefits WHERE id = 10;
"
```

## 🎯 권장 데이터 입력 순서

### 단계 1: 주요 수술 50개 입력
1. 안과 수술 (백내장, 녹내장, 망막박리 등)
2. 정형외과 수술 (무릎, 어깨, 척추 등)
3. 소화기 수술 (맹장, 담낭, 위 등)
4. 산부인과 수술 (제왕절개, 자궁근종 등)
5. 심혈관 수술 (스텐트, 관상동맥우회술 등)

### 단계 2: 보험사 특약 정보 입력
- 각 수술당 11개 보험사 데이터 입력
- 1-5종 특약 우선 입력
- N대 특약은 주요 수술부터 입력

### 단계 3: 리스크 정보 추가
- 의학 문헌 조사 결과 입력
- 실무 경험 기반 주의사항 추가

### 단계 4: 검증 및 테스트
- 실제 시스템에서 검색 및 리포트 테스트
- 보험금 지급 사례와 비교
- 오류 수정

## 📊 데이터 품질 관리

### 주기적 점검 항목
- [ ] 보험사 약관 변경 사항 모니터링 (분기별)
- [ ] 새로운 수술 추가 (월별)
- [ ] 보험금 지급 사례 검증 (월별)
- [ ] 사용자 피드백 반영 (즉시)

### 데이터 정확성 검증
```bash
# 입력된 데이터 통계
npx wrangler d1 execute webapp-production --local --command="
SELECT 
  (SELECT COUNT(*) FROM surgeries) as total_surgeries,
  (SELECT COUNT(*) FROM surgery_type_benefits) as type_benefits,
  (SELECT COUNT(*) FROM n_surgery_details) as n_benefit_details,
  (SELECT COUNT(*) FROM surgery_risks) as risk_data;
"
```

## 🚀 Production 배포 시

### Local → Production 동기화
```bash
# 1. Local 데이터베이스 백업
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/placeholder.sqlite .dump > backup.sql

# 2. Production 마이그레이션
npm run db:migrate:prod

# 3. Production에 데이터 입력
# (API 또는 wrangler --remote 사용)
npx wrangler d1 execute webapp-production --remote --file=./backup.sql
```

## 💡 유용한 팁

### 1. 데이터 입력 자동화
Python 스크립트로 엑셀 파일을 SQL로 변환하여 대량 입력 가능

### 2. 약관 PDF 파싱
Adobe Acrobat의 텍스트 추출 기능 활용하여 약관 내용 추출

### 3. 검증 도구
실제 보험금 지급 내역서와 시스템 리포트 비교

### 4. 버전 관리
주요 약관 변경 시 변경 이력을 별도 테이블에 기록

## ❓ FAQ

**Q: 모든 보험사 데이터를 입력해야 하나요?**  
A: 초기에는 주요 3-4개 보험사만 입력하고 점진적으로 확대 가능

**Q: 약관이 변경되면 어떻게 하나요?**  
A: UPDATE 쿼리로 기존 데이터 수정하고, 변경 이력 기록

**Q: API로 입력하는 것과 CLI로 입력하는 것 중 어느 것이 좋나요?**  
A: 소량 데이터는 CLI, 대량 데이터는 SQL 파일, 웹 UI는 API 권장

**Q: 데이터 백업은 어떻게 하나요?**  
A: `sqlite3 .dump` 명령으로 정기적 백업 필요

## 📞 지원

데이터 입력 중 문제가 발생하면:
1. 로그 확인: `~/.config/.wrangler/logs/`
2. 데이터베이스 상태 확인: `npm run db:console:local`
3. 초기화 후 재시도: `npm run db:reset`

---

**작성일**: 2025-11-11  
**버전**: 1.0.0
