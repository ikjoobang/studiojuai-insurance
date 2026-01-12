# Studiojuai Insurance - 보험 수술비 특약 분석 시스템

## 🌐 라이브 URL (실제 작동 중)

### 메인 페이지
- **프로덕션**: https://0d18817a.studiojuai-insurance.pages.dev
- **로컬 개발**: http://localhost:3000

### ⚠️ 중요: 별도 어드민 페이지 없음
- 어드민 기능은 메인 페이지 하단에 통합되어 있음
- "관리자 설정" 섹션에서 PDF 분석, 자동 업데이트 기능 제공

---

## 📁 프로젝트 구조

### ■ 프론트엔드
| 파일 | 설명 | 위치 |
|------|------|------|
| **메인 페이지** | 검색 UI, 결과 표시 | `src/index.tsx` (HTML 템플릿) |
| **클라이언트 JS** | 검색 로직, 다운로드 기능 | `public/static/app.js` |
| **스타일** | CSS 스타일 | `public/static/styles.css` |
| **JSON 데이터** | 진단코드 DB | `public/static/diagnosis-codes.json` |

### ■ 백엔드 (Hono + Cloudflare Workers)
| 파일 | 설명 |
|------|------|
| `src/index.tsx` | 메인 API 서버 (모든 라우트 정의) |
| `src/gpt-search.ts` | Perplexity + GPT 검색 로직 |
| `src/hybrid-search.ts` | 하이브리드 검색 (DB → Perplexity → GPT) |
| `src/hira-api.ts` | 건강보험심사평가원 API 연동 |
| `src/auto-update.ts` | 자동 업데이트 기능 |
| `src/realtime-insurance-search.ts` | 실시간 보험사 검색 |

### ■ 설정 파일
| 파일 | 설명 |
|------|------|
| `wrangler.jsonc` | Cloudflare 설정 |
| `vite.config.ts` | Vite 빌드 설정 |
| `ecosystem.config.cjs` | PM2 설정 |
| `.dev.vars` | API 키 (로컬 개발용) |
| `package.json` | 의존성 관리 |

---

## 🔌 API 엔드포인트 (실제 작동 중)

### 검색 API
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/gpt-search?q={검색어}` | **메인 검색** - Perplexity + GPT 하이브리드 |
| GET | `/api/search/surgery?q={검색어}` | DB 수술 검색 |
| GET | `/api/surgery/:id` | 수술 상세 정보 |
| GET | `/api/surgery/:id/type-benefits` | 1-5종 수술비 특약 |
| GET | `/api/surgery/:id/n-benefits` | N대 수술비 특약 |
| GET | `/api/surgery/:id/report` | 수술 보고서 |
| GET | `/api/insurance-companies` | 보험사 목록 |
| GET | `/api/popular-searches` | 인기 검색어 |
| GET | `/api/coverage/search` | 보장 검색 |

### 관리자 API
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/admin/surgery` | 수술 추가 |
| POST | `/api/admin/type-benefit` | 1-5종 특약 추가 |
| POST | `/api/admin/n-benefit-detail` | N대 특약 추가 |
| POST | `/api/admin/auto-update` | 자동 업데이트 실행 |
| GET | `/api/admin/update-status` | 업데이트 상태 확인 |
| POST | `/api/admin/hira-sync` | HIRA API 동기화 |
| GET | `/api/admin/hira-search` | HIRA 검색 |
| POST | `/api/admin/analyze-pdf` | PDF 분석 |

### 정적 파일
| 엔드포인트 | 설명 |
|-----------|------|
| `/static/app.js` | 클라이언트 JavaScript |
| `/static/styles.css` | CSS 스타일 |
| `/static/diagnosis-codes.json` | 진단코드 JSON |
| `/static/surgery-db.json` | 수술 DB JSON |
| `/static/organizations.json` | 기관 정보 JSON |

---

## ⚠️ 존재하지 않는 것들 (할루시네이션 방지)

다음은 **존재하지 않습니다**:
- ❌ 별도 어드민 페이지 URL (/admin)
- ❌ 별도 대시보드 페이지
- ❌ Swagger API 문서
- ❌ Health Check 엔드포인트 (/api/health)
- ❌ GitHub 저장소 (아직 푸시되지 않음)
- ❌ 별도 백엔드 서버 (Hono가 프론트엔드+백엔드 통합)

---

## 🔑 API 키 설정 (`.dev.vars` 파일)

```
PERPLEXITY_API_KEY=pplx-YOUR_PERPLEXITY_KEY_HERE
OPENAI_API_KEY=sk-proj-xxx...
```

---

## 🚀 실행 방법

### 로컬 개발
```bash
cd /home/user/webapp
npm install
npm run build
pm2 start ecosystem.config.cjs
# http://localhost:3000 접속
```

### 프로덕션 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name studiojuai-insurance
```

---

## 📦 기술 스택

- **프레임워크**: Hono (Cloudflare Workers)
- **빌드 도구**: Vite
- **배포**: Cloudflare Pages
- **AI**: Perplexity API (sonar-pro) + OpenAI GPT-4o-mini
- **데이터베이스**: Cloudflare D1 (로컬) + JSON 파일
- **스타일**: Tailwind CSS (CDN)

