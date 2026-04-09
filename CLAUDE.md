# 보험스캔 (studiojuai-insurance)

## 프로젝트 목적
수술비특약분석(#6) + 의료영상판독(#12) 합체 프로젝트.
ICD-10 진단코드 검색 + 11개 보험사 특약 비교 + 의료영상 판독(교육용)을 하나의 사이트에서 제공.

## 프로젝트 정보
- 이름: 보험스캔 (구 수술비특약분석 + 의료영상판독)
- URL: https://studiojuai-insurance.pages.dev
- 플랫폼: Cloudflare Pages + D1 (Hono + Vite + TypeScript)
- DB: Cloudflare D1 (수술 데이터, ICD-10)
- 패밀리: 보험하자 계열

## 절대 규칙
1. API 키 코드에 하드코딩 금지 (환경변수 필수)
2. API 에러 원문을 사용자에게 절대 노출하지 마 (키, 엔드포인트, 상세 에러)
3. 에러 시 "검색 결과를 불러올 수 없습니다. 잠시 후 다시 시도해주세요" 만 표시
4. 기존 API 라우트 23개 로직 수정 금지
5. D1 스키마 변경 금지
6. 섹션 삭제 금지 (핵심 기능, 빠른 링크, 데이터 검증 안내)
7. 이모지 사용 금지 (밤/낮 토글만 허용)
8. 기술명 사용자 노출 금지 (GPT, OpenAI, Perplexity, Vision, Gemini)
9. 배포 전 npm run build 에러 0건
10. main 배포 전 test 먼저

## 환경변수 (Cloudflare Secrets)
- OPENAI_API_KEY: OpenAI Vision + GPT
- PERPLEXITY_API_KEY: Perplexity 검색
- HIRA_API_KEY: 건강보험심사평가원 API
- GEMINI_API_KEY: Gemini

## 텍스트 색상 절대 규칙
- 라이트: 제목/본문 #111111(검정), 보조 #333333, 힌트만 #666666
- 다크: 제목/본문 #FFFFFF(흰색), 보조 #E0E0E0, 힌트만 #999999
- rgba 반투명 텍스트 금지

## 컬러 시스템 CSS 변수
:root { --bg:#FAFAF8; --card:#FFFFFF; --card-border:rgba(0,0,0,0.06); --text-1:#111111; --text-2:#333333; --text-3:#666666; --green:#00C853; --green-light:#69F0AE; --red:#dc2626; }
[data-theme="dark"] { --bg:#0a0a0a; --card:#111111; --card-border:rgba(255,255,255,0.06); --text-1:#FFFFFF; --text-2:#E0E0E0; --text-3:#999999; }

## 기술용어 교체 규칙
- "AI 하이브리드 검색" → "보험 데이터 검증 시스템"
- "AI 분석 결과" → "데이터 검증 결과"
- "AI 영상 분석" → "영상 데이터 분석"
- "AI 기반 분석" → "데이터 기반 분석"
- "AI: 0개" → "분석: 0개"
- "AI 보험 분석" → "보험 데이터 분석"
- "AI 분석" → "데이터 분석" (버튼/라벨)
- "AI가 분석 중입니다" → "분석 중입니다"
- "AI 실시간 분석" → "실시간 데이터 분석"

## 관리자
- 경로: /admin?pw=xivix2026 (별도 라우트, 메인 HTML에 노출 금지)
- 비밀번호: xivix2026

## F12/우클릭 방지
- 우클릭, F12, Ctrl+Shift+I/J/U 차단
- DevTools 감지 (창 크기 차이 threshold)

## 배포
npm run build
npx wrangler pages deploy ./dist --project-name=studiojuai-insurance --branch=test
npx wrangler pages deploy ./dist --project-name=studiojuai-insurance --branch=main

## 금지 사항
- D1 스키마 무단 변경
- 기존 수술 검색 로직 수정
- API 키 하드코딩
- 증거 없이 완료 선언
- 이모지 사용 (밤/낮 토글만 예외)
- 섹션 삭제 (핵심 기능, 빠른 링크, 데이터 검증 안내)
- API 에러 원문 사용자 노출
- 기술명 (GPT, OpenAI, Perplexity, Vision, Gemini) 사용자 노출
