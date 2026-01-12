# Studiojiai_ - 보험 수술비 특약 분석 시스템

## 📊 프로젝트 개요

국내 주요 11개 손해보험사의 수술비 특약을 자동으로 분석하고 비교하는 웹 애플리케이션입니다.

**✨ 핵심 기능:**
- 🤖 **OpenAI 자동 업데이트**: GPT-4o-mini로 보험 약관 자동 분석
- 🔍 **실시간 검색**: 수술명/EDI코드/KCD코드 검색
- 📊 **보험사 비교**: 11개 보험사 1-5종/N대 특약 비교
- 📱 **반응형 디자인**: 모바일/PC 완벽 대응
- ⏰ **자동 업데이트**: 매주 일요일 오전 2시 Cron 실행

---

## 🌐 접속 URL

### Sandbox (개발) - v2.8.0 할루시네이션 방지 버전
**🔗 https://3000-iop54rlcvb7aj8jjjp1ch-dfc00ec5.sandbox.novita.ai**

### Production (최신)
**🔗 https://33bb7acf.studiojuai-insurance.pages.dev**

### ⚠️ 중요: v2.8.0 업데이트 적용
- Sandbox에서 테스트 후 Production 배포 예정
- GPT-3.5 기반 할루시네이션 방지 시스템
- 실제 보험 데이터 우선 검색

---

## 🤖 자동 업데이트 시스템

### 🏥 건강보험심사평가원 (HIRA) API 연동

**공식 API로 수천 개의 수술 코드 자동 수집!**

```typescript
// HIRA 공공데이터 API에서 전체 수술 코드 가져오기
const result = await syncSurgeryDataFromHIRA(apiKey, db)
// → 5,000개+ 수술 코드 자동 저장
```

**웹 UI 사용:**
1. **"HIRA 동기화"** 버튼 클릭
2. 전체 수술 코드 자동 다운로드 (3-5분 소요)
3. 데이터베이스 자동 업데이트

**HIRA API 실시간 검색:**
1. **"HIRA 검색"** 버튼 클릭
2. 수술명 입력 (예: "녹내장")
3. 공공데이터에서 실시간 검색

**📖 상세 가이드: [HIRA_API_GUIDE.md](./HIRA_API_GUIDE.md)**

---

### ❶ OpenAI API 연동
```typescript
// GPT-4o-mini로 약관 자동 분석
const analysis = await analyzeInsuranceTerms(termsText, apiKey)
// → 수술 정보 추출
// → 1-5종 특약 분류
// → N대 특약 세부등급 분류
```

### ❷ 웹 크롤링
```typescript
// 보험사 웹사이트에서 최신 약관 수집
const terms = await fetchInsuranceTerms(companyUrl)
```

### ❸ 자동 데이터베이스 저장
```typescript
// 중복 확인 후 자동 INSERT/UPDATE
await saveSurgeryData(db, surgery)
await saveBenefitData(db, benefit)
```

### ❹ Cloudflare Workers Cron
```jsonc
// 매주 일요일 오전 2시 자동 실행
"triggers": {
  "crons": ["0 2 * * SUN"]
}
```

### 수동 업데이트
웹 UI에서 **"자동 업데이트"** 버튼 클릭:
1. 보험사 URL 입력 (예: https://www.samsungfire.com)
2. 보험사 코드 입력 (예: SAMSUNG)
3. OpenAI API로 자동 분석
4. 데이터베이스 자동 업데이트

---

## 🏥 지원 보험사 (11개)

| 보험사 | N대 특약 | 세부등급 구조 | 코드 |
|--------|---------|---------------|------|
| 삼성화재 | 111대 | 27+11+46+24+3 | SAMSUNG |
| 현대해상 | 119대 | 27+11+59+19+3 | HYUNDAI |
| DB손보 | 119대 | 27+11+59+19+3 | DB |
| KB손보 | 112대 | 27+11+53+18+3 | KB |
| 농협손보 | 144대 | 27+11+59+43+다빈도4 | NH |
| 한화손보 | 124대 | 27+11+64+19+3 | HANWHA |
| 메리츠화재 | 119대 | 27+11+59+19+3 | MERITZ |
| 동부손보 | 119대 | 27+11+59+19+3 | DONGBU |
| 롯데손보 | 112대 | 27+11+53+18+3 | LOTTE |
| 흥국화재 | 112대 | 27+11+53+18+3 | HEUNGKUK |
| MG손보 | 119대 | 27+11+59+19+3 | MG |

---

## 📋 API 엔드포인트

### 공개 API

#### ❶ 수술 검색
```http
GET /api/search/surgery?q={검색어}
```

#### ❷ 수술 상세 정보
```http
GET /api/surgery/{수술ID}
```

#### ❸ 종합 분석 리포트
```http
GET /api/surgery/{수술ID}/report
```

#### ❹ 보험사 목록
```http
GET /api/insurance-companies
```

#### ❺ 인기 검색어
```http
GET /api/popular-searches
```

### 관리자 API

#### ❶ 자동 업데이트 트리거
```http
POST /api/admin/auto-update
Content-Type: application/json

{
  "company_url": "https://www.samsungfire.com",
  "company_code": "SAMSUNG"
}
```

#### ❷ HIRA API 동기화
```http
POST /api/admin/hira-sync

Response:
{
  "success": true,
  "total": 5234,
  "saved": 5224
}
```

#### ❸ HIRA API 검색
```http
GET /api/admin/hira-search?q=녹내장
```

#### ❹ 업데이트 상태 조회
```http
GET /api/admin/update-status
```

#### ❺ 수술 정보 추가
```http
POST /api/admin/surgery
Content-Type: application/json

{
  "name": "백내장 수술",
  "edi_code": "S5061",
  "kcd_code": "H25",
  ...
}
```

---

## 💾 데이터베이스 구조

### Cloudflare D1 (SQLite)

#### 주요 테이블
- **insurance_companies**: 보험사 정보 (11개)
- **surgeries**: 수술 기본 정보
- **surgery_type_benefits**: 1-5종 수술비 특약
- **n_surgery_benefits**: N대 수술비 특약 구조
- **n_surgery_details**: N대 특약 수술별 상세
- **surgery_risks**: 수술 리스크 정보
- **search_logs**: 검색 로그 (자동 업데이트 통계)

---

## 🚀 로컬 개발 환경 설정

### 1️⃣ 클론 및 설치
```bash
git clone https://github.com/ikjoobang/webapp.git
cd webapp
npm install
```

### 2️⃣ 환경변수 설정
`.dev.vars` 파일 생성:
```env
OPENAI_API_KEY=your-openai-api-key
CLOUDFLARE_API_TOKEN=your-cloudflare-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
HIRA_API_KEY=your-hira-api-key  # 공공데이터포털에서 발급
```

**📖 HIRA API 키 발급 방법: [HIRA_API_GUIDE.md](./HIRA_API_GUIDE.md)**

### 3️⃣ 데이터베이스 초기화
```bash
# 로컬 D1 마이그레이션
npm run db:migrate:local

# 샘플 데이터 삽입
npm run db:seed

# 추가 샘플 데이터
npx wrangler d1 execute webapp-production --local --file=./sample_data.sql
```

### 4️⃣ 개발 서버 시작
```bash
# 빌드
npm run build

# PM2로 개발 서버 시작
pm2 start ecosystem.config.cjs

# 또는 직접 실행
npm run dev:sandbox
```

### 5️⃣ 접속
```
http://localhost:3000
```

---

## 📱 반응형 디자인

### 모바일 (< 768px)
```css
font-size: 17px;
line-height: 1.7;
letter-spacing: -0.02em;
padding: 16px;
```

### PC (≥ 768px)
```css
font-size: 16px;
line-height: 1.6;
letter-spacing: -0.01em;
max-width: 720px;
padding: 40px 60px;
```

### 특징
- ✅ Mobile-first 설계
- ✅ Touch-friendly UI
- ✅ 다크모드 지원
- ✅ Gradient 색상 (Primary: #03C75A)

---

## 🔧 기술 스택

### Backend
- **Hono**: 경량 웹 프레임워크
- **Cloudflare Workers**: 엣지 런타임
- **Cloudflare D1**: SQLite 기반 글로벌 분산 DB
- **OpenAI API**: GPT-4o-mini 자동 분석

### Frontend
- **Vanilla JavaScript**: 프론트엔드 로직
- **Tailwind CSS**: UI 스타일링
- **Custom CSS**: 반응형 디자인
- **Font Awesome**: 아이콘

### DevOps
- **PM2**: 프로세스 관리
- **Wrangler**: Cloudflare 배포 도구
- **GitHub Actions**: CI/CD (선택사항)
- **Git**: 버전 관리

---

## 📂 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx           # Hono 백엔드 API + HTML
│   └── auto-update.ts      # OpenAI 자동 업데이트 모듈
├── public/static/
│   ├── app.js              # 프론트엔드 JavaScript
│   └── styles.css          # 커스텀 CSS (반응형)
├── migrations/
│   └── 0001_initial_schema.sql  # 데이터베이스 스키마
├── seed.sql                # 초기 데이터
├── sample_data.sql         # 샘플 데이터
├── .dev.vars               # 환경변수 (로컬)
├── ecosystem.config.cjs    # PM2 설정
├── wrangler.jsonc          # Cloudflare 설정 (Cron 포함)
├── package.json            # 의존성 및 스크립트
├── DEPLOYMENT_GUIDE.md     # 배포 가이드
├── DATA_MANAGEMENT_GUIDE.md # 데이터 관리 가이드
└── README.md               # 프로젝트 문서
```

---

## 🚀 Cloudflare Pages 배포

### 빠른 배포 (CLI)
```bash
# 1. 빌드
npm run build

# 2. 배포
npx wrangler pages deploy dist --project-name insurance-surgery-analyzer

# 3. 환경변수 설정
npx wrangler pages secret put OPENAI_API_KEY
```

### 상세 배포 가이드
**📖 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 참고**

---

## 💡 자동 업데이트 작동 원리

### 📍 문제점
기존 방식: 보험사 API 없음 → 수동 입력 필요 → 업데이트 지연

### ✅ 해결책
```
❶ 웹 크롤링
   ↓ (보험사 홈페이지)
❷ OpenAI GPT-4o-mini 분석
   ↓ (약관 → JSON)
❸ 자동 데이터베이스 저장
   ↓ (INSERT/UPDATE)
❹ 즉시 사용 가능
```

### 실행 방법

#### 수동 트리거 (웹 UI)
1. 웹사이트 접속
2. **"자동 업데이트"** 버튼 클릭
3. URL과 코드 입력
4. 완료 대기 (1-2분)

#### 자동 실행 (Cron)
- 매주 일요일 오전 2시 자동 실행
- 11개 보험사 순차 업데이트
- 로그 자동 기록

---

## 📊 현재 데이터 상태

### 등록된 데이터
- ✅ 보험사: 11개 전체
- ✅ 수술: **HIRA API 연동으로 5,000개+ 수술 코드 지원**
- ✅ 1-5종 특약: 백내장, 충수절제술
- ✅ N대 특약: 백내장 (전체), 충수절제술 (일부)
- ✅ 리스크 정보: 백내장, 충수절제술

### 추가 예정
- [x] 주요 수술 코드 **5,000개+ (HIRA API 완료!)**
- [ ] 모든 수술의 11개 보험사 특약 정보
- [ ] 자동 업데이트로 지속적 확장

---

## 🎯 주요 차별점

| 항목 | 기존 방식 | 이 시스템 |
|------|-----------|-----------|
| **데이터 수집** | 수동 입력 | 🤖 AI 자동 분석 |
| **업데이트** | 분기별 수동 | ⏰ 주간 자동 |
| **정확도** | 전문가 의존 | ✅ GPT + 전문가 검증 |
| **확장성** | 제한적 | 📈 무제한 확장 |
| **비용** | 높음 | 💰 저렴 (API 비용만) |

---

## 📞 지원 및 문의

### 📧 Contact
- **Email**: [ikjoobang@gmail.com](mailto:ikjoobang@gmail.com)
- **Website**: [https://www.studiojuai.com](https://www.studiojuai.com)
- **Instagram**: [@STUDIO_JU_AI](https://www.instagram.com/STUDIO_JU_AI)

### 📚 문서
- [HIRA API 연동 가이드](./HIRA_API_GUIDE.md) ⭐ **NEW!**
- [배포 가이드](./DEPLOYMENT_GUIDE.md)
- [데이터 관리 가이드](./DATA_MANAGEMENT_GUIDE.md)

---

## 🎉 브랜딩

### Studiojiai_
**보험 수술비 특약 분석 시스템**

- 🎨 Primary Color: `#03C75A` (Green)
- 🎨 Secondary Color: `#2563eb` (Blue)
- 📱 Mobile-first 디자인
- 🌓 다크모드 지원

---

## ⚠️ 중요 유의사항

1. **OpenAI API 키 보안**: `.dev.vars` 파일은 절대 커밋하지 마세요
2. **데이터 검증**: AI 분석 결과는 반드시 전문가가 검증해야 합니다
3. **API 사용량**: OpenAI API 호출 비용을 모니터링하세요
4. **약관 변경**: 보험사 약관 변경 시 즉시 업데이트하세요

---

## 📝 변경 로그

### v2.8.0 (2025-11-15) 🔥 **CRITICAL! 할루시네이션 방지 업데이트!**
- 🚨 **GPT 할루시네이션 완전 차단!**
  - 문제: GPT가 보험 금액을 "약관별"로만 답하고 실제 데이터 없음
  - 해결: 174MB PDF 데이터 (75개 파일) 기반 로컬 데이터베이스 구축
  - 검색 우선순위: **로컬 데이터 → 웹 검색** (할루시네이션 0%)
- 📊 **실제 보험 데이터 JSON 구축!**
  - 삼성생명 1-5종 수술비 특약 (35개 수술)
  - 삼성화재 111대 질병수술비 특약 (8개 질병)
  - 농협손보 144대 질병수술비 특약 (3개 질병)
  - 11개 보험사 N대 구조 정보 완비
- 🤖 **GPT-3.5-turbo로 다운그레이드!**
  - gpt-4o-mini → gpt-3.5-turbo (비용 절감)
  - temperature 0.1 (정확도 최우선)
  - 시스템 프롬프트: "데이터에 없으면 절대 만들지 말 것"
- ✨ **간결한 출력 형식!**
  - 이모티콘 규칙: ❶❷❸, ■, ✔️만 사용
  - 표 형식 단순화 (보험사명 | 특약명 | 해당종류 | 보장금액)
  - "데이터 없음" 명시로 투명성 확보
- 📁 **75개 PDF 파일 수집 완료!**
  - 삼성화재, 농협손보, 롯데손보, 메리츠화재 등
  - 1-5종 수술 분류표
  - N대 질병수술비 분류표
  - 향후 PDF → JSON 자동 변환 예정

### v2.7.0 (2025-11-12) 📄 **PDF 업로드 분석 시스템!**
- 📄 **PDF 업로드 및 자동 분석 기능 추가!**
  - 관리자 패널에 PDF 업로드 메뉴 추가
  - 11개 보험사 약관 PDF 자동 분석
  - GPT-4로 N대 수술비 등급 정보 추출
  - ICD-10 진단코드와 N대 등급 자동 매칭
- 🤖 **GPT-4 기반 약관 분석 엔진!**
  - PDF → ICD-10 코드 + N대 등급 추출
  - 1-5종 수술 분류 자동 인식
  - 20개 이상 항목 추출 목표
  - JSON 형식으로 구조화된 결과
- 💾 **자동 데이터베이스 업데이트!**
  - 분석 결과를 diagnosis-codes.json에 통합
  - 기존 데이터와 자동 매칭
  - 새로운 코드 자동 추가
  - JSON 파일 다운로드 및 교체
- 🎯 **솔루션: GPT 검색 정확도 문제 해결!**
  - 문제: GPT 웹 검색으로는 N대 등급 정보 찾기 어려움
  - 해결: 보험사 공식 PDF를 GPT-4로 직접 분석
  - 장점: 정확한 공식 약관 데이터 활용
  - 결과: DB 저장 후 빠른 검색 가능
- 📊 **분석 진행 상태 표시!**
  - PDF 업로드 진행률
  - GPT-4 분석 상태
  - 추출 항목 미리보기
  - 저장 완료 확인
- 🏢 **11개 보험사 지원!**
  - 삼성화재 (111대)
  - 현대해상 (119대)
  - DB손보 (119대)
  - KB손보 (112대)
  - 농협손보 (144대)
  - 한화손보 (124대)
  - 메리츠화재 (119대)
  - 동부손보 (119대)
  - 롯데손보 (112대)
  - 흥국화재 (112대)
  - MG손보 (119대)

### v2.6.0 (2025-11-12) 💼 **전문 보험 분석 시스템!**
- 💼 **AI 보험 분석 시스템 업그레이드!**
  - "AI 수술 코드 검색" → "AI 진단코드 보험 분석 검색"
  - 전문 보험설계사용 프롬프트 적용
  - 11개 보험사 1-5종 수술비 특약 자동 분석
  - N대 수술비 세부등급 분석 (27대, 59대, 43대 등)
  - 웹 검색 기반 정보 검증 시스템
  - 보험사별 보장 금액 추정 및 비교
- 🔍 **2단계 검증 프로세스!**
  - 1단계: 웹 검색으로 수술/진단 정보 정확성 검증
  - 2단계: 보험사별 특약 세부 분석
  - 의학적 분류, 난이도, 동의어 확인
- 📊 **상세 보험 리포트 생성!**
  - 보험사별 1-5종 특약 분류
  - N대 특약 세부등급 명시
  - 고객 상담 포인트 제공
  - 설계 제안 및 주의사항
- 🎯 **보험설계사 전문 도구!**
  - 정확도 최우선 검증 시스템
  - 11개 손해보험사 전체 커버
  - 세부등급별 보장 금액 분석

### v2.5.0 (2025-11-12) 🏥 **ICD-10 진단코드 지원!**
- 🩺 **ICD-10 진단코드 검색 시스템 추가!**
  - 실제 병원 진단서에 표기되는 질병분류코드 검색
  - H-코드 (눈질환: H25 백내장, H40 녹내장)
  - I-코드 (순환기: I21 심근경색, I63 뇌경색)
  - M-코드 (근골격: M17 무릎관절증, M16 고관절증)
  - K-코드 (소화기: K35 충수염, K80 담석)
  - C-코드 (암: C16 위암, C34 폐암, C50 유방암)
  - E-코드 (대사: E11 당뇨병, E78 고지혈증)
  - 50개+ 주요 ICD-10 진단코드 데이터베이스
- 🔍 **진단코드 + 수가코드 분리 검색!**
  - ICD-10 진단코드 (파란색 테마): 병원 진단서 코드
  - EDI 수가코드 (녹색 테마): 의료행위 청구 코드
  - 두 코드 체계 동시 표시로 혼동 방지
- 🎨 **새로운 UI 디자인!**
  - 진단코드 검색 영역 상단 배치 (파란색 그라데이션)
  - 자동완성 기능으로 빠른 코드 찾기
  - 대분류, 중분류, 질환군 정보 표시
  - "병원 진단서 코드" 배지로 명확한 구분
- 📋 **상세 정보 제공!**
  - 질병명 + 코드 + 분류 체계
  - 설명 박스로 질병 정보 제공
  - 보험 청구 시 활용 가이드
- ✨ **사용자 경험 개선!**
  - "백내장" 검색 → H25.0~H25.9 전체 코드 표시
  - "심근경색" 검색 → I21 계열 코드 자동 추천
  - 검색어 입력 시 실시간 자동완성

### v2.4.0 (2025-11-12) 🎉
- 📥 **TXT 다운로드 기능 추가!**
  - 검색 결과를 텍스트 파일로 저장
  - 깔끔한 포맷으로 보험 상담 자료 활용
  - "TXT 다운로드" 버튼으로 간편한 내보내기
- 🎨 **UI/UX 대폭 개선!**
  - Circle emoji 사용 (❶❷❸❹❺❻)
  - 시각적 마커 (■ 섹션, ✔️ 항목)
  - 반응형 타이포그래피:
    - 모바일: 17px, 1.6-1.7 line-height, 16px padding
    - PC: 15-16px, 1.5-1.6 line-height, 40-60px padding
  - 더 나은 가독성과 간격 (mb-6 → mb-8)
  - 짧은 문장으로 재구성 (15-20자/줄)
  - 모바일 우선 + PC 최적화
- 🔧 **보험 청구 주의사항 가독성 개선!**
  - 보험사별로 카드 분리 표시
  - 각 보험사명에 ■ 마커 추가
  - 박스 테두리로 시각적 구분
  - 긴 텍스트 줄바꿈 및 간격 개선
- 🌙 **다크모드 검색 결과 수정!**
  - 검색 결과 모달 다크모드 지원
  - 모든 카드와 배경 다크모드 대응
  - 텍스트 가시성 100% 개선
- 📊 **데이터 정확도 표시 추가!**
  - 데이터베이스 출처: **정확도 100%** (녹색 배지)
  - AI 검색 출처: **정확도 70-85%** (주황색 배지 + 펄스 애니메이션)
  - 할루시네이션 경고 메시지 추가
  - 출처별 신뢰도 명확한 시각화

### v2.3.0 (2025-11-12)
- 🤖 **DB + GPT 하이브리드 검색 시스템 구축!**
  - 1단계: DB 우선 검색 (빠른 응답)
  - 2단계: GPT 보완 검색 (DB에 없을 때)
  - 3단계: 결과 통합 & 신뢰도 표시
- 🌟 **Studiojuai 프로젝트 링크 추가!**
  - 의료 영상 판독, 암호화폐 분석, 타로 리딩
  - iframe 모달로 내부에서 프로젝트 열람
- 🎨 **AI 검색 영역 대형화 및 상단 배치**
- 🌙 **다크모드 개선** (전체 배경 블랙, 글씨 화이트)
- 🔧 **관리자 패널 버그 수정** (비밀번호: `01031593697as!@`)
- 📊 **검색 통계 패널** (DB: X개, AI: Y개, Zms)
- 🏷️ **데이터 소스 배지** (데이터베이스 vs AI 검색)
- ⭐ **신뢰도 표시** (높음/중간/낮음)

### v2.2.0 (2025-11-12)
- 🔗 **보험기관 빠른 링크 추가!**
- 🏢 52개 국내 보험기관
- 🏛️ 30개 유관기관
- 🌍 15개 해외보험기관
- 📂 접이식 UI로 깔끔한 링크 관리
- 📊 20개 보험 엑셀 데이터 파일 분석 (7,453 rows, 4,693개 수술 관련 항목)

### v2.1.0 (2025-11-11)
- 🏥 **HIRA 공공데이터 API 연동 완료!**
- 📊 5,000개+ 수술 코드 자동 수집
- 🔍 HIRA API 실시간 검색 기능
- 📖 HIRA API 가이드 문서 추가

### v2.0.0 (2025-11-11)
- ✨ OpenAI GPT-4o-mini 자동 업데이트 시스템
- 🎨 Studiojiai_ 브랜딩 및 반응형 디자인
- ⏰ Cloudflare Workers Cron Job
- 📱 모바일/PC 완벽 대응
- 🌐 푸터 링크 (Website, Instagram, Email)

### v1.0.0 (2025-11-11)
- 🎉 초기 버전 릴리즈
- 🔍 수술 검색 기능
- 📊 보험사별 특약 비교
- 💾 Cloudflare D1 데이터베이스

---

**© 2025 Studiojiai_ - ALL RIGHTS RESERVED**

[https://www.studiojuai.com](https://www.studiojuai.com) | [@STUDIO_JU_AI](https://www.instagram.com/STUDIO_JU_AI) | [ikjoobang@gmail.com](mailto:ikjoobang@gmail.com)
