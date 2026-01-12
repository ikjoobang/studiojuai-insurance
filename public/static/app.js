// 전역 변수
let currentReport = null;
const ADMIN_PASSWORD = '01031593697as!@';
let surgeryDB = [];
let diagnosisDB = [];
let currentTab = 'icd';

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadDiagnosisDB();
  loadSurgeryDB();
  loadOrganizations();
});

// ==================== 테마 전환 ====================

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon(isLight);
}

function updateThemeIcon(isLight) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = isLight ? 'fas fa-moon text-gray-600' : 'fas fa-sun text-gray-300';
  }
}

// ==================== 탭 전환 ====================

function switchTab(tab) {
  currentTab = tab;
  const tabICD = document.getElementById('tabICD');
  const tabAI = document.getElementById('tabAI');
  const icdSearch = document.getElementById('icdSearch');
  const aiSearch = document.getElementById('aiSearch');
  
  if (tab === 'icd') {
    tabICD.className = 'flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all bg-primary text-white';
    tabAI.className = 'flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all bg-white/5 text-gray-400 hover:bg-white/10';
    icdSearch.classList.remove('hidden');
    aiSearch.classList.add('hidden');
  } else {
    tabAI.className = 'flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all bg-primary text-white';
    tabICD.className = 'flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all bg-white/5 text-gray-400 hover:bg-white/10';
    aiSearch.classList.remove('hidden');
    icdSearch.classList.add('hidden');
  }
}

// ==================== 빠른 검색 ====================

function quickSearch(query) {
  if (currentTab === 'icd') {
    document.getElementById('dbSearchInput').value = query;
    searchFromDB();
  } else {
    document.getElementById('searchInput').value = query;
    searchWithGPT();
  }
}

// ==================== DB 로드 ====================

async function loadSurgeryDB() {
  try {
    const response = await fetch('/static/surgery-db.json');
    surgeryDB = await response.json();
    console.log(`✔️ ${surgeryDB.length}개 EDI 수가코드 데이터 로드 완료`);
  } catch (error) {
    console.error('EDI DB 로드 실패:', error);
  }
}

async function loadDiagnosisDB() {
  try {
    const response = await fetch('/static/diagnosis-codes.json');
    diagnosisDB = await response.json();
    console.log(`✔️ ${diagnosisDB.length}개 ICD 진단코드 데이터 로드 완료`);
  } catch (error) {
    console.error('ICD DB 로드 실패:', error);
  }
}

// ==================== 기관 로드 ====================

async function loadOrganizations() {
  try {
    const response = await fetch('/static/organizations.json');
    const data = await response.json();
    
    // 보험기관
    if (data.insurance) {
      document.getElementById('insuranceCount').textContent = `${data.insurance.length}개`;
      document.getElementById('insuranceOrgs').innerHTML = data.insurance.map(org => `
        <a href="${org.url}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white text-sm">
          <i class="fas fa-external-link-alt text-xs text-gray-500"></i>
          ${org.name}
        </a>
      `).join('');
    }
    
    // 유관기관
    if (data.related) {
      document.getElementById('relatedCount').textContent = `${data.related.length}개`;
      document.getElementById('relatedOrgs').innerHTML = data.related.map(org => `
        <a href="${org.url}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white text-sm">
          <i class="fas fa-external-link-alt text-xs text-gray-500"></i>
          ${org.name}
        </a>
      `).join('');
    }
    
    // 해외기관
    if (data.overseas) {
      document.getElementById('overseasCount').textContent = `${data.overseas.length}개`;
      document.getElementById('overseasOrgs').innerHTML = data.overseas.map(org => `
        <a href="${org.url}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white text-sm">
          <i class="fas fa-external-link-alt text-xs text-gray-500"></i>
          ${org.name}
        </a>
      `).join('');
    }
  } catch (error) {
    console.error('Organizations 로드 실패:', error);
  }
}

function toggleOrgSection(section) {
  const orgsDiv = document.getElementById(`${section}Orgs`);
  const chevron = document.getElementById(`${section}Chevron`);
  
  if (orgsDiv.classList.contains('hidden')) {
    orgsDiv.classList.remove('hidden');
    chevron.style.transform = 'rotate(180deg)';
  } else {
    orgsDiv.classList.add('hidden');
    chevron.style.transform = 'rotate(0deg)';
  }
}

// ==================== ICD DB 검색 ====================

async function searchFromDB() {
  const input = document.getElementById('dbSearchInput');
  const query = input.value.trim();
  
  if (!query) {
    alert('검색어를 입력하세요');
    return;
  }
  
  // ICD 진단코드 우선 검색
  const q = query.toLowerCase();
  const diagnosisResults = diagnosisDB.filter(item => {
    return item.code.toLowerCase().includes(q) || 
           item.name.toLowerCase().includes(q) ||
           (item.description && item.description.toLowerCase().includes(q));
  });
  
  // EDI 수가코드도 검색
  const surgeryResults = surgeryDB.filter(item => {
    return item.code.toLowerCase().includes(q) || 
           item.name.toLowerCase().includes(q);
  });
  
  // DB에 결과가 없으면 AI 검색으로 전환
  if (diagnosisResults.length === 0 && surgeryResults.length === 0) {
    console.log('DB에 결과 없음, AI 검색 시작...');
    document.getElementById('searchInput').value = query;
    switchTab('ai');
    await searchWithGPT();
    return;
  }
  
  displayDBResults(diagnosisResults, surgeryResults, query);
}

function showDBSuggestions(query) {
  const suggestionsDiv = document.getElementById('dbSuggestions');
  
  if (!query || query.length < 2) {
    suggestionsDiv.classList.add('hidden');
    return;
  }
  
  const q = query.toLowerCase();
  const diagnosisSuggestions = diagnosisDB.filter(item => {
    return item.code.toLowerCase().includes(q) || 
           item.name.toLowerCase().includes(q) ||
           (item.description && item.description.toLowerCase().includes(q));
  }).slice(0, 6);
  
  if (diagnosisSuggestions.length === 0) {
    suggestionsDiv.classList.add('hidden');
    return;
  }
  
  suggestionsDiv.innerHTML = diagnosisSuggestions.map(item => `
    <div class="suggestion-item p-4 cursor-pointer border-b border-white/5 last:border-b-0" 
         onclick="selectDBSuggestion('${item.code}', '${item.name}')">
      <div class="font-semibold text-white">${item.name}</div>
      <div class="flex items-center gap-2 mt-1">
        <span class="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-mono">${item.code}</span>
        <span class="text-xs text-gray-500">ICD-10</span>
        ${item.category ? `<span class="text-xs text-gray-500">${item.category}</span>` : ''}
      </div>
    </div>
  `).join('');
  
  suggestionsDiv.classList.remove('hidden');
}

function selectDBSuggestion(code, name) {
  const input = document.getElementById('dbSearchInput');
  input.value = `${code} ${name}`;
  document.getElementById('dbSuggestions').classList.add('hidden');
  searchFromDB();
}

function displayDBResults(diagnosisResults, surgeryResults, query) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsDiv = document.getElementById('dbSearchResults');
  const queryDisplay = document.getElementById('resultsQuery');
  
  queryDisplay.textContent = `"${query}" 검색 결과`;
  resultsSection.classList.remove('hidden');
  
  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
  
  let html = '';
  
  // ICD 진단코드 결과
  if (diagnosisResults.length > 0) {
    html += `
      <div class="result-card p-6 md:p-8 mb-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <i class="fas fa-stethoscope text-blue-400 text-xl"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">ICD-10 진단코드</h3>
            <p class="text-gray-400 text-sm">${diagnosisResults.length}개 결과 (병원 진단서 코드)</p>
          </div>
          <span class="ml-auto px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">정확도 100%</span>
        </div>
        
        <div class="space-y-4">
          ${diagnosisResults.map((item, index) => `
            <div class="p-4 rounded-xl bg-white/5 border-l-4 border-blue-500">
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold text-blue-400">${['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿'][index] || (index + 1)}</span>
                <div class="flex-1">
                  <h4 class="font-bold text-lg text-white mb-2">${item.name}</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-2">
                      <span class="text-gray-400">진단코드:</span>
                      <span class="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 font-mono font-bold">${item.code}</span>
                    </div>
                    ${item.chapter ? `
                      <div><span class="text-gray-400">대분류:</span> <span class="text-gray-300">${item.chapter}</span></div>
                    ` : ''}
                    ${item.section ? `
                      <div><span class="text-gray-400">중분류:</span> <span class="text-gray-300">${item.section}</span></div>
                    ` : ''}
                    ${item.category ? `
                      <div><span class="text-gray-400">질환군:</span> <span class="text-gray-300">${item.category}</span></div>
                    ` : ''}
                    ${item.description ? `
                      <div class="mt-3 p-3 rounded-lg bg-blue-500/10 text-gray-300 leading-relaxed">
                        <i class="fas fa-info-circle text-blue-400 mr-2"></i>
                        ${item.description}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p class="text-sm text-gray-300">
            <i class="fas fa-hospital text-blue-400 mr-2"></i>
            <strong>ICD-10 진단코드</strong>는 실제 병원 진단서, 처방전, 입원기록에 표기되는 질병분류코드입니다. 보험 청구 시 진단서에서 이 코드를 확인하세요.
          </p>
        </div>
      </div>
    `;
  }
  
  // EDI 수가코드 결과
  if (surgeryResults.length > 0) {
    html += `
      <div class="result-card p-6 md:p-8 mb-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <i class="fas fa-procedures text-green-400 text-xl"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">EDI 수가코드</h3>
            <p class="text-gray-400 text-sm">${surgeryResults.length}개 결과 (수술/시술/검사 코드)</p>
          </div>
        </div>
        
        <div class="space-y-4">
          ${surgeryResults.map((item, index) => `
            <div class="p-4 rounded-xl bg-white/5 border-l-4 border-green-500">
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold text-green-400">${['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿'][index] || (index + 1)}</span>
                <div class="flex-1">
                  <h4 class="font-bold text-lg text-white mb-2">${item.name}</h4>
                  <div class="flex items-center gap-2">
                    <span class="text-gray-400">수가코드:</span>
                    <span class="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 font-mono">${item.code}</span>
                  </div>
                  ${item.category ? `
                    <div class="mt-2 text-sm text-gray-400">분류: ${item.category}</div>
                  ` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  resultsDiv.innerHTML = html;
}

// ==================== AI GPT 검색 ====================

async function searchWithGPT() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput?.value?.trim();
  
  if (!query) {
    alert('검색어를 입력하세요');
    return;
  }

  // Show loading overlay
  document.getElementById('loadingOverlay').classList.remove('hidden');

  try {
    const response = await fetch(`/api/gpt-search?q=${encodeURIComponent(query)}`);
    const result = await response.json();

    // Hide loading
    document.getElementById('loadingOverlay').classList.add('hidden');

    if (result.success) {
      displayGPTResults(result, query);
    } else {
      alert(`검색 오류: ${result.error || '알 수 없는 오류'}`);
    }
  } catch (error) {
    document.getElementById('loadingOverlay').classList.add('hidden');
    console.error('GPT search error:', error);
    alert('검색 중 오류가 발생했습니다: ' + error.message);
  }
}

function displayGPTResults(result, query) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsDiv = document.getElementById('searchResults');
  const queryDisplay = document.getElementById('resultsQuery');
  const downloadButtons = document.getElementById('downloadButtons');
  
  queryDisplay.textContent = `"${query}" AI 분석 결과`;
  resultsSection.classList.remove('hidden');
  downloadButtons.classList.remove('hidden');
  
  // Store for download
  currentReport = { query, ...result };
  
  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
  
  // Stats bar
  let html = '';
  if (result.stats) {
    html += `
      <div class="result-card p-4 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <i class="fas fa-chart-bar text-primary text-xl"></i>
            <span class="font-bold text-white">검색 통계</span>
          </div>
          <div class="flex flex-wrap gap-3">
            <span class="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
              <i class="fas fa-database mr-1"></i>DB: ${result.stats.fromDB}개
            </span>
            <span class="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-sm font-semibold">
              <i class="fas fa-robot mr-1"></i>AI: ${result.stats.fromGPT}개
            </span>
            <span class="px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 text-sm font-semibold">
              <i class="fas fa-bolt mr-1"></i>${result.stats.searchTime || 0}ms
            </span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Results
  if (result.results && result.results.length > 0) {
    html += result.results.map((item, index) => {
      const circleNum = ['❶', '❷', '❸', '❹', '❺', '❻'][index] || `${index + 1}`;
      
      return `
        <div class="result-card p-6 md:p-8 mb-6">
          <!-- Header -->
          <div class="flex items-start gap-4 mb-6 pb-6 border-b border-white/10">
            <span class="text-4xl font-bold text-primary">${circleNum}</span>
            <div class="flex-1">
              <h3 class="text-2xl font-bold text-white mb-2">${item.name || '수술명 없음'}</h3>
              <div class="flex flex-wrap items-center gap-3">
                <span class="px-3 py-1 rounded-lg bg-primary/20 text-primary font-mono text-sm">${item.code || 'N/A'}</span>
                ${item.dataSource === 'database' ? `
                  <span class="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                    <i class="fas fa-database mr-1"></i>DB 데이터
                  </span>
                ` : `
                  <span class="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-semibold">
                    <i class="fas fa-robot mr-1"></i>AI 분석
                  </span>
                `}
              </div>
            </div>
          </div>
          
          ${item.description ? `
            <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
              <i class="fas fa-info-circle text-blue-400 mr-2"></i>
              <span class="text-gray-300">${item.description}</span>
            </div>
          ` : ''}
          
          ${item.warning ? `
            <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-6">
              <i class="fas fa-exclamation-triangle text-yellow-400 mr-2"></i>
              <span class="text-yellow-300">${item.warning}</span>
            </div>
          ` : ''}
          
          <!-- 1-5종 수술비 특약 -->
          ${item.typeBenefits && item.typeBenefits.length > 0 ? `
            <div class="mb-6">
              <h4 class="flex items-center gap-2 text-lg font-bold text-white mb-4">
                <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <i class="fas fa-list-ol text-green-400"></i>
                </div>
                1-5종 수술비 특약 (${item.typeBenefits.length}개 보험사)
              </h4>
              <div class="space-y-3">
                ${item.typeBenefits.map(b => `
                  <div class="p-4 rounded-xl bg-white/5 border-l-4 border-green-500">
                    <div class="flex justify-between items-center">
                      <div>
                        <div class="font-semibold text-white">${b.company_name}</div>
                        <div class="text-sm text-gray-400">${b.surgery_type}종 수술</div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold text-green-400">${b.benefit_amount ? formatCurrency(b.benefit_amount) : '-'}</div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- N대 수술비 특약 -->
          ${item.nBenefits && item.nBenefits.length > 0 ? `
            <div class="mb-6">
              <h4 class="flex items-center gap-2 text-lg font-bold text-white mb-4">
                <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <i class="fas fa-hospital text-purple-400"></i>
                </div>
                N대 수술비 특약 (${item.nBenefits.length}개 보험사)
              </h4>
              <div class="space-y-3">
                ${item.nBenefits.map(b => `
                  <div class="p-4 rounded-xl bg-white/5 border-l-4 ${b.is_covered ? 'border-green-500' : 'border-red-500'}">
                    <div class="flex justify-between items-center">
                      <div>
                        <div class="font-semibold text-white">${b.company_name}</div>
                        <div class="text-sm text-gray-400">${b.total_n}대 특약 ${b.sub_category ? '- ' + b.sub_category : ''}</div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold ${b.is_covered ? 'text-green-400' : 'text-red-400'}">${b.is_covered ? '✔ 보장' : '✗ 미보장'}</div>
                        ${b.benefit_amount && b.is_covered ? `<div class="text-sm text-purple-400">${formatCurrency(b.benefit_amount)}</div>` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- 리스크 정보 -->
          ${item.risk ? `
            <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <h4 class="flex items-center gap-2 font-bold text-white mb-3">
                <i class="fas fa-exclamation-triangle text-yellow-400"></i>
                리스크 정보
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                ${item.risk.recurrence_risk ? `<div><span class="text-gray-400">재발 가능성:</span> <span class="text-gray-300">${item.risk.recurrence_risk}</span></div>` : ''}
                ${item.risk.reoperation_risk ? `<div><span class="text-gray-400">재수술 필요성:</span> <span class="text-gray-300">${item.risk.reoperation_risk}</span></div>` : ''}
                ${item.risk.complication_risk ? `<div><span class="text-gray-400">합병증 위험:</span> <span class="text-gray-300">${item.risk.complication_risk}</span></div>` : ''}
                ${item.risk.additional_treatment ? `<div><span class="text-gray-400">추가 치료:</span> <span class="text-gray-300">${item.risk.additional_treatment}</span></div>` : ''}
              </div>
              ${item.risk.insurance_notes ? `
                <div class="mt-4 p-3 rounded-lg bg-yellow-500/10 text-sm text-yellow-300">
                  <strong>보험 청구 주의:</strong> ${item.risk.insurance_notes}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else if (result.answer) {
    // AI 답변만 있는 경우
    html += `
      <div class="result-card p-6 md:p-8">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <i class="fas fa-robot text-primary text-xl"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">AI 분석 결과</h3>
            <p class="text-gray-400 text-sm">Perplexity + GPT 하이브리드 검색</p>
          </div>
        </div>
        <div class="prose prose-invert max-w-none">
          <div class="text-gray-300 leading-relaxed whitespace-pre-wrap">${result.answer}</div>
        </div>
      </div>
    `;
  } else {
    html = `
      <div class="result-card p-8 text-center">
        <i class="fas fa-search text-4xl text-gray-500 mb-4"></i>
        <h3 class="text-xl font-bold text-white mb-2">검색 결과가 없습니다</h3>
        <p class="text-gray-400">다른 검색어로 다시 시도해주세요.</p>
      </div>
    `;
  }
  
  resultsDiv.innerHTML = html;
}

// ==================== 다운로드 기능 ====================

function downloadAsTXT() {
  if (!currentReport) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  
  let text = `
========================================
STUDIO JU AI - 보험 수술비 특약 분석 리포트
========================================
분석일: ${new Date().toLocaleString('ko-KR')}
검색어: ${currentReport.query}

`;

  if (currentReport.results) {
    currentReport.results.forEach((item, index) => {
      text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[${index + 1}] ${item.name || '수술명 없음'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
코드: ${item.code || 'N/A'}
${item.description ? `설명: ${item.description}` : ''}

`;
      
      if (item.typeBenefits && item.typeBenefits.length > 0) {
        text += `▶ 1-5종 수술비 특약:\n`;
        item.typeBenefits.forEach(b => {
          text += `  • ${b.company_name} (${b.surgery_type}종): ${b.benefit_amount ? formatCurrency(b.benefit_amount) : '-'}\n`;
        });
        text += '\n';
      }
      
      if (item.nBenefits && item.nBenefits.length > 0) {
        text += `▶ N대 수술비 특약:\n`;
        item.nBenefits.forEach(b => {
          text += `  • ${b.company_name} (${b.total_n}대): ${b.is_covered ? '보장' : '미보장'} ${b.benefit_amount ? formatCurrency(b.benefit_amount) : ''}\n`;
        });
        text += '\n';
      }
    });
  } else if (currentReport.answer) {
    text += currentReport.answer;
  }

  text += `
========================================
© 2025 STUDIO JU AI. All rights reserved.
========================================
`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `보험분석_${currentReport.query}_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function downloadAsPDF() {
  // For now, just download as TXT
  alert('PDF 다운로드는 준비 중입니다. TXT 파일로 다운로드합니다.');
  downloadAsTXT();
}

// ==================== 유틸리티 ====================

function formatCurrency(amount) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
}

// ==================== 관리자 기능 ====================

function showAdminPanel() {
  const password = prompt('관리자 비밀번호를 입력하세요:');
  
  if (password !== ADMIN_PASSWORD) {
    alert('비밀번호가 틀렸습니다.');
    return;
  }
  
  document.getElementById('adminModal').classList.remove('hidden');
}

function closeAdminPanel() {
  document.getElementById('adminModal').classList.add('hidden');
}

function showPDFUpload() {
  document.getElementById('adminModal').classList.add('hidden');
  document.getElementById('pdfUploadModal').classList.remove('hidden');
}

function closePDFUpload() {
  document.getElementById('pdfUploadModal').classList.add('hidden');
}

async function uploadAndAnalyzePDF() {
  const company = document.getElementById('insuranceCompanySelect').value;
  const fileInput = document.getElementById('pdfFileInput');
  const file = fileInput.files[0];
  
  if (!company) {
    alert('보험사를 선택하세요.');
    return;
  }
  
  if (!file) {
    alert('PDF 파일을 선택하세요.');
    return;
  }
  
  document.getElementById('pdfAnalysisProgress').classList.remove('hidden');
  document.getElementById('pdfAnalysisStatus').textContent = 'PDF 분석 중...';
  
  const formData = new FormData();
  formData.append('company', company);
  formData.append('file', file);
  
  try {
    const response = await fetch('/api/admin/analyze-pdf', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    document.getElementById('pdfAnalysisProgress').classList.add('hidden');
    
    if (result.success) {
      document.getElementById('pdfAnalysisResult').innerHTML = `
        <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div class="font-bold text-green-400 mb-2">✔ 분석 완료!</div>
          <div class="text-gray-300">총 ${result.itemCount}개 항목이 추출되었습니다.</div>
        </div>
      `;
      document.getElementById('pdfAnalysisResult').classList.remove('hidden');
    } else {
      alert('PDF 분석 실패: ' + result.error);
    }
  } catch (error) {
    document.getElementById('pdfAnalysisProgress').classList.add('hidden');
    alert('오류가 발생했습니다: ' + error.message);
  }
}

async function syncHIRAData() {
  if (!confirm('HIRA API 동기화를 시작하시겠습니까?')) {
    return;
  }
  
  document.getElementById('loadingOverlay').classList.remove('hidden');
  
  try {
    const response = await fetch('/api/admin/hira-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    document.getElementById('loadingOverlay').classList.add('hidden');
    
    if (result.success) {
      alert(`✔ HIRA API 동기화 완료!\n\n총 ${result.total}개 코드, 신규 저장: ${result.saved}개`);
    } else {
      alert('동기화 실패: ' + result.error);
    }
  } catch (error) {
    document.getElementById('loadingOverlay').classList.add('hidden');
    alert('오류가 발생했습니다: ' + error.message);
  }
}

async function triggerAutoUpdate() {
  const companyUrl = prompt('보험사 홈페이지 URL:');
  if (!companyUrl) return;
  
  const companyCode = prompt('보험사 코드 (예: SAMSUNG, HYUNDAI):');
  if (!companyCode) return;
  
  document.getElementById('loadingOverlay').classList.remove('hidden');
  
  try {
    const response = await fetch('/api/admin/auto-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_url: companyUrl, company_code: companyCode })
    });
    
    const result = await response.json();
    
    document.getElementById('loadingOverlay').classList.add('hidden');
    
    if (result.success) {
      alert(`✔ 자동 업데이트 완료!\n\n추가된 수술: ${result.surgeries_added}개\n추가된 특약: ${result.benefits_added}개`);
      location.reload();
    } else {
      alert('업데이트 실패: ' + result.error);
    }
  } catch (error) {
    document.getElementById('loadingOverlay').classList.add('hidden');
    alert('오류가 발생했습니다: ' + error.message);
  }
}
