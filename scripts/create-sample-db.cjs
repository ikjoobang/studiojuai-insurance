/**
 * 엑셀 파일에서 샘플 데이터 추출 (1000개 제한)
 * 클라이언트에서 사용할 JSON 파일 생성
 */

const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

console.log('📊 샘플 수술 데이터 생성 중...\n')

const surgeryData = []

// HIRA 파일에서 제한된 수만 읽기
try {
  console.log('🔍 HIRA 파일 로딩 (1000개 제한)...')
  const wb = XLSX.readFile('hira_surgery_codes.xlsx', { sheetRows: 1000 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws)
  
  console.log(`✅ ${rows.length}개 로드됨`)
  
  rows.forEach(row => {
    const code = row['수술코드'] || row['코드'] || row['CODE'] || row['ediCd']
    const name = row['수술명'] || row['명칭'] || row['NAME'] || row['korNm']
    
    if (code && name) {
      surgeryData.push({
        code: String(code).trim(),
        name: String(name).trim(),
        source: 'HIRA'
      })
    }
  })
  
  console.log(`   → ${surgeryData.length}개 수술 코드 추출\n`)
} catch (error) {
  console.error('❌ HIRA 파일 로드 실패:', error.message)
}

// 수동 데이터 추가 (대표적인 수술들)
const manualData = [
  { code: 'S5061', name: '백내장 수술', source: 'manual' },
  { code: 'S5060', name: '녹내장 수술', source: 'manual' },
  { code: 'Q2861', name: '충수절제술', source: 'manual' },
  { code: 'Q2862', name: '복강경 충수절제술', source: 'manual' },
  { code: 'S4642', name: '제왕절개 분만', source: 'manual' },
  { code: 'Q0101', name: '위내시경검사', source: 'manual' },
  { code: 'Q2772', name: '담낭절제술', source: 'manual' },
  { code: 'Q2773', name: '복강경 담낭절제술', source: 'manual' },
]

surgeryData.push(...manualData)
console.log(`✅ ${manualData.length}개 수동 데이터 추가\n`)

// JSON 저장
const outputPath = path.join(__dirname, '..', 'public', 'static', 'surgery-db.json')
fs.writeFileSync(outputPath, JSON.stringify(surgeryData, null, 2))

console.log(`✨ 총 ${surgeryData.length}개 수술 데이터 저장 완료!`)
console.log(`📁 경로: ${outputPath}\n`)

// 통계
const bySource = {}
surgeryData.forEach(item => {
  bySource[item.source] = (bySource[item.source] || 0) + 1
})
console.log('📊 출처별 통계:')
Object.entries(bySource).forEach(([source, count]) => {
  console.log(`   ${source}: ${count}개`)
})
