# 🚀 Cloudflare Pages 배포 가이드

## ❶ 사전 준비

### 필수 계정
- ✅ GitHub: `ikjoobang@gmail.com` (준비 완료)
- ✅ Cloudflare: `ikjoobang@gmail.com` (준비 완료)
- ✅ OpenAI API 키: `sk-proj-YOUR_KEY...` (준비 완료)

---

## ❷ Cloudflare D1 데이터베이스 생성

### 1️⃣ Production 데이터베이스 생성
```bash
cd /home/user/webapp

# D1 데이터베이스 생성
npx wrangler d1 create webapp-production
```

**출력 예시:**
```
✅ Successfully created DB 'webapp-production'

[[d1_databases]]
binding = "DB"
database_name = "webapp-production"
database_id = "abcd1234-5678-90ef-ghij-klmnopqrstuv"
```

### 2️⃣ wrangler.jsonc 업데이트
복사한 `database_id`를 wrangler.jsonc에 입력:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "실제-데이터베이스-ID로-교체"
    }
  ]
}
```

### 3️⃣ Production 마이그레이션
```bash
# 데이터베이스 스키마 생성
npx wrangler d1 migrations apply webapp-production --remote

# 초기 데이터 입력
npx wrangler d1 execute webapp-production --remote --file=./seed.sql

# 샘플 데이터 입력 (선택사항)
npx wrangler d1 execute webapp-production --remote --file=./sample_data.sql
```

---

## ❸ Cloudflare Pages 프로젝트 생성

### 1️⃣ Cloudflare 대시보드 접속
1. https://dash.cloudflare.com 로그인
2. 왼쪽 메뉴에서 **Workers & Pages** 클릭
3. **Create application** 버튼 클릭
4. **Pages** 탭 선택
5. **Connect to Git** 선택

### 2️⃣ GitHub 저장소 연결
1. **GitHub** 선택
2. 저장소 권한 승인
3. 저장소 선택: `ikjoobang/webapp` (또는 실제 저장소명)
4. **Begin setup** 클릭

### 3️⃣ 빌드 설정
```
Project name: insurance-surgery-analyzer
Production branch: main
Build command: npm run build
Build output directory: dist
```

### 4️⃣ 환경변수 설정
**Environment variables** 섹션에서 추가:

```
OPENAI_API_KEY = sk-proj-YOUR_API_KEY_HERE
```

### 5️⃣ 배포 시작
**Save and Deploy** 클릭

---

## ❹ CLI로 직접 배포 (대안)

### 1️⃣ Wrangler 인증
```bash
# Cloudflare API 토큰으로 인증
export CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID

# 인증 확인
npx wrangler whoami
```

**출력 예시:**
```
👋 You are logged in with an API Token, associated with the email ikjoobang@gmail.com
```

### 2️⃣ Pages 프로젝트 생성
```bash
cd /home/user/webapp

# 빌드
npm run build

# 프로젝트 생성 (최초 1회)
npx wrangler pages project create insurance-surgery-analyzer \
  --production-branch main \
  --compatibility-date 2025-11-11
```

### 3️⃣ 배포
```bash
# Production 배포
npx wrangler pages deploy dist \
  --project-name insurance-surgery-analyzer \
  --branch main

# 환경변수 설정
npx wrangler pages secret put OPENAI_API_KEY \
  --project-name insurance-surgery-analyzer

# 프롬프트가 나오면 API 키 입력
```

### 4️⃣ D1 바인딩 확인
Cloudflare 대시보드에서:
1. **Workers & Pages** → **insurance-surgery-analyzer** 클릭
2. **Settings** → **Functions** → **D1 database bindings** 확인
3. 바인딩이 없다면 수동 추가:
   - Variable name: `DB`
   - D1 database: `webapp-production`

---

## ❺ GitHub Actions CI/CD (자동 배포)

### 1️⃣ GitHub Secrets 설정
GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**

추가할 Secrets:
```
CLOUDFLARE_API_TOKEN = YOUR_CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID = YOUR_ACCOUNT_ID
OPENAI_API_KEY = sk-proj-YOUR_OPENAI_KEY
```

### 2️⃣ GitHub Actions Workflow 생성
파일 생성: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=insurance-surgery-analyzer
```

### 3️⃣ 자동 배포 테스트
```bash
git add .
git commit -m "chore: Add GitHub Actions CI/CD"
git push origin main
```

GitHub Actions 탭에서 배포 진행 상황 확인

---

## ❻ 배포 후 확인

### 1️⃣ 배포 URL 확인
```bash
npx wrangler pages deployment list --project-name=insurance-surgery-analyzer
```

**출력 예시:**
```
✅ Production: https://insurance-surgery-analyzer.pages.dev
🌿 Branch: https://main.insurance-surgery-analyzer.pages.dev
```

### 2️⃣ 동작 테스트
```bash
# API 테스트
curl https://insurance-surgery-analyzer.pages.dev/api/insurance-companies

# 수술 검색 테스트
curl "https://insurance-surgery-analyzer.pages.dev/api/search/surgery?q=백내장"

# 자동 업데이트 상태 확인
curl https://insurance-surgery-analyzer.pages.dev/api/admin/update-status
```

### 3️⃣ 데이터베이스 확인
```bash
# Production 데이터 확인
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) FROM surgeries"
```

---

## ❼ 커스텀 도메인 연결 (선택사항)

### 1️⃣ Cloudflare 대시보드
1. **Workers & Pages** → **insurance-surgery-analyzer**
2. **Custom domains** → **Set up a custom domain**
3. 도메인 입력 (예: `insurance.studiojuai.com`)
4. DNS 레코드 자동 생성 확인
5. **Activate domain**

### 2️⃣ CLI로 설정
```bash
npx wrangler pages domain add insurance.studiojuai.com \
  --project-name=insurance-surgery-analyzer
```

---

## ❽ 문제 해결 (Troubleshooting)

### 🔴 배포 실패 시

#### 1. 빌드 오류
```bash
# 로컬에서 빌드 테스트
npm run build

# 오류 확인
npm run build 2>&1 | tee build.log
```

#### 2. D1 바인딩 오류
```
Error: D1_ERROR: no such table: surgeries
```

**해결 방법:**
```bash
# 마이그레이션 재실행
npx wrangler d1 migrations apply webapp-production --remote
```

#### 3. 환경변수 오류
```
Error: OPENAI_API_KEY is not defined
```

**해결 방법:**
```bash
# Secret 재설정
npx wrangler pages secret put OPENAI_API_KEY \
  --project-name=insurance-surgery-analyzer
```

#### 4. 인증 오류
```
Error: Authentication error
```

**해결 방법:**
```bash
# API 토큰 재설정
export CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_API_TOKEN

# 인증 확인
npx wrangler whoami
```

### 🟡 성능 최적화

#### 1. 이미지 최적화
정적 이미지를 Cloudflare Images로 이관

#### 2. CDN 캐싱
wrangler.jsonc에 추가:
```jsonc
{
  "routes": [
    {
      "pattern": "/static/*",
      "custom_domain": true
    }
  ]
}
```

#### 3. 데이터베이스 인덱싱
추가 인덱스 생성:
```sql
CREATE INDEX idx_surgeries_updated_at ON surgeries(updated_at);
CREATE INDEX idx_surgery_type_benefits_updated_at ON surgery_type_benefits(updated_at);
```

---

## ❾ 유지보수

### 자동 업데이트 모니터링
```bash
# Cron 실행 로그 확인
npx wrangler tail --format=pretty

# 최근 업데이트 통계
curl https://insurance-surgery-analyzer.pages.dev/api/admin/update-status
```

### 정기 백업
```bash
# 데이터베이스 백업 (주 1회)
npx wrangler d1 export webapp-production --remote --output=backup-$(date +%Y%m%d).sql
```

### 로그 모니터링
Cloudflare 대시보드 → **Analytics** → **Logs**

---

## ❿ 체크리스트

### 배포 전 확인사항
- [ ] D1 데이터베이스 생성 완료
- [ ] wrangler.jsonc에 database_id 입력
- [ ] 마이그레이션 실행 완료
- [ ] 샘플 데이터 입력 완료
- [ ] OpenAI API 키 등록
- [ ] GitHub 저장소 Push 완료
- [ ] 로컬 빌드 테스트 통과

### 배포 후 확인사항
- [ ] Production URL 접속 확인
- [ ] API 엔드포인트 동작 확인
- [ ] 데이터베이스 연결 확인
- [ ] 자동 업데이트 기능 테스트
- [ ] 모바일 반응형 확인
- [ ] 푸터 링크 동작 확인

---

## 📞 지원

**문제 발생 시 확인 순서:**
1. Cloudflare 대시보드 Logs 확인
2. `npx wrangler tail` 로 실시간 로그 확인
3. 로컬 환경에서 재현 테스트
4. GitHub Issues에 상세 오류 내용 기록

**연락처:**
- 이메일: ikjoobang@gmail.com
- 웹사이트: https://www.studiojuai.com
- Instagram: @STUDIO_JU_AI

---

**작성일**: 2025-11-11  
**버전**: 2.0.0  
**상태**: ✅ OpenAI 자동 업데이트 시스템 완성
