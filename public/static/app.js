// 전역 변수
let currentReport = null;
const ADMIN_PASSWORD = 'xivix2026';
let surgeryDB = [];
let diagnosisDB = [];
let currentTab = 'icd';
let currentMainTab = 'diagnosis';
let adminAuthenticated = false;
let selectedImageFile = null;

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
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon(false);
  } else {
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    updateThemeIcon(true);
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    updateThemeIcon(false);
  }
}

function updateThemeIcon(isLight) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = isLight ? 'fas fa-moon t3' : 'fas fa-sun t3';
  }
}

// ==================== 메인 탭 전환 ====================

function switchMainTab(tab) {
  currentMainTab = tab;
  const btnDiagnosis = document.getElementById('mainTabDiagnosis');
  const btnImaging = document.getElementById('mainTabImaging');
  const diagnosisSection = document.getElementById('diagnosisSection');
  const imagingSection = document.getElementById('imagingSection');

  if (tab === 'diagnosis') {
    btnDiagnosis.classList.add('active');
    btnImaging.classList.remove('active');
    diagnosisSection.classList.remove('hidden');
    imagingSection.classList.add('hidden');
  } else {
    btnImaging.classList.add('active');
    btnDiagnosis.classList.remove('active');
    imagingSection.classList.remove('hidden');
    diagnosisSection.classList.add('hidden');
  }
}

// ==================== 서브 탭 전환 ====================

function switchTab(tab) {
  currentTab = tab;
  const tabICD = document.getElementById('tabICD');
  const tabAI = document.getElementById('tabAI');
  const icdSearch = document.getElementById('icdSearch');
  const aiSearch = document.getElementById('aiSearch');

  if (tab === 'icd') {
    tabICD.classList.add('active');
    tabAI.classList.remove('active');
    icdSearch.classList.remove('hidden');
    aiSearch.classList.add('hidden');
  } else {
    tabAI.classList.add('active');
    tabICD.classList.remove('active');
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
    console.log('[DB] ' + surgeryDB.length + '개 EDI 수가코드 데이터 로드 완료');
  } catch (error) {
    console.error('EDI DB 로드 실패:', error);
  }
}

async function loadDiagnosisDB() {
  try {
    const response = await fetch('/static/diagnosis-codes.json');
    diagnosisDB = await response.json();
    console.log('[DB] ' + diagnosisDB.length + '개 ICD 진단코드 데이터 로드 완료');
  } catch (error) {
    console.error('ICD DB 로드 실패:', error);
  }
}

// ==================== 기관 로드 ====================

async function loadOrganizations() {
  try {
    const response = await fetch('/static/organizations.json');
    const data = await response.json();

    if (data.insurance) {
      document.getElementById('insuranceCount').textContent = data.insurance.length + '개';
      document.getElementById('insuranceOrgs').innerHTML = data.insurance.map(org => `
        <a href="${org.url}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg transition-colors t2 text-sm" style="border: 1px solid transparent;" onmouseover="this.style.background='rgba(0,200,83,0.06)'" onmouseout="this.style.background=''">
          <i class="fas fa-external-link-alt text-xs t3"></i>
          ${org.name}
        </a>
      `).join('');
    }

    if (data.related) {
      document.getElementById('relatedCount').textContent = data.related.length + '개';
      document.getElementById('relatedOrgs').innerHTML = data.related.map(org => `
        <a href="${org.url}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg transition-colors t2 text-sm" onmouseover="this.style.background='rgba(0,200,83,0.06)'" onmouseout="this.style.background=''">
          <i class="fas fa-external-link-alt text-xs t3"></i>
          ${org.name}
        </a>
      `).join('');
    }

    if (data.overseas) {
      document.getElementById('overseasCount').textContent = data.overseas.length + '개';
      document.getElementById('overseasOrgs').innerHTML = data.overseas.map(org => `
        <a href="${org.url}" target="_blank" class="flex items-center gap-2 p-2 rounded-lg transition-colors t2 text-sm" onmouseover="this.style.background='rgba(0,200,83,0.06)'" onmouseout="this.style.background=''">
          <i class="fas fa-external-link-alt text-xs t3"></i>
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

  const q = query.toLowerCase();
  const diagnosisResults = diagnosisDB.filter(item => {
    return item.code.toLowerCase().includes(q) ||
           item.name.toLowerCase().includes(q) ||
           (item.description && item.description.toLowerCase().includes(q));
  });

  const surgeryResults = surgeryDB.filter(item => {
    return item.code.toLowerCase().includes(q) ||
           item.name.toLowerCase().includes(q);
  });

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
    <div class="suggestion-item p-4 cursor-pointer" style="border-bottom: 1px solid var(--card-border);"
         onclick="selectDBSuggestion('${item.code}', '${item.name}')">
      <div class="font-semibold t1">${item.name}</div>
      <div class="flex items-center gap-2 mt-1">
        <span class="px-2 py-0.5 rounded text-xs font-mono" style="background: rgba(0,200,83,0.1); color: var(--green);">${item.code}</span>
        <span class="text-xs t3">ICD-10</span>
        ${item.category ? `<span class="text-xs t3">${item.category}</span>` : ''}
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

  queryDisplay.textContent = '"' + query + '" 검색 결과';
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  let html = '';

  if (diagnosisResults.length > 0) {
    html += `
      <div class="result-card p-6 md:p-8 mb-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(59,130,246,0.1);">
            <i class="fas fa-stethoscope text-blue-500 text-xl"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold t1">ICD-10 진단코드</h3>
            <p class="t3 text-sm">${diagnosisResults.length}개 결과 (병원 진단서 코드)</p>
          </div>
          <span class="ml-auto px-3 py-1 rounded-full text-xs font-semibold" style="background: rgba(59,130,246,0.1); color: #3b82f6;">정확도 100%</span>
        </div>

        <div class="space-y-4">
          ${diagnosisResults.map((item, index) => `
            <div class="p-4 rounded-xl" style="background: rgba(59,130,246,0.04); border-left: 4px solid #3b82f6;">
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold text-blue-500">${index + 1}</span>
                <div class="flex-1">
                  <h4 class="font-bold text-lg t1 mb-2">${item.name}</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex items-center gap-2">
                      <span class="t3">진단코드:</span>
                      <span class="px-3 py-1 rounded-lg font-mono font-bold" style="background: rgba(59,130,246,0.1); color: #3b82f6;">${item.code}</span>
                    </div>
                    ${item.chapter ? `<div><span class="t3">대분류:</span> <span class="t2">${item.chapter}</span></div>` : ''}
                    ${item.section ? `<div><span class="t3">중분류:</span> <span class="t2">${item.section}</span></div>` : ''}
                    ${item.category ? `<div><span class="t3">질환군:</span> <span class="t2">${item.category}</span></div>` : ''}
                    ${item.description ? `
                      <div class="mt-3 p-3 rounded-lg t2 leading-relaxed" style="background: rgba(59,130,246,0.04);">
                        <i class="fas fa-info-circle text-blue-500 mr-2"></i>${item.description}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="mt-6 p-4 rounded-xl" style="background: rgba(59,130,246,0.04); border: 1px solid rgba(59,130,246,0.1);">
          <p class="text-sm t2">
            <i class="fas fa-hospital text-blue-500 mr-2"></i>
            <strong>ICD-10 진단코드</strong>는 실제 병원 진단서, 처방전, 입원기록에 표기되는 질병분류코드입니다. 보험 청구 시 진단서에서 이 코드를 확인하세요.
          </p>
        </div>
      </div>
    `;
  }

  if (surgeryResults.length > 0) {
    html += `
      <div class="result-card p-6 md:p-8 mb-6">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(0,200,83,0.1);">
            <i class="fas fa-procedures text-xl" style="color: var(--green);"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold t1">EDI 수가코드</h3>
            <p class="t3 text-sm">${surgeryResults.length}개 결과 (수술/시술/검사 코드)</p>
          </div>
        </div>

        <div class="space-y-4">
          ${surgeryResults.map((item, index) => `
            <div class="p-4 rounded-xl" style="background: rgba(0,200,83,0.04); border-left: 4px solid var(--green);">
              <div class="flex items-start gap-4">
                <span class="text-2xl font-bold" style="color: var(--green);">${index + 1}</span>
                <div class="flex-1">
                  <h4 class="font-bold text-lg t1 mb-2">${item.name}</h4>
                  <div class="flex items-center gap-2">
                    <span class="t3">수가코드:</span>
                    <span class="px-3 py-1 rounded-lg font-mono" style="background: rgba(0,200,83,0.1); color: var(--green);">${item.code}</span>
                  </div>
                  ${item.category ? `<div class="mt-2 text-sm t3">분류: ${item.category}</div>` : ''}
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

  document.getElementById('loadingOverlay').classList.remove('hidden');

  try {
    const response = await fetch(`/api/gpt-search?q=${encodeURIComponent(query)}`);
    const result = await response.json();
    document.getElementById('loadingOverlay').classList.add('hidden');

    if (result.success) {
      displayGPTResults(result, query);
    } else {
      alert('검색 오류: ' + (result.error || '알 수 없는 오류'));
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

  queryDisplay.textContent = '"' + query + '" AI 분석 결과';
  resultsSection.classList.remove('hidden');
  downloadButtons.classList.remove('hidden');
  currentReport = { query, ...result };
  resultsSection.scrollIntoView({ behavior: 'smooth' });

  let html = '';
  if (result.stats) {
    html += `
      <div class="result-card p-4 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <i class="fas fa-chart-bar text-xl" style="color: var(--green);"></i>
            <span class="font-bold t1">검색 통계</span>
          </div>
          <div class="flex flex-wrap gap-3">
            <span class="px-3 py-1 rounded-full text-sm font-semibold" style="background: rgba(0,200,83,0.1); color: var(--green);">
              <i class="fas fa-database mr-1"></i>DB: ${result.stats.fromDB}개
            </span>
            <span class="px-3 py-1 rounded-full text-sm font-semibold" style="background: rgba(249,115,22,0.1); color: #f97316;">
              <i class="fas fa-robot mr-1"></i>AI: ${result.stats.fromGPT}개
            </span>
            <span class="px-3 py-1 rounded-full text-sm font-semibold" style="background: rgba(0,0,0,0.05); color: var(--text-3);">
              <i class="fas fa-bolt mr-1"></i>${result.stats.searchTime || 0}ms
            </span>
          </div>
        </div>
      </div>
    `;
  }

  if (result.results && result.results.length > 0) {
    html += result.results.map((item, index) => {
      return `
        <div class="result-card p-6 md:p-8 mb-6">
          <div class="flex items-start gap-4 mb-6 pb-6" style="border-bottom: 1px solid var(--card-border);">
            <span class="text-4xl font-bold" style="color: var(--green);">${index + 1}</span>
            <div class="flex-1">
              <h3 class="text-2xl font-bold t1 mb-2">${item.name || '수술명 없음'}</h3>
              <div class="flex flex-wrap items-center gap-3">
                <span class="px-3 py-1 rounded-lg font-mono text-sm" style="background: rgba(0,200,83,0.1); color: var(--green);">${item.code || 'N/A'}</span>
                ${item.dataSource === 'database' ?
                  `<span class="px-3 py-1 rounded-full text-xs font-semibold" style="background: rgba(0,200,83,0.1); color: var(--green);"><i class="fas fa-database mr-1"></i>DB 데이터</span>` :
                  `<span class="px-3 py-1 rounded-full text-xs font-semibold" style="background: rgba(249,115,22,0.1); color: #f97316;"><i class="fas fa-robot mr-1"></i>AI 분석</span>`
                }
              </div>
            </div>
          </div>

          ${item.description ? `
            <div class="p-4 rounded-xl mb-6" style="background: rgba(59,130,246,0.04); border: 1px solid rgba(59,130,246,0.1);">
              <i class="fas fa-info-circle text-blue-500 mr-2"></i>
              <span class="t2">${item.description}</span>
            </div>
          ` : ''}

          ${item.warning ? `
            <div class="p-4 rounded-xl mb-6" style="background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.15);">
              <i class="fas fa-exclamation-triangle mr-2" style="color: #ca8a04;"></i>
              <span style="color: #a16207;">${item.warning}</span>
            </div>
          ` : ''}

          ${item.typeBenefits && item.typeBenefits.length > 0 ? `
            <div class="mb-6">
              <h4 class="flex items-center gap-2 text-lg font-bold t1 mb-4">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(0,200,83,0.1);">
                  <i class="fas fa-list-ol" style="color: var(--green);"></i>
                </div>
                1-5종 수술비 특약 (${item.typeBenefits.length}개 보험사)
              </h4>
              <div class="space-y-3">
                ${item.typeBenefits.map(b => `
                  <div class="p-4 rounded-xl" style="background: rgba(0,200,83,0.03); border-left: 4px solid var(--green);">
                    <div class="flex justify-between items-center">
                      <div>
                        <div class="font-semibold t1">${b.company_name}</div>
                        <div class="text-sm t3">${b.surgery_type}종 수술</div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold" style="color: var(--green);">${b.benefit_amount ? formatCurrency(b.benefit_amount) : '-'}</div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${item.nBenefits && item.nBenefits.length > 0 ? `
            <div class="mb-6">
              <h4 class="flex items-center gap-2 text-lg font-bold t1 mb-4">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(139,92,246,0.1);">
                  <i class="fas fa-hospital text-purple-500"></i>
                </div>
                N대 수술비 특약 (${item.nBenefits.length}개 보험사)
              </h4>
              <div class="space-y-3">
                ${item.nBenefits.map(b => `
                  <div class="p-4 rounded-xl" style="border-left: 4px solid ${b.is_covered ? 'var(--green)' : 'var(--red)'}; background: ${b.is_covered ? 'rgba(0,200,83,0.03)' : 'rgba(220,38,38,0.03)'};">
                    <div class="flex justify-between items-center">
                      <div>
                        <div class="font-semibold t1">${b.company_name}</div>
                        <div class="text-sm t3">${b.total_n}대 특약 ${b.sub_category ? '- ' + b.sub_category : ''}</div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold" style="color: ${b.is_covered ? 'var(--green)' : 'var(--red)'};">${b.is_covered ? '<i class="fas fa-check-circle mr-1"></i>보장' : '<i class="fas fa-times-circle mr-1"></i>미보장'}</div>
                        ${b.benefit_amount && b.is_covered ? `<div class="text-sm text-purple-500">${formatCurrency(b.benefit_amount)}</div>` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${item.risk ? `
            <div class="p-4 rounded-xl" style="background: rgba(234,179,8,0.04); border: 1px solid rgba(234,179,8,0.1);">
              <h4 class="flex items-center gap-2 font-bold t1 mb-3">
                <i class="fas fa-exclamation-triangle" style="color: #ca8a04;"></i>
                리스크 정보
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                ${item.risk.recurrence_risk ? `<div><span class="t3">재발 가능성:</span> <span class="t2">${item.risk.recurrence_risk}</span></div>` : ''}
                ${item.risk.reoperation_risk ? `<div><span class="t3">재수술 필요성:</span> <span class="t2">${item.risk.reoperation_risk}</span></div>` : ''}
                ${item.risk.complication_risk ? `<div><span class="t3">합병증 위험:</span> <span class="t2">${item.risk.complication_risk}</span></div>` : ''}
                ${item.risk.additional_treatment ? `<div><span class="t3">추가 치료:</span> <span class="t2">${item.risk.additional_treatment}</span></div>` : ''}
              </div>
              ${item.risk.insurance_notes ? `
                <div class="mt-4 p-3 rounded-lg text-sm" style="background: rgba(234,179,8,0.06); color: #a16207;">
                  <strong>보험 청구 주의:</strong> ${item.risk.insurance_notes}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else if (result.answer) {
    html += `
      <div class="result-card p-6 md:p-8">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(0,200,83,0.1);">
            <i class="fas fa-robot text-xl" style="color: var(--green);"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold t1">AI 분석 결과</h3>
            <p class="t3 text-sm">Perplexity + GPT 하이브리드 검색</p>
          </div>
        </div>
        <div class="prose max-w-none">
          <div class="t2 leading-relaxed whitespace-pre-wrap">${result.answer}</div>
        </div>
      </div>
    `;
  } else {
    html = `
      <div class="result-card p-8 text-center">
        <i class="fas fa-search text-4xl t3 mb-4"></i>
        <h3 class="text-xl font-bold t1 mb-2">검색 결과가 없습니다</h3>
        <p class="t3">다른 검색어로 다시 시도해주세요.</p>
      </div>
    `;
  }

  resultsDiv.innerHTML = html;
}

// ==================== 의료 영상 분석 ====================

function handleImageSelect(input) {
  const file = input.files[0];
  if (file) {
    selectedImageFile = file;
    showImagePreview(file);
    document.getElementById('analyzeImageBtn').disabled = false;
  }
}

function handleImageDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  document.getElementById('uploadArea').classList.remove('dragover');

  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    selectedImageFile = file;
    document.getElementById('imageFileInput').files = event.dataTransfer.files;
    showImagePreview(file);
    document.getElementById('analyzeImageBtn').disabled = false;
  }
}

function showImagePreview(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('previewImage').src = e.target.result;
    document.getElementById('previewFileName').textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    document.getElementById('uploadPlaceholder').classList.add('hidden');
    document.getElementById('uploadPreview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function analyzeImage() {
  if (!selectedImageFile) {
    alert('이미지를 먼저 업로드해주세요.');
    return;
  }

  const btn = document.getElementById('analyzeImageBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner inline-block mr-3" style="width:20px;height:20px;border-width:2px;vertical-align:middle;"></div>AI 분석 중...';

  const formData = new FormData();
  formData.append('image', selectedImageFile);
  formData.append('patientName', document.getElementById('patientName').value);
  formData.append('examDate', document.getElementById('examDate').value);
  formData.append('examType', document.getElementById('examType').value);

  try {
    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success && result.analysis) {
      displayImageAnalysis(result.analysis, result.examType);
    } else {
      alert('분석 실패: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('Image analysis error:', error);
    alert('영상 분석 중 오류가 발생했습니다: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-microscope mr-2"></i>AI 영상 분석 시작';
  }
}

function displayImageAnalysis(analysis, examType) {
  const resultDiv = document.getElementById('imageAnalysisResult');
  resultDiv.classList.remove('hidden');

  if (analysis.raw) {
    resultDiv.innerHTML = `
      <div class="result-card p-6">
        <h3 class="text-lg font-bold t1 mb-4"><i class="fas fa-file-medical mr-2" style="color: var(--green);"></i>분석 결과</h3>
        <div class="t2 leading-relaxed whitespace-pre-wrap">${analysis.findings}</div>
      </div>
    `;
    return;
  }

  let html = `
    <div class="result-card p-6 space-y-6">
      <div class="flex items-center gap-3 pb-4" style="border-bottom: 1px solid var(--card-border);">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(0,200,83,0.1);">
          <i class="fas fa-file-medical" style="color: var(--green);"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold t1">AI 영상 판독 결과</h3>
          <p class="text-xs t3">${examType ? examType + ' | ' : ''}${new Date().toLocaleString('ko-KR')}${analysis.confidence ? ' | 신뢰도: ' + analysis.confidence : ''}</p>
        </div>
      </div>
  `;

  if (analysis.findings) {
    html += `
      <div>
        <h4 class="font-semibold t1 mb-2"><i class="fas fa-search-plus mr-2" style="color: var(--green);"></i>주요 소견</h4>
        <div class="p-4 rounded-xl t2 leading-relaxed" style="background: rgba(0,200,83,0.03);">${analysis.findings}</div>
      </div>
    `;
  }

  if (analysis.impression) {
    html += `
      <div>
        <h4 class="font-semibold t1 mb-2"><i class="fas fa-clipboard-check mr-2 text-blue-500"></i>종합 인상</h4>
        <div class="p-4 rounded-xl t2 leading-relaxed" style="background: rgba(59,130,246,0.04);">${analysis.impression}</div>
      </div>
    `;
  }

  if (analysis.icd10_codes && analysis.icd10_codes.length > 0) {
    html += `
      <div>
        <h4 class="font-semibold t1 mb-2"><i class="fas fa-tags mr-2 text-purple-500"></i>관련 ICD-10 코드</h4>
        <div class="flex flex-wrap gap-2">
          ${analysis.icd10_codes.map(c => `
            <span class="px-3 py-2 rounded-lg text-sm" style="background: rgba(139,92,246,0.08); color: #7c3aed;">
              <strong>${c.code}</strong> ${c.name}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (analysis.recommended_tests && analysis.recommended_tests.length > 0) {
    html += `
      <div>
        <h4 class="font-semibold t1 mb-2"><i class="fas fa-vial mr-2" style="color: #f97316;"></i>권장 추가 검사</h4>
        <ul class="space-y-1">
          ${analysis.recommended_tests.map(t => `<li class="flex items-center gap-2 t2 text-sm"><i class="fas fa-chevron-right text-xs t3"></i>${t}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (analysis.recommended_departments && analysis.recommended_departments.length > 0) {
    html += `
      <div>
        <h4 class="font-semibold t1 mb-2"><i class="fas fa-hospital mr-2 text-blue-500"></i>권장 진료과</h4>
        <div class="flex flex-wrap gap-2">
          ${analysis.recommended_departments.map(d => `<span class="px-3 py-2 rounded-lg text-sm" style="background: rgba(59,130,246,0.08); color: #3b82f6;">${d}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (analysis.cautions && analysis.cautions.length > 0) {
    html += `
      <div>
        <h4 class="font-semibold t1 mb-2"><i class="fas fa-exclamation-circle mr-2" style="color: #ca8a04;"></i>주의사항</h4>
        <ul class="space-y-1">
          ${analysis.cautions.map(c => `<li class="flex items-start gap-2 t2 text-sm"><i class="fas fa-chevron-right text-xs t3 mt-1"></i>${c}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  html += `
      <div class="p-4 rounded-xl" style="background: rgba(220,38,38,0.04); border: 1px solid rgba(220,38,38,0.1);">
        <p class="text-sm t2">
          <i class="fas fa-exclamation-triangle mr-2" style="color: var(--red);"></i>
          <strong>교육용 참고 자료:</strong> ${analysis.disclaimer || '본 분석은 교육용 참고 자료이며 실제 진단을 대체하지 않습니다. 정확한 진단은 반드시 전문 의료진과 상담하세요.'}
        </p>
      </div>
    </div>
  `;

  resultDiv.innerHTML = html;
  resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// ==================== 다운로드 기능 ====================

function downloadAsTXT() {
  if (!currentReport) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  let text = `
========================================
보험스캔 - 보험 수술비 특약 분석 리포트
========================================
분석일: ${new Date().toLocaleString('ko-KR')}
검색어: ${currentReport.query}

`;

  if (currentReport.results) {
    currentReport.results.forEach((item, index) => {
      text += `
---
[${index + 1}] ${item.name || '수술명 없음'}
---
코드: ${item.code || 'N/A'}
${item.description ? `설명: ${item.description}` : ''}

`;

      if (item.typeBenefits && item.typeBenefits.length > 0) {
        text += `> 1-5종 수술비 특약:\n`;
        item.typeBenefits.forEach(b => {
          text += `  - ${b.company_name} (${b.surgery_type}종): ${b.benefit_amount ? formatCurrency(b.benefit_amount) : '-'}\n`;
        });
        text += '\n';
      }

      if (item.nBenefits && item.nBenefits.length > 0) {
        text += `> N대 수술비 특약:\n`;
        item.nBenefits.forEach(b => {
          text += `  - ${b.company_name} (${b.total_n}대): ${b.is_covered ? '보장' : '미보장'} ${b.benefit_amount ? formatCurrency(b.benefit_amount) : ''}\n`;
        });
        text += '\n';
      }
    });
  } else if (currentReport.answer) {
    text += currentReport.answer;
  }

  text += `
========================================
(c) 2025 보험스캔. All rights reserved.
본 분석은 교육용 참고 자료이며 실제 진단이나 보험 심사를 대체하지 않습니다.
========================================
`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '보험분석_' + currentReport.query + '_' + new Date().toISOString().split('T')[0] + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function downloadAsPDF() {
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

function getAdminHeaders() {
  return { 'X-Admin-Password': ADMIN_PASSWORD };
}

function showAdminPanel() {
  const password = prompt('관리자 비밀번호를 입력하세요:');

  if (password !== ADMIN_PASSWORD) {
    alert('비밀번호가 틀렸습니다.');
    return;
  }

  adminAuthenticated = true;
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
    const response = await fetch('/api/admin/analyze-pdf?pw=' + encodeURIComponent(ADMIN_PASSWORD), {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    document.getElementById('pdfAnalysisProgress').classList.add('hidden');

    if (result.success) {
      document.getElementById('pdfAnalysisResult').innerHTML = `
        <div class="p-4 rounded-xl" style="background: rgba(0,200,83,0.06); border: 1px solid rgba(0,200,83,0.15);">
          <div class="font-bold" style="color: var(--green);"><i class="fas fa-check-circle mr-2"></i>분석 완료!</div>
          <div class="t2 mt-1">총 ${result.itemCount}개 항목이 추출되었습니다.</div>
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
    const response = await fetch('/api/admin/hira-sync?pw=' + encodeURIComponent(ADMIN_PASSWORD), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    document.getElementById('loadingOverlay').classList.add('hidden');

    if (result.success) {
      alert('HIRA API 동기화 완료!\n\n총 ' + result.total + '개 코드, 신규 저장: ' + result.saved + '개');
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
    const response = await fetch('/api/admin/auto-update?pw=' + encodeURIComponent(ADMIN_PASSWORD), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
      body: JSON.stringify({ company_url: companyUrl, company_code: companyCode })
    });

    const result = await response.json();
    document.getElementById('loadingOverlay').classList.add('hidden');

    if (result.success) {
      alert('자동 업데이트 완료!\n\n추가된 수술: ' + result.surgeries_added + '개\n추가된 특약: ' + result.benefits_added + '개');
      location.reload();
    } else {
      alert('업데이트 실패: ' + result.error);
    }
  } catch (error) {
    document.getElementById('loadingOverlay').classList.add('hidden');
    alert('오류가 발생했습니다: ' + error.message);
  }
}
