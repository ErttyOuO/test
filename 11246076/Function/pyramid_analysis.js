/**
 * Protection Pyramid Analysis Logic
 * Dynamically generates the Pyramid UI with detailed calculations.
 */

// Global variable to store latest policies for re-render
let currentPolicies = [];

function analyzePolicies(policies) {
    // Initialize detailed coverage data based on new rules
    const coverage = {
        // Bottom Layer
        accident_inpatient: { daily: 0, lifetime: 0, term: 0, policies: [] },
        sickness_inpatient: { daily: 0, lifetime: 0, term: 0, policies: [] },
        surgery: { outpatient: 0, inpatient: 0, lifetime: 0, term: 0, policies: [] },
        treatment: { limit: 0, policies: [] },
        reimbursement: { accident: 0, medical: 0, lifetime: 0, term: 0, policies: [] },

        // Middle Layer
        critical_illness: { present: 0, policies: [] },
        cancer: { present: 0, policies: [] },

        // Top Layer
        long_term_care: { monthly: 0, policies: [] },

        // Side
        life_insurance: { general: 0, accident: 0, policies: [] },
        assets: { reserve: 0, policies: [] }
    };

    if (!policies || policies.length === 0) return coverage;

    policies.forEach(p => {
        const d = p.details || mockDetailsFromTitle(p.title);
        const policyTitle = p.title || '未命名保單';

        // 1. Bottom Layer
        if (d.accident_inpatient) {
            const val = (d.accident_inpatient.lifetime || 0) + (d.accident_inpatient.term || 0);
            coverage.accident_inpatient.daily += val;
            coverage.accident_inpatient.lifetime += d.accident_inpatient.lifetime || 0;
            coverage.accident_inpatient.term += d.accident_inpatient.term || 0;
            coverage.accident_inpatient.policies.push({ name: policyTitle, amount: val, unit: '/日' });
        }
        if (d.sickness_inpatient) {
            const val = (d.sickness_inpatient.lifetime || 0) + (d.sickness_inpatient.term || 0);
            coverage.sickness_inpatient.daily += val;
            coverage.sickness_inpatient.lifetime += d.sickness_inpatient.lifetime || 0;
            coverage.sickness_inpatient.term += d.sickness_inpatient.term || 0;
            coverage.sickness_inpatient.policies.push({ name: policyTitle, amount: val, unit: '/日' });
        }
        if (d.surgery) {
            coverage.surgery.outpatient = Math.max(coverage.surgery.outpatient, d.surgery.outpatient || 0);
            coverage.surgery.inpatient = Math.max(coverage.surgery.inpatient, d.surgery.inpatient || 0);
            coverage.surgery.lifetime += d.surgery.lifetime || 0;
            coverage.surgery.term += d.surgery.term || 0;
            coverage.surgery.policies.push({ name: policyTitle, amount: Math.max(d.surgery.outpatient || 0, d.surgery.inpatient || 0), unit: '(最高)' });
        }
        if (d.reimbursement) {
            coverage.reimbursement.accident += d.reimbursement.accident || 0;
            coverage.reimbursement.medical += d.reimbursement.medical || 0;
            coverage.reimbursement.lifetime += d.reimbursement.lifetime || 0;
            const val = Math.max(d.reimbursement.accident || 0, d.reimbursement.medical || 0);
            coverage.reimbursement.policies.push({ name: policyTitle, amount: val, unit: '(限額)' });
        }
        if (d.treatment) {
            coverage.treatment.limit += d.treatment.limit || 0;
            coverage.treatment.policies.push({ name: policyTitle, amount: d.treatment.limit || 0, unit: '' });
        }

        // 2. Middle Layer
        if (d.critical_illness) {
            coverage.critical_illness.present += d.critical_illness || 0;
            coverage.critical_illness.policies.push({ name: policyTitle, amount: d.critical_illness || 0, unit: '' });
        }
        if (d.cancer) {
            coverage.cancer.present += d.cancer || 0;
            coverage.cancer.policies.push({ name: policyTitle, amount: d.cancer || 0, unit: '' });
        }

        // 3. Top Layer
        if (d.long_term_care) {
            coverage.long_term_care.monthly += d.long_term_care || 0;
            coverage.long_term_care.policies.push({ name: policyTitle, amount: d.long_term_care || 0, unit: '/月' });
        }

        // 4. Side
        if (d.life_insurance) {
            coverage.life_insurance.general += d.life_insurance.general || 0;
            coverage.life_insurance.accident += (d.life_insurance.general || 0) + (d.life_insurance.accident_only || 0);
            const val = Math.max(d.life_insurance.general || 0, d.life_insurance.accident_only || 0);
            coverage.life_insurance.policies.push({ name: policyTitle, amount: val, unit: '' });
        }
        if (d.assets) {
            coverage.assets.reserve += d.assets || 0;
            coverage.assets.policies.push({ name: policyTitle, amount: d.assets || 0, unit: '' });
        }
    });

    return coverage;
}

// Mock Data Generator
function mockDetailsFromTitle(title) {
    title = (title || '').toLowerCase();
    const d = {};

    // Default values loosely based on title keywords
    if (title.includes('醫療') || title.includes('住院')) {
        d.sickness_inpatient = { lifetime: 1000, term: 2000 };
        d.surgery = { outpatient: 10000, inpatient: 30000 };
        d.reimbursement = { medical: 100000 }; // 10萬
    }
    if (title.includes('意外')) {
        d.accident_inpatient = { term: 1000 };
        d.reimbursement = { accident: 50000 };
        d.life_insurance = { accident_only: 1000000 };
    }
    if (title.includes('癌')) {
        d.cancer = 1000000;
        d.sickness_inpatient = { term: 2000 }; // Cancer often has daily benefits
    }
    if (title.includes('重大') || title.includes('傷病')) {
        d.critical_illness = 1000000;
    }
    if (title.includes('壽')) {
        d.life_insurance = { general: 3000000 };
    }
    if (title.includes('儲蓄') || title.includes('投資')) {
        d.assets = 500000; // Reserve
    }
    if (title.includes('長照') || title.includes('失能')) {
        d.long_term_care = 30000; // Monthly
    }

    return d;
}

function formatMoney(amount) {
    if (!amount) return '0';
    if (amount >= 10000) {
        const v = amount / 10000;
        return (Number.isInteger(v) ? v : v.toFixed(1)) + '萬';
    }
    return amount;
}

function generatePyramidHTML(coverage) {
    return `
        <div class="pyramid-wrapper-detailed">
            <!-- Side: Life Insurance & Assets -->
            <div class="pyramid-side-column">
                <div class="layer-box side-box" onclick="showPyramidDetail('assets', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title">壽險 與 資產</div>
                    <div class="data-row"><span>一般身故:</span> <span class="val">${formatMoney(coverage.life_insurance.general)}</span></div>
                    <div class="data-row"><span>意外身故:</span> <span class="val">${formatMoney(coverage.life_insurance.accident)}</span></div>
                    <hr style="margin:4px 0; border:0; border-top:1px dashed #ccc;">
                    <div class="data-row"><span>資產累積:</span> <span class="val">${formatMoney(coverage.assets.reserve)}</span></div>
                </div>
            </div>

            <!-- Top Layer: Long Term Care -->
            <div class="pyramid-row top-row">
                <div class="layer-box top-box" onclick="showPyramidDetail('long_term_care', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title">長期照顧 與 失能</div>
                    <div class="data-group-center">
                        <div class="data-label">每月現金流 (月給付)</div>
                        <div class="data-val-lg">${formatMoney(coverage.long_term_care.monthly)} /月</div>
                    </div>
                </div>
            </div>

            <!-- Middle Layer: Critical Illness / Cancer -->
            <div class="pyramid-row middle-row">
                <div class="layer-box mid-box" onclick="showPyramidDetail('critical_illness', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title">重大傷病</div>
                    <div class="data-row"><span>一次金:</span> <span class="val">${formatMoney(coverage.critical_illness.present)}</span></div>
                </div>
                <div class="layer-box mid-box" onclick="showPyramidDetail('cancer', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title">癌症</div>
                    <div class="data-row"><span>一次金:</span> <span class="val">${formatMoney(coverage.cancer.present)}</span></div>
                </div>
            </div>

            <!-- Bottom Layer: Basic Medical -->
            <div class="pyramid-row bottom-row">
                <div class="layer-box bot-box" onclick="showPyramidDetail('accident_inpatient', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title-sm">意外住院</div>
                    <div class="data-item">日額: <span class="val">${formatMoney(coverage.accident_inpatient.daily)}</span></div>
                    <div class="data-sub">終身: ${formatMoney(coverage.accident_inpatient.lifetime)}</div>
                    <div class="data-sub">非終身: ${formatMoney(coverage.accident_inpatient.term)}</div>
                </div>
                <div class="layer-box bot-box" onclick="showPyramidDetail('sickness_inpatient', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title-sm">疾病住院</div>
                    <div class="data-item">日額: <span class="val">${formatMoney(coverage.sickness_inpatient.daily)}</span></div>
                    <div class="data-sub">終身: ${formatMoney(coverage.sickness_inpatient.lifetime)}</div>
                    <div class="data-sub">非終身: ${formatMoney(coverage.sickness_inpatient.term)}</div>
                </div>
                <div class="layer-box bot-box" onclick="showPyramidDetail('surgery', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title-sm">手術</div>
                    <div class="data-item">門診: <span class="val">${formatMoney(coverage.surgery.outpatient)}</span></div>
                    <div class="data-item">住院: <span class="val">${formatMoney(coverage.surgery.inpatient)}</span></div>
                </div>
                <div class="layer-box bot-box" onclick="showPyramidDetail('treatment', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title-sm">特定處置</div>
                    <div class="data-item center">限額: <span class="val">${formatMoney(coverage.treatment.limit)}</span></div>
                </div>
                <div class="layer-box bot-box" onclick="showPyramidDetail('reimbursement', ${JSON.stringify(coverage).replace(/"/g, '&quot;')})">
                    <div class="layer-title-sm">實支實付</div>
                    <div class="data-item">意外: <span class="val">${formatMoney(coverage.reimbursement.accident)}</span></div>
                    <div class="data-item">醫療: <span class="val">${formatMoney(coverage.reimbursement.medical)}</span></div>
                </div>
            </div>
        </div>

        <div class="pyramid-analysis-result">
            <div class="analysis-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                AI 保障建議
            </div>
            <div class="analysis-text" id="pyramid-advice">
                ${generateAdvice(coverage)}
            </div>
        </div>
        
        <!-- Explanation Block -->
        <div class="pyramid-explanation">
            <div class="explanation-title">保障金三角計算說明</div>
            <div class="explanation-content">
                <ul>
                    <li><strong>底層 (基礎醫療)</strong>: 計算「日額給付」與「實支實付限額」，區分終身/定期與意外/疾病。</li>
                    <li><strong>中層 (重大傷病/癌症)</strong>: 計算確診當下可領取的「一次性給付」總額。</li>
                    <li><strong>頂層 (長照/失能)</strong>: 計算失去自理能力時，每月可領取的「現金流」總額。</li>
                    <li><strong>右側 (壽險/資產)</strong>: 計算身故保險金及保單價值準備金。</li>
                </ul>
                <div class="explanation-action">
                    <span>想了解更多細節？</span>
                    <a href="consulting.html" class="btn-inquiry">詳情詢問</a>
                </div>
            </div>
        </div>

        </div>
    `;
}

function generateAdvice(coverage) {
    let advice = '<strong>保障分析重點：</strong><ul style="margin-top:8px; padding-left:20px;">';
    let gaps = [];

    // Basic Logic Checks
    if (coverage.reimbursement.medical < 100000) gaps.push('實支實付醫療雜費額度不足 (建議至少10-15萬)');
    if (coverage.sickness_inpatient.daily < 2000) gaps.push('疾病住院日額偏低 (建議規劃填補薪資損失)');
    if (coverage.cancer.present < 1000000) gaps.push('癌症一次金保障較低 (建議至少100萬應對標靶藥物)');
    if (coverage.long_term_care.monthly < 30000) gaps.push('長照/失能月給付不足 (建議規劃每月3-5萬)');
    if (coverage.life_insurance.general < 1000000) gaps.push('壽險保障可能不足 (依家庭責任調整)');

    if (gaps.length === 0) {
        advice += '<li style="color:green;">恭喜！您的保障金三角架構相當完整。</li>';
    } else {
        gaps.forEach(g => advice += `<li style="margin-bottom:4px;">${g}</li>`);
    }
    advice += '</ul>';
    return advice;
}

function renderPyramidAnalysis(policies) {
    currentPolicies = policies;
    if (!document.getElementById('pyramid-modal')) {
        createPyramidModal();
    }
    if (!document.getElementById('feedback-modal')) {
        createFeedbackModal();
    }
}

function createPyramidModal() {
    const container = document.getElementById('pyramid-btn-container');
    const fab = document.createElement('button');
    fab.className = 'pyramid-fab';
    fab.innerHTML = `生成保障金三角`;
    fab.onclick = openPyramidModal;

    if (container) {
        container.innerHTML = ''; // Clear if any
        container.appendChild(fab);
    } else {
        document.body.appendChild(fab);
    }

    const modal = document.createElement('div');
    modal.id = 'pyramid-modal';
    modal.className = 'pyramid-modal';

    modal.innerHTML = `
        <div class="pyramid-modal-card detailed-card">
            <button class="pyramid-close" onclick="closePyramidModal()">&times;</button>
            <div class="section-title" style="font-size:1.4rem; margin-bottom:1.5rem; text-align:center;">您的專屬保障金三角</div>
            <div id="pyramid-container-inner"></div>
            
            <!-- Detail Overlay -->
            <div id="pyramid-detail-overlay" class="pyramid-detail-overlay">
                <div class="detail-overlay-content">
                    <button class="detail-overlay-close" onclick="closeDetailOverlay()">&times;</button>
                    <div id="detail-overlay-body"></div>
                </div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => { if (e.target === modal) closePyramidModal(); });
    document.body.appendChild(modal);
}

function openPyramidModal() {
    const modal = document.getElementById('pyramid-modal');
    if (modal) {
        modal.classList.add('show');
        const coverage = analyzePolicies(currentPolicies);
        document.getElementById('pyramid-container-inner').innerHTML = generatePyramidHTML(coverage);

        // Usage tracking (Cyclical: every 3 uses)
        let count = parseInt(localStorage.getItem('pyramid_usage_count') || '0');
        count++;
        localStorage.setItem('pyramid_usage_count', count);

        if (count >= 3) {
            setTimeout(openFeedbackModal, 1000); // Popup after 1s
        }
    }
}

function closePyramidModal() {
    const modal = document.getElementById('pyramid-modal');
    if (modal) modal.classList.remove('show');
}

function createFeedbackModal() {
    const modal = document.createElement('div');
    modal.id = 'feedback-modal';
    modal.className = 'feedback-modal';
    modal.innerHTML = `
        <div class="feedback-card">
            <button class="feedback-close" onclick="closeFeedbackModal()">&times;</button>
            <div class="feedback-title">覺得這個分析有幫助嗎？</div>
            <div class="feedback-desc">您的回饋是我們進步的動力！</div>
            <div class="feedback-stars" id="feedback-stars">
                <span class="star" onclick="rateFeedback(1)">★</span>
                <span class="star" onclick="rateFeedback(2)">★</span>
                <span class="star" onclick="rateFeedback(3)">★</span>
                <span class="star" onclick="rateFeedback(4)">★</span>
                <span class="star" onclick="rateFeedback(5)">★</span>
            </div>
            <textarea id="feedback-text" class="feedback-textarea" placeholder="有什麼建議可以讓我們做得更好嗎？(選擇性填寫)"></textarea>
            <button id="feedback-submit-btn" class="feedback-submit" onclick="submitFeedback()" disabled>送出評價</button>
            <div id="feedback-success" class="feedback-success-msg">感謝您的回饋！我們會繼續努力！</div>
        </div>
    `;
    document.body.appendChild(modal);
}

let selectedStars = 0;

function openFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) modal.classList.add('show');
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) {
        modal.classList.remove('show');
        // Reset counter after closing (even if skipped via X) to start next 3-use cycle
        localStorage.setItem('pyramid_usage_count', '0');
    }
}

function rateFeedback(stars) {
    selectedStars = stars;
    const starElements = document.querySelectorAll('#feedback-stars .star');
    starElements.forEach((star, index) => {
        if (index < stars) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
    document.getElementById('feedback-submit-btn').disabled = false;
}

function submitFeedback() {
    const text = document.getElementById('feedback-text').value;
    console.log(`Feedback submitted: ${selectedStars} stars, comment: ${text}`);

    // Reset counter to start next 3-use cycle
    localStorage.setItem('pyramid_usage_count', '0');

    // Optional: could still track if they EVER submitted, but per user request "每填完一次之後就會重置次數"
    // we just reset and let it trigger again after 3 uses.

    // Show success UI
    document.getElementById('feedback-submit-btn').style.display = 'none';
    document.getElementById('feedback-text').style.display = 'none';
    document.getElementById('feedback-success').style.display = 'block';

    setTimeout(() => {
        closeFeedbackModal();
    }, 2000);
}

function showPyramidDetail(category, coverage) {
    const overlay = document.getElementById('pyramid-detail-overlay');
    const body = document.getElementById('detail-overlay-body');
    if (!overlay || !body) return;

    let catData = coverage[category];

    // Special handling for the side box which contains both life insurance and assets
    if (category === 'assets') {
        const lifeData = coverage.life_insurance || { policies: [] };
        const assetsData = coverage.assets || { policies: [] };
        catData = {
            policies: [...(lifeData.policies || []), ...(assetsData.policies || [])],
            total: Math.max(lifeData.general || 0, lifeData.accident || 0) + (assetsData.reserve || 0)
        };
    } else if (catData) {
        // Calculate a meaningful total for other categories
        let total = 0;
        if (category === 'surgery') total = Math.max(catData.outpatient || 0, catData.inpatient || 0);
        else if (category === 'reimbursement') total = Math.max(catData.accident || 0, catData.medical || 0);
        else total = catData.present || catData.monthly || catData.daily || catData.limit || 0;
        catData.total = total;
    } else {
        catData = { policies: [], total: 0 };
    }
    const titles = {
        accident_inpatient: '意外住院',
        sickness_inpatient: '疾病住院',
        surgery: '手術保障',
        treatment: '特定處置',
        reimbursement: '實支實付',
        critical_illness: '重大傷病',
        cancer: '癌症保障',
        long_term_care: '長期照顧與失能',
        assets: '壽險與資產'
    };

    const explanations = {
        accident_inpatient: '計算「意外」導致住院時，每日可領取的給付總額。區分終身與定期額度。',
        sickness_inpatient: '計算「疾病」導致住院時，每日可領取的給付總額。區分終身與定期額度。',
        surgery: '計算手術給付額度，包括門診手術與住院手術的最高限額。',
        treatment: '計算針對特定醫療處置（如雷射、射頻燒灼等）的理賠限額。',
        reimbursement: '根據實際醫療花費，在限額內進行理賠。涵蓋意外醫療與一般住院醫療雜費。',
        critical_illness: '計算確診重大傷病（如洗腎、器官移植等）時，可領取的一次性補償金。',
        cancer: '計算確診癌症時，可領取的一次性給付總額，用於支付化療、標靶藥物等高額自費。',
        long_term_care: '計算失去自理能力或符合失能等級時，每月可領取的「生活輔導金」或「現金流」。',
        assets: '計算身故保險金（一般/意外）以及保單目前的累積價值（現金價值或祝壽金）。'
    };

    let policiesHtml = '';
    const uniquePolicies = catData.policies || [];

    if (uniquePolicies.length > 0) {
        policiesHtml = `
            <div class="detail-policy-list">
                <div class="detail-subtitle">參考保單與金額：</div>
                <ul>
                    ${uniquePolicies.map(p => `
                        <li>
                            <span class="p-name">${p.name}</span>
                            <span class="p-amount">$${formatMoney(p.amount)}${p.unit || ''}</span>
                        </li>
                    `).join('')}
                </ul>
                <div class="detail-total-info" style="margin-top:15px; padding-top:10px; border-top:1px solid #eee; text-align:right; font-weight:700;">
                    總計保障：<span class="total-val" style="color:#2c3e50; font-size:1.1rem;">${formatMoney(catData.total || 0)}${uniquePolicies[0] ? uniquePolicies[0].unit : ''}</span>
                </div>
            </div>
        `;
    } else {
        policiesHtml = '<div class="detail-no-policy">尚無相關保單提供此項保障</div>';
    }

    body.innerHTML = `
        <div class="detail-title">${titles[category]}</div>
        <div class="detail-calc-desc">
            <span class="detail-subtitle">計算方式：</span>
            <p>${explanations[category]}</p>
        </div>
        ${policiesHtml}
    `;

    overlay.classList.add('show');
}

function closeDetailOverlay() {
    const overlay = document.getElementById('pyramid-detail-overlay');
    if (overlay) overlay.classList.remove('show');
}

window.renderPyramidAnalysis = renderPyramidAnalysis;
window.openPyramidModal = openPyramidModal;
window.closePyramidModal = closePyramidModal;
window.createFeedbackModal = createFeedbackModal;
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.rateFeedback = rateFeedback;
window.submitFeedback = submitFeedback;
window.showPyramidDetail = showPyramidDetail;
window.closeDetailOverlay = closeDetailOverlay;
