/**
 * 엑셀 파일을 JSON으로 변환하는 빌드 스크립트
 * Cloudflare Workers에서는 fs를 사용할 수 없으므로
 * 빌드 시점에 JSON으로 변환
 */

const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

console.log('📊 엑셀 파일을 JSON으로 변환 중...')

const excelFiles = [
  'insurance_comparison.xls',
  '암보험_보장성_상품비교_20251112121355673.xls',
  '상해보험_보장성_상품비교_20251112121529945.xls',
  '질병보험_보장성_상품비교_20251112121336401.xls',
  'CI_보장성_상품비교_20251112121414542.xls',
  '정기보험_보장성_상품비교_20251112121311805.xls',
  '종신보험_보장성_상품비교_20251112121227113.xls',
  '어린이보험_보장성_상품비교_20251112121553819.xls',
  '치아보험_보장성_상품비교_20251112121614291.xls',
  '간병치매보험_보장성_상품비교_20251112121634291.xls',
]

const allData = []

for (const fileName of excelFiles) {
  try {
    const filePath = path.join(__dirname, '..', fileName)
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  파일 없음: ${fileName}`)
      continue
    }

    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet)

    console.log(`✅ ${fileName}: ${rows.length} 행 로드`)

    for (const row of rows) {
      // 수술 코드 찾기
      const code = row['수술코드'] || row['코드'] || row['EDI코드'] || row['수술 코드'] || row['CODE']
      const name = row['수술명'] || row['수술 이름'] || row['명칭'] || row['NAME']
      const company = row['보험사'] || row['보험회사'] || row['회사명'] || row['COMPANY']
      
      if (code && name) {
        allData.push({
          code: String(code).trim(),
          name: String(name).trim(),
          company: company ? String(company).trim() : '미상',
          type: row['종별'] || row['수술종별'] || row['TYPE'],
          amount: row['보장금액'] || row['지급금액'] || row['AMOUNT'],
          nType: row['N대특약'] || row['N대'] || row['N_TYPE'],
          covered: row['보장여부'] === 'Y' || row['보장여부'] === '보장',
          category: row['세부분류'] || row['분류'] || row['CATEGORY'],
          source: fileName
        })
      }
    }
  } catch (error) {
    console.error(`❌ ${fileName} 변환 실패:`, error.message)
  }
}

// JSON 파일로 저장
const outputPath = path.join(__dirname, '..', 'src', 'insurance-data.json')
fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2))

console.log(`\n✅ 총 ${allData.length}개 데이터를 insurance-data.json에 저장 완료!`)
console.log(`📁 경로: ${outputPath}`)
