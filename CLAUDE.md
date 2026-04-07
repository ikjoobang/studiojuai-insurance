# 보험스캔 (studiojuai-insurance)

## 프로젝트 목적
수술비특약분석(#6) + 의료영상판독(#12) 합체 프로젝트.
ICD-10 진단코드 검색 + 11개 보험사 특약 비교 + 의료영상 AI 판독(교육용)을 하나의 사이트에서 제공.

## 프로젝트 정보
- 이름: 보험스캔 (구 수술비특약분석 + 의료영상판독)
- URL: https://studiojuai-insurance.pages.dev
- 플랫폼: Cloudflare Pages + D1 (Hono + Vite + TypeScript)
- AI: OpenAI (Vision + GPT) + Gemini + Perplexity + HIRA API
- DB: Cloudflare D1 (수술 데이터, ICD-10)
- 패밀리: 보험하자 계열

## 절대 규칙
1. API 키 코드에 하드코딩 금지 (환경변수 필수)
2. 배포 전 npm run build 에러 0건 확인
3. main 배포 전 test 브랜치 먼저
4. id가 있는 HTML 요소 제거 금지 (JS 참조)
5. D1 데이터베이스 스키마 변경 시 마이그레이션 필수
6. 기존 수술 검색 API 로직 건드리지 마

## 환경변수 (Cloudflare Secrets)
- OPENAI_API_KEY: OpenAI Vision + GPT
- PERPLEXITY_API_KEY: Perplexity 검색
- HIRA_API_KEY: 건강보험심사평가원 API
- GEMINI_API_KEY: Gemini

## 작업 목록

### Phase 1: 감사 (현재 상태 파악)
1. 전체 파일 구조 파악 (src/ 모든 파일)
2. 모든 API 라우트 목록화
3. D1 데이터베이스 스키마 확인
4. 현재 UI 페이지/섹션 파악
5. 콘솔 에러 확인
6. 모바일 반응형 상태

### Phase 2: UI 리디자인 (보험카페 규격서 적용)
- 기본 테마: 라이트 (#FAFAF8)
- 브랜드 컬러: #00C853 (XIVIX Green)
- 텍스트 라이트: #111111(검정) / 다크: #FFFFFF(흰색)
- 밤/낮 토글 추가
- CSS 변수 기반 테마 시스템
- 반응형: 모바일 1컬럼 / PC 2컬럼, max-width 1100px
- 폰트: Pretendard Variable
- 칩/버튼 min-height 44px
- 이모지 사용 금지 (FontAwesome으로 대체)
- 사이트명: "보험스캔"
- 파비콘: 초록 배경 + "스" 글자

### Phase 3: #12 의료영상판독 기능 합체
- 탭 추가: "진단코드 검색" | "영상판독(교육용)"
- 영상판독 탭 기능:
  - 이미지 업로드 (CT, X-ray, MRI 등)
  - OpenAI Vision API로 분석
  - 분석 결과 표시 (소견, 권장 검사, 주의사항)
  - PDF 리포트 생성 (가능하면)
  - "교육용 참고 자료" 디스클레이머 필수
- Express 코드를 Hono 라우트로 변환
- 참조 레포: https://github.com/ikjoobang/medical-report-analyzer (backend/server.js)

### Phase 4: 보안 + SEO
- 관리자 페이지 비밀번호 보호
- OG 메타태그 추가
- sitemap.xml, _headers (CSP) 생성
- AI 디스클레이머 (교육용, 진단 아님)

## 텍스트 색상 절대 규칙
- 라이트: 제목/본문 #111111(검정), 보조 #333333, 힌트만 #666666
- 다크: 제목/본문 #FFFFFF(흰색), 보조 #E0E0E0, 힌트만 #999999
- rgba 반투명 텍스트 금지

## 컬러 시스템 CSS 변수
:root { --bg:#FAFAF8; --card:#FFFFFF; --card-border:rgba(0,0,0,0.06); --text-1:#111111; --text-2:#333333; --text-3:#666666; --green:#00C853; --green-light:#69F0AE; --red:#dc2626; }
[data-theme="dark"] { --bg:#0a0a0a; --card:#111111; --card-border:rgba(255,255,255,0.06); --text-1:#FFFFFF; --text-2:#E0E0E0; --text-3:#999999; }

## 배포
npm run build
npx wrangler pages deploy ./dist --project-name=studiojuai-insurance --branch=test
npx wrangler pages deploy ./dist --project-name=studiojuai-insurance --branch=main

## 금지 사항
- ❌ D1 스키마 무단 변경
- ❌ 기존 수술 검색 로직 수정
- ❌ API 키 하드코딩
- ❌ 증거 없이 완료 선언
- ❌ 이모지 사용
