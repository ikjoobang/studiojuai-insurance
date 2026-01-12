# ⚡ 빠른 시작 가이드

## 🎯 목표

**5분 안에 Cloudflare Pages에 배포하고 실행하기**

---

## ✅ 사전 준비 체크리스트

- ✅ GitHub 계정: `ikjoobang@gmail.com`
- ✅ Cloudflare 계정: `ikjoobang@gmail.com`
- ✅ OpenAI API 키: 준비 완료
- ✅ Cloudflare API 토큰: 준비 완료
- ✅ 프로젝트 코드: 준비 완료

---

## 🚀 방법 1: CLI로 즉시 배포 (추천)

### 1️⃣ 터미널에서 한 번에 실행

```bash
# 1. 프로젝트 디렉토리로 이동
cd /home/user/webapp

# 2. 환경변수 설정
export CLOUDFLARE_API_TOKEN=YOUR_CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=YOUR_ACCOUNT_ID

# 3. 인증 확인
npx wrangler whoami

# 4. D1 데이터베이스 생성 (최초 1회)
npx wrangler d1 create webapp-production

# 5. database_id 복사 후 wrangler.jsonc 수정
# (수동으로 database_id 교체 필요)

# 6. 마이그레이션 실행
npx wrangler d1 migrations apply webapp-production --remote

# 7. 초기 데이터 입력
npx wrangler d1 execute webapp-production --remote --file=./seed.sql
npx wrangler d1 execute webapp-production --remote --file=./sample_data.sql

# 8. 빌드
npm run build

# 9. Pages 프로젝트 생성 (최초 1회)
npx wrangler pages project create insurance-surgery-analyzer \
  --production-branch main

# 10. 배포
npx wrangler pages deploy dist --project-name insurance-surgery-analyzer

# 11. OpenAI API 키 설정
npx wrangler pages secret put OPENAI_API_KEY \
  --project-name insurance-surgery-analyzer
# 프롬프트가 나오면 API 키 입력:
# sk-proj-YOUR_API_KEY_HERE

# 12. 배포 확인
curl https://insurance-surgery-analyzer.pages.dev/api/insurance-companies
```

**✅ 완료! 이제 접속하세요:**  
🌐 https://insurance-surgery-analyzer.pages.dev

---

## 🌐 방법 2: Cloudflare 대시보드 (초보자)

### 1️⃣ D1 데이터베이스 생성

1. https://dash.cloudflare.com 로그인
2. 왼쪽 메뉴 **Workers & Pages** 클릭
3. **D1** 탭 선택
4. **Create database** 클릭
5. 이름: `webapp-production`
6. **Create** 클릭
7. **Console** 탭에서 마이그레이션 실행:
   ```sql
   -- migrations/0001_initial_schema.sql 내용 복사 붙여넣기
   ```

### 2️⃣ Pages 프로젝트 생성

1. **Workers & Pages** → **Create application**
2. **Pages** 탭 → **Connect to Git**
3. **GitHub** 선택 → 저장소 연결
4. 저장소 선택: `webapp`
5. Build settings:
   ```
   Build command: npm run build
   Build output directory: dist
   ```

### 3️⃣ 환경변수 설정

**Environment variables** 섹션:
```
OPENAI_API_KEY = sk-proj-YOUR_KEY...
```

### 4️⃣ D1 바인딩

1. **Settings** → **Functions**
2. **D1 database bindings** → **Add binding**
3. Variable name: `DB`
4. D1 database: `webapp-production`

### 5️⃣ 배포 시작

**Save and Deploy** 클릭

---

## 🔄 방법 3: GitHub Actions (자동 배포)

### 1️⃣ GitHub Secrets 설정

GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**

**New repository secret** 클릭하여 추가:

```
이름: CLOUDFLARE_API_TOKEN
값: YOUR_CLOUDFLARE_API_TOKEN

이름: CLOUDFLARE_ACCOUNT_ID
값: YOUR_ACCOUNT_ID

이름: OPENAI_API_KEY
값: sk-proj-YOUR_API_KEY_HERE
```

### 2️⃣ GitHub Push

```bash
cd /home/user/webapp

# Workflow 파일이 포함되어 있음 (.github/workflows/deploy.yml)
git add .
git commit -m "chore: Add GitHub Actions workflow"
git push origin main
```

### 3️⃣ 자동 배포 확인

**GitHub → Actions 탭**에서 배포 진행 상황 확인

---

## ✅ 배포 완료 확인

### 테스트 명령어

```bash
# API 테스트
curl https://insurance-surgery-analyzer.pages.dev/api/insurance-companies

# 수술 검색
curl "https://insurance-surgery-analyzer.pages.dev/api/search/surgery?q=백내장"

# 웹 접속
open https://insurance-surgery-analyzer.pages.dev
```

### 예상 결과

```json
{
  "companies": [
    {"id": 1, "name": "삼성화재", "code": "SAMSUNG"},
    {"id": 2, "name": "현대해상", "code": "HYUNDAI"},
    ...
  ]
}
```

---

## 🎉 성공!

**이제 다음을 시도해보세요:**

### ❶ 웹 UI 테스트
1. https://insurance-surgery-analyzer.pages.dev 접속
2. "백내장 수술" 검색
3. 분석 리포트 확인
4. "자동 업데이트" 버튼 클릭 테스트

### ❷ 자동 업데이트 테스트
```bash
# API로 수동 트리거
curl -X POST https://insurance-surgery-analyzer.pages.dev/api/admin/auto-update \
  -H "Content-Type: application/json" \
  -d '{"company_url": "https://www.samsungfire.com", "company_code": "SAMSUNG"}'
```

### ❸ Cron Job 확인
```bash
# 로그 확인
npx wrangler tail --project-name insurance-surgery-analyzer
```

---

## 🆘 문제 발생 시

### 배포 실패
```bash
# 로그 확인
npx wrangler pages deployment list --project-name insurance-surgery-analyzer

# 재배포
npm run build
npx wrangler pages deploy dist --project-name insurance-surgery-analyzer
```

### D1 오류
```bash
# 마이그레이션 재실행
npx wrangler d1 migrations apply webapp-production --remote

# 데이터 확인
npx wrangler d1 execute webapp-production --remote \
  --command="SELECT COUNT(*) FROM surgeries"
```

### API 키 오류
```bash
# Secret 재설정
npx wrangler pages secret put OPENAI_API_KEY \
  --project-name insurance-surgery-analyzer
```

---

## 📞 지원

**문제가 계속되면:**
1. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 상세 가이드 참고
2. Cloudflare 대시보드 Logs 확인
3. ikjoobang@gmail.com로 문의

---

## 🎯 다음 단계

- ✅ 배포 완료
- [ ] 커스텀 도메인 설정
- [ ] 데이터 추가 (수술 100개 이상)
- [ ] 모니터링 설정
- [ ] 백업 자동화

---

**축하합니다! 🎉 성공적으로 배포했습니다!**

🌐 **접속 URL**: https://insurance-surgery-analyzer.pages.dev

📚 **상세 가이드**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

**© 2025 Studiojiai_ - ALL RIGHTS RESERVED**
