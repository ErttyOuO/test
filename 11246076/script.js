document.addEventListener('DOMContentLoaded', () => {
    initCustomizationBindings();
    // 1. 初始化全域導覽與功能
    initGlobalNav();
    initAuthModal();
    initRoleModal();
    initMobileMenu();

    // 2. 根據頁面初始化特定功能
    const path = window.location.pathname;

    if (path.includes('budget')) initBudgetEstimator();
    if (path.includes('community')) initCommunityFeatures();
    if (path.includes('policy')) initPolicyFeatures();
    if (path.includes('dm.html')) initDMOverhaul();



    // 在首頁開啟時嘗試與伺服器建立連線（若可用則同步 session）
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPath === 'index.html' || currentPath === '') {
        attemptAutoConnect();
        initCompanyAutocomplete();

        // Hook up hero search button
        const searchBtn = document.getElementById('hero-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', executeHeroSearch);
        }
    }

});

/**
 * --- Virtual Policy Database & Search ---
 */
const mockPolicies = [
    { id: 1, company: '富邦人壽', category: 'life', name: '富邦人壽金滿意壽險', price: '12,000', desc: '為家人提供最穩定的保障。', rating: '9.5', reviews: '1,200', tag: '壽險' },
    { id: 2, company: '國泰人壽', category: 'health', name: '國泰人壽全心住院', price: '8,500', desc: '涵蓋多項手術與住院雜費。', rating: '9.2', reviews: '2,100', tag: '健康保險' },
    { id: 3, company: '南山人壽', category: 'accident', name: '南山人壽意外平安', price: '3,200', desc: '針對各類意外傷害提供高額給付。', rating: '9.0', reviews: '1,500', tag: '傷害保險' },
    { id: 4, company: '新光人壽', category: 'travel', name: '新光人壽環遊世界', price: '800', desc: '旅途中的全方位保障。', rating: '9.8', reviews: '3,000', tag: '旅平險' },
    { id: 5, company: '富邦人壽', category: 'health', name: '富邦人壽醫全保', price: '10,500', desc: '全面的醫療保障方案。', rating: '9.1', reviews: '900', tag: '健康保險' },
    { id: 6, company: '凱基人壽', category: 'life', name: '凱基人壽傳承美滿', price: '15,000', desc: '專為資產傳承設計的壽險。', rating: '8.8', reviews: '450', tag: '壽險' },
    { id: 7, company: '台灣人壽', category: 'accident', name: '台灣人壽龍平安', price: '2,800', desc: '高CP值的意外保障選擇。', rating: '9.3', reviews: '1,800', tag: '傷害保險' },
    { id: 8, company: '全球人壽', category: 'health', name: '全球人壽加倍醫靠', price: '9,800', desc: '雙倍給付，保障更加倍。', rating: '9.4', reviews: '1,100', tag: '健康保險' }
];

function executeHeroSearch() {
    const company = document.getElementById('company-input').value.trim();
    const category = document.getElementById('category-select').value;

    if (!company && !category) {
        alert('請至少選擇一家公司或一個保險類別進行搜尋。');
        return;
    }

    // 將首頁的英文 category 值對應到 policy_tab.js 使用的中文類別名稱
    const categoryMap = {
        life: '人壽保險',
        health: '健康醫療',
        accident: '意外傷害',
        travel: '旅遊平安險',
        investment: '投資型保險',
        group: '團體保險',
        annuity: '還本/年金型保險',
        other: '其他'
    };

    const params = new URLSearchParams();
    if (company) params.set('company', company);
    if (category && categoryMap[category]) params.set('category', categoryMap[category]);

    window.location.href = `保單搜尋/policy_tab.html?${params.toString()}`;
}

/**
 * --- Mobile Navigation Menu ---
 */
function initMobileMenu() {
    const toggleBtn = document.getElementById('hamburger-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    const closeBtn = document.getElementById('mobile-nav-close');
    const navLinks = document.querySelectorAll('.mobile-nav-links a');

    if (toggleBtn && mobileNav) {
        toggleBtn.addEventListener('click', () => {
            mobileNav.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
        });
    }

    if (closeBtn && mobileNav) {
        closeBtn.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        });
    }

    // Close menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

/**
 * --- Company Autocomplete ---
 * Handles the search and selection for the insurance company input
 */
const insuranceCompanies = [
    '富邦人壽', '國泰人壽', '南山人壽', '新光人壽', '凱基人壽',
    '台灣人壽', '遠雄人壽', '全球人壽', '三商美邦人壽', '元大人壽',
    '安聯人壽', '友邦人壽', '保誠人壽', '康健人壽', '合庫人壽',
    '臺銀人壽', '法國巴黎人壽'
];

function initCompanyAutocomplete() {
    const input = document.getElementById('company-input');
    const resultsContainer = document.getElementById('company-results');
    if (!input || !resultsContainer) return;

    input.addEventListener('input', () => {
        const value = input.value.trim();
        if (!value) {
            resultsContainer.classList.remove('active');
            return;
        }

        const matches = insuranceCompanies.filter(company =>
            company.includes(value)
        );

        if (matches.length > 0) {
            resultsContainer.innerHTML = matches.map(match =>
                `<div class="result-item">${match}</div>`
            ).join('');
            resultsContainer.classList.add('active');
        } else {
            resultsContainer.classList.remove('active');
        }
    });

    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('result-item')) {
            input.value = e.target.textContent;
            resultsContainer.classList.remove('active');
        }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.remove('active');
        }
    });

    // Show all results on focus if user has typed something
    input.addEventListener('focus', () => {
        if (input.value.trim()) {
            input.dispatchEvent(new Event('input'));
        }
    });
}

/**
 * --- Overhaul: DM Page Initialization ---
 * Handles filtering by category and dynamic FOMO elements
 */
function initDMOverhaul() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');

    // 1. Handle filtering (Visual Highlight)
    if (cat) {
        const catMap = {
            'medical': '醫療險',
            'accident': '意外險',
            'life': '壽險'
        };
        const targetTag = catMap[cat];
        const cards = document.querySelectorAll('.dm-card');

        cards.forEach(card => {
            const tagText = card.querySelector('.dm-tag').textContent.trim();
            if (tagText !== targetTag) {
                card.style.opacity = '0.35';
                card.style.filter = 'grayscale(1)';
                card.style.order = '100'; // Move to end
            } else {
                card.style.border = '2px solid var(--accent-green)';
                card.style.order = '-1'; // Bring to front
            }
        });
    }

    // 2. Start FOMO Timers & Viewer Counts
    setInterval(() => {
        document.querySelectorAll('.viewer-count').forEach(el => {
            const current = parseInt(el.textContent.match(/\d+/)[0]);
            const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
            el.innerHTML = `👁️ ${Math.max(10, current + delta)} 人正在查看`;
        });
    }, 3000);

    // Simple Timer Logic
    startCountdown('timer-1', 7200 + 895); // Example 2h 14m 55s
}

function startCountdown(id, seconds) {
    const timerEl = document.getElementById(id);
    if (!timerEl) return;

    let timeLeft = seconds;
    const interval = setInterval(() => {
        const h = Math.floor(timeLeft / 3600).toString().padStart(2, '0');
        const m = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        timerEl.textContent = `${h}:${m}:${s}`;
        timeLeft--;
        if (timeLeft < 0) clearInterval(interval);
    }, 1000);
}


// ==========================================
// 1. 全域導覽與理賠急救 (Global & Claims)
// ==========================================
function initGlobalNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === 'index.html' && href === '')) {
            link.classList.add('active');
        }
    });


    const modal = document.getElementById('claims-modal');
    if (modal) {
        modal.querySelector('.modal-close').addEventListener('click', closeClaimsModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeClaimsModal(); });

        ensureClaimsButtons();
        setClaimsButtonsState('idle'); // Ensure properly hidden on load

        const textarea = modal.querySelector('textarea');
        if (textarea && !textarea.dataset.claimsWatch) {
            textarea.dataset.claimsWatch = 'true';
            textarea.addEventListener('input', () => {
                claimsResponseReady = false;
                setClaimsButtonsState('idle');
            });
        }
    }

    // 理賠 modal 的送出按鈕：導覽時先模擬回覆再前往下一步
    document.querySelectorAll('.modal-submit-btn').forEach(btn => {
        // 移除行內 onclick（index.html 中有 alert），以統一行為
        try { btn.onclick = null; } catch (e) { }
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (claimsResponseReady) {
                if (isClaimsTourStep()) {
                    nextTourStep(getTourStep());
                    return;
                }
                const modal = document.getElementById('claims-modal');
                const textarea = modal ? modal.querySelector('textarea') : null;
                if (textarea) {
                    textarea.value = '';
                    textarea.focus();
                }
                claimsResponseReady = false;
                setClaimsButtonsState('idle');
                return;
            }
            simulateClaimsResponse();
        });
    });

    document.querySelectorAll('.modal-secondary-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('claims-modal');
            const textarea = modal ? modal.querySelector('textarea') : null;
            const responseBox = modal ? modal.querySelector('.ai-simulated-response') : null;
            if (responseBox) {
                responseBox.classList.remove('show');
                responseBox.innerHTML = '';
            }
            if (textarea) {
                textarea.value = '';
                textarea.focus();
            }
            claimsResponseReady = false;
            setClaimsButtonsState('idle');
        });
    });

    // 帳號顯示區（由 script 注入，避免每個頁面重複修改）
    const header = document.querySelector('header');
    if (header) {
        let acct = document.getElementById('account-controls');
        if (!acct) {
            acct = document.createElement('div');
            acct.id = 'account-controls';
            acct.className = 'account-controls';
            header.appendChild(acct);
        }
        if (typeof updateNavAuthUI === 'function') updateNavAuthUI();
    }
}

function openClaimsModal() {
    const modal = document.getElementById('claims-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Reset state to ensure purely "Request Support" initially
        // unless we want to preserve state? Usually a fresh start is better if it was closed.
        // If we want to preserve, we wouldn't call this. But user reported "Init state wrong".
        // Let's assume re-opening means continuing or fresh? 
        // If the user just wants the button to be correct *initially*, we should ensure it's idle if no response yet.

        if (!claimsResponseReady) {
            setClaimsButtonsState('idle');
        } else {
            // If response is ready (from previous interaction without page reload), 
            // we should probably show the "Continue" button?
            // But let's stick to the user's request: "At the very beginning... only Request Support".
            // If they close and reopen, let's treat it as a return to view.
            setClaimsButtonsState('ready');
        }
    }
}

function closeClaimsModal() {
    const modal = document.getElementById('claims-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function ensureClaimsResponseBox() {
    const modal = document.getElementById('claims-modal');
    if (!modal) return null;
    const form = modal.querySelector('.modal-form');
    if (!form) return null;
    let box = form.querySelector('.ai-simulated-response');
    if (!box) {
        box = document.createElement('div');
        box.className = 'ai-simulated-response';
        const actions = form.querySelector('.claims-actions');
        const submitBtn = form.querySelector('.modal-submit-btn');
        if (actions) {
            form.insertBefore(box, actions);
        } else if (submitBtn && submitBtn.parentNode === form) {
            form.insertBefore(box, submitBtn);
        } else {
            form.appendChild(box);
        }
    }
    return box;
}

function ensureClaimsButtons() {
    const modal = document.getElementById('claims-modal');
    if (!modal) return { submitBtn: null, askBtn: null };
    const form = modal.querySelector('.modal-form');
    if (!form) return { submitBtn: null, askBtn: null };

    let submitBtn = form.querySelector('.modal-submit-btn');
    let askBtn = form.querySelector('.modal-secondary-btn');
    let actions = form.querySelector('.claims-actions');

    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'claims-actions';
        if (submitBtn) actions.appendChild(submitBtn);

        if (!askBtn) {
            askBtn = document.createElement('button');
            askBtn.type = 'button';
            askBtn.className = 'modal-secondary-btn';
            askBtn.textContent = '接續再問';
        }
        actions.appendChild(askBtn);
        form.appendChild(actions);
    }

    submitBtn = form.querySelector('.modal-submit-btn');
    askBtn = form.querySelector('.modal-secondary-btn');

    return { submitBtn, askBtn };
}

function setClaimsButtonsState(state) {
    const { submitBtn, askBtn } = ensureClaimsButtons();
    if (!submitBtn || !askBtn) return;


    if (state === 'loading') {
        submitBtn.disabled = true;
        askBtn.disabled = true;
        askBtn.style.display = 'none';
        return;
    }

    if (state === 'ready') {
        // Response received: Hide submit button, show "Continue Asking"
        submitBtn.style.display = 'none'; // Hide "Request Support"

        // Normal mode: Hide submit, show continue
        askBtn.style.display = 'inline-flex';
        askBtn.textContent = '接續再問';
        askBtn.disabled = false;
        return;
    }

    // State idle (Reset)
    submitBtn.style.display = 'inline-flex';
    submitBtn.disabled = false;
    submitBtn.textContent = '請求支援';
    askBtn.style.display = 'none';
    askBtn.disabled = false;
}

function buildClaimsResponse(inputText) {
    const tips = [];

    if (/受傷|流血|昏迷|急救|救護|意識/.test(inputText)) {
        tips.push('若有人受傷或意識不清，請優先撥打 119 並確保現場安全。');
    }

    if (/車禍|撞|碰撞|事故/.test(inputText)) {
        tips.push('先拍照記錄現場、車損與路況，並與對方交換聯絡方式。');
    }

    if (!/警察|報警|110/.test(inputText)) {
        tips.push('如涉及人員受傷或責任爭議，建議撥打 110 由警方到場處理。');
    }

    tips.push('保留醫療、維修與交通等相關單據，方便後續申請理賠。');

    return tips;
}


let claimsResponseReady = false;

function simulateClaimsResponse() {
    const modal = document.getElementById('claims-modal');
    if (!modal) return false;

    const textarea = modal.querySelector('textarea');
    const { submitBtn } = ensureClaimsButtons();
    const responseBox = ensureClaimsResponseBox();
    if (!responseBox) return false;

    const inputText = textarea ? textarea.value.trim() : '';
    if (!inputText) {
        responseBox.classList.add('show');
        responseBox.innerHTML = '<div class="ai-response-title">AI 模擬回覆</div><div class="ai-response-loading">請先輸入狀況，系統才能提供建議。</div>';
        return false;
    }

    setClaimsButtonsState('loading');

    responseBox.classList.add('show');
    responseBox.innerHTML = '<div class="ai-response-title">AI 模擬回覆</div><div class="ai-response-loading">分析中</div>';
    const loadingEl = responseBox.querySelector('.ai-response-loading');
    let dots = 0;
    const loadingTimer = setInterval(() => {
        dots = (dots + 1) % 4;
        if (loadingEl) loadingEl.textContent = `分析中${'.'.repeat(dots)}`;
    }, 260);

    setTimeout(() => {
        clearInterval(loadingTimer);
        const tips = buildClaimsResponse(inputText);
        responseBox.innerHTML = `
            <div class="ai-response-title">AI 模擬回覆</div>
            <ul class="ai-response-list">${tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
        `;
        claimsResponseReady = true;
        setClaimsButtonsState('ready');
    }, 950);

    return true;
}

function scrollToClaims() {
    const section = document.getElementById('claims-emergency');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        section.style.transition = 'background-color 0.5s';
        const originalBg = section.style.backgroundColor;
        section.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { section.style.backgroundColor = originalBg; }, 1000);
    }
}


// ==========================================
// 3. 認證模組 (Auth)
// ==========================================
function initAuthModal() {
    if (document.getElementById('auth-modal')) return;
    ensureLocalDemoUser();

    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.id = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-card">
            <button class="auth-modal-close" type="button">×</button>
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="login" type="button">登入</button>
                <button class="auth-tab" data-tab="register" type="button">註冊</button>
            </div>
            <form class="auth-form active" data-form="login">
                <input class="auth-input" type="text" placeholder="電子郵件或帳號" required>
                <input class="auth-input" type="password" placeholder="密碼" required>
                
                <div class="auth-footer-links">
                    <label class="auth-check-group">
                        <input type="checkbox"> 自動登入
                    </label>
                    <a href="#">忘記密碼？</a>
                </div>

                <button class="auth-submit" type="submit" style="margin-top: 10px;">登入</button>
                
                <div class="auth-register-prompt">
                    沒有帳號嗎？ <a href="#" id="user-go-to-register">快來加入我們吧！</a>
                </div>
            </form>
            <form class="auth-form" data-form="register">
                <input class="auth-input" type="text" placeholder="姓名" required>
                <input class="auth-input" type="email" placeholder="電子郵件" required>
                <input class="auth-input" type="password" placeholder="設定密碼" required>
                <button class="auth-submit" type="submit">註冊</button>
                <div class="auth-helper">註冊後可同步保單與諮詢紀錄</div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    };

    modal.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            modal.querySelector(`form[data-form="${btn.dataset.tab}"]`).classList.add('active');
        });
    });

    modal.querySelector('.auth-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelectorAll('.auth-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formType = form.dataset.form;
            const inputs = form.querySelectorAll('input');

            // 構建 payload
            let payload = {};
            if (formType === 'login') {
                payload = { username: inputs[0].value.trim(), password: inputs[1].value };
            } else {
                payload = { displayName: inputs[0].value.trim(), username: inputs[1].value.trim(), password: inputs[2].value };
            }

            // 先嘗試與伺服器互動（若有），超時後 fallback 到 local
            let serverUser = null;
            try {
                serverUser = await tryServerAuth(formType, payload);
            } catch (err) {
                serverUser = null;
            }

            if (serverUser) {
                setAuthenticatedUser(serverUser);
                alert(formType === 'login' ? `登入成功，歡迎 ${serverUser.displayName || serverUser.username}！` : '註冊成功，並已登入！');
                closeModal();
                setTimeout(() => window.location.reload(), 400);
                return;
            }

            // 伺服器不可用或回傳失敗，使用 local fallback
            if (formType === 'login') {
                const user = loginLocalUser(payload.username, payload.password);
                if (!user) { alert('登入失敗：帳號或密碼錯誤（或伺服器無回應）'); return; }
                setAuthenticatedUser(user);
                alert(`登入成功，歡迎 ${user.displayName}！`);
                closeModal();
                setTimeout(() => window.location.reload(), 400);
            } else {
                if (!payload.displayName || !payload.username || !payload.password) { alert('請填寫所有欄位'); return; }
                const existing = findUserByUsername(payload.username);
                if (existing) { alert('此帳號已存在，請改用其他帳號或直接登入'); return; }
                const newUser = registerLocalUser(payload.displayName, payload.username, payload.password);
                setAuthenticatedUser(newUser);
                alert('註冊成功（本機），已自動登入！');
                closeModal();
                setTimeout(() => window.location.reload(), 400);
            }
        });
    });

    window.openAuthModal = (tab = 'login') => {
        modal.classList.add('show');
        const targetBtn = modal.querySelector(`.auth-tab[data-tab="${tab}"]`);
        if (targetBtn) targetBtn.click();
    };

    // User register link shortcut
    const registerLink = modal.querySelector('#user-go-to-register');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.openAuthModal('register');
        });
    }

    const authEntryBtn = document.getElementById('auth-entry-btn');
    if (authEntryBtn) authEntryBtn.onclick = (e) => { e.preventDefault(); window.openAuthModal('login'); };

    // 改為保險員登入/註冊
    const guestBtn = document.getElementById('guest-mode-btn');
    if (guestBtn) {
        guestBtn.onclick = (e) => {
            e.preventDefault();
            window.openAgentAuthModal();
        };
    }

    initAgentAuthModal();
}

/**
 * --- Agent Authentication Modal ---
 * Specialized for Insurance Agents
 */
function initAgentAuthModal() {
    if (document.getElementById('agent-auth-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.id = 'agent-auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-card" style="width: min(500px, 94vw); max-height: 90vh; overflow-y: auto;">
            <button class="auth-modal-close" type="button" style="z-index: 10;">×</button>
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="agent-login" type="button">登入</button>
                <button class="auth-tab" data-tab="agent-register" type="button">註冊</button>
            </div>

            <!-- Agent Login Form -->
            <form class="auth-form active" data-form="agent-login">
                <div style="text-align:center; color:#64748b; margin-bottom: 20px;">
                    如果是登入的話，請輸入您的保險員帳號與密碼即可
                </div>
                
                <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>帳號</label>
                <input class="auth-input" type="text" id="agent-login-username" placeholder="請輸入帳號" required>
                
                <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>密碼</label>
                <input class="auth-input" type="password" id="agent-login-password" placeholder="請輸入密碼" required>
                
                <div class="auth-footer-links" style="margin-top: 10px;">
                    <label class="auth-check-group">
                        <input type="checkbox"> 自動登入
                    </label>
                    <a href="#">忘記密碼？</a>
                </div>
                
                <button class="auth-submit" type="submit" style="margin-top: 15px;">登入 / 進入後台</button>
                
                <div class="auth-register-prompt">
                    沒有帳號嗎？ <a href="#" id="agent-go-to-register">立即申請成為認證保險員！</a>
                </div>
            </form>

            <!-- Agent Register Form -->
            <form class="auth-form" data-form="agent-register" id="agent-reg-form">
                <div style="text-align:center; color:#64748b; margin-bottom: 20px;">
                    請填寫您的專業資訊以完成註冊申請
                </div>
                
                <div class="auth-form-grid">
                    <div>
                        <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>帳號 (登入/註冊)</label>
                        <input class="auth-input" type="text" id="agent-reg-username" placeholder="輸入帳號" required>
                    </div>
                    <div>
                        <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>密碼</label>
                        <input class="auth-input" type="password" id="agent-reg-password" placeholder="輸入密碼" required>
                    </div>
                    <div>
                        <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>出生年月日 (需滿18歲)</label>
                        <input class="auth-input" type="date" id="agent-reg-dob" required>
                    </div>
                    <div>
                        <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>從業年資 (年)</label>
                        <input class="auth-input" type="number" id="agent-reg-experience" min="0" required placeholder="如：5">
                    </div>
                </div>
                
                <div id="agent-age-exp-error" class="error-msg" style="color: #ef4444; font-size: 13px; margin-top: 5px; display: none;">年資不可超過 (年齡 - 18) 歲！</div>

                <div class="auth-form-full" style="margin-top: 15px;">
                    <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>認證方式 (擇一)</label>
                    <div style="display: flex; gap: 20px; margin-bottom: 10px; font-size: 14px;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="radio" name="agent_verify_method" value="company" checked>
                            公司目前 + 員工編號
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="radio" name="agent_verify_method" value="certificate">
                            上傳專業證照
                        </label>
                    </div>
                </div>

                <!-- 認證方式一：公司 + 員編 -->
                <div id="agent-method-company" class="auth-form-grid" style="margin-top: 10px;">
                    <div style="width: 100%; grid-column: 1 / -1;">
                        <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>所屬保險公司</label>
                        <select class="auth-input" id="agent-reg-company" style="background-color: #f8fafc;" required>
                            <option value="">請選擇</option>
                            <option>富邦人壽</option>
                            <option>國泰人壽</option>
                            <option>南山人壽</option>
                            <option>新光人壽</option>
                            <option>凱基人壽 (中國)</option>
                            <option>台灣人壽</option>
                            <option>遠雄人壽</option>
                            <option>全球人壽</option>
                            <option>三商美邦人壽</option>
                            <option>元大人壽</option>
                            <option>宏泰人壽</option>
                            <option>安聯人壽</option>
                            <option>友邦人壽</option>
                            <option>保誠人壽</option>
                            <option>康健人壽</option>
                            <option>合庫人壽</option>
                            <option>臺銀人壽</option>
                            <option>法國巴黎人壽</option>
                            <option value="other">其他</option>
                        </select>
                        <input class="auth-input" type="text" id="agent-reg-company-other" placeholder="請輸入保險公司名稱" style="display: none; margin-top: 10px;">
                    </div>
                    <div style="width: 100%; grid-column: 1 / -1; margin-top: 10px;">
                        <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>員工編號</label>
                        <input class="auth-input" type="text" id="agent-reg-emp-id" placeholder="輸入員工編號" required>
                    </div>
                </div>

                <!-- 認證方式二：上傳證照 -->
                <div id="agent-method-certificate" class="auth-form-full" style="display: none; margin-top: 10px;">
                    <label class="auth-label"><span style="color: red; margin-right: 4px;">*</span>上傳專業證照</label>
                    <input class="auth-file-input" type="file" id="agent-reg-certificate" accept="image/*,.pdf">
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">支援 JPG, PNG, PDF 格式</div>
                </div>

                <div class="auth-form-full" style="margin-top: 20px; font-size: 14px;">
                    <label class="auth-check-group" style="margin: 0;">
                        <input type="checkbox" id="agent-terms" required> <span style="color: red; margin-right: 4px;">*</span>同意平台審核與使用條款
                    </label>
                </div>

                <button class="auth-submit" type="submit" style="margin-top: 15px;">完成註冊</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    };

    // Tab Switching
    modal.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            modal.querySelector(`form[data-form="${btn.dataset.tab}"]`).classList.add('active');
        });
    });

    // Close Events
    modal.querySelector('.auth-modal-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // "Join us" link shortcut
    const registerLink = modal.querySelector('#agent-go-to-register');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            const regTab = modal.querySelector('.auth-tab[data-tab="agent-register"]');
            if (regTab) regTab.click();
        });
    }

    // Setup DOB max date to 18 years ago
    const dobInput = modal.querySelector('#agent-reg-dob');
    if (dobInput) {
        const today = new Date();
        const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        dobInput.max = minAgeDate.toISOString().split('T')[0];
    }

    // Toggling verify methods
    const methodRadios = modal.querySelectorAll('input[name="agent_verify_method"]');
    const companyDiv = modal.querySelector('#agent-method-company');
    const certDiv = modal.querySelector('#agent-method-certificate');
    const companySelect = modal.querySelector('#agent-reg-company');
    const empIdInput = modal.querySelector('#agent-reg-emp-id');
    const certInput = modal.querySelector('#agent-reg-certificate');

    methodRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const method = modal.querySelector('input[name="agent_verify_method"]:checked').value;
            if (method === 'company') {
                companyDiv.style.display = 'grid';
                certDiv.style.display = 'none';
                if (companySelect) companySelect.required = true;
                if (empIdInput) empIdInput.required = true;
                if (certInput) certInput.required = false;
            } else {
                companyDiv.style.display = 'none';
                certDiv.style.display = 'block';
                if (companySelect) companySelect.required = false;
                if (empIdInput) empIdInput.required = false;
                if (certInput) certInput.required = true;
            }
        });
    });

    // Company 'other' option toggle
    if (companySelect) {
        companySelect.addEventListener('change', (e) => {
            const otherCompanyInput = modal.querySelector('#agent-reg-company-other');
            if (!otherCompanyInput) return;
            if (e.target.value === 'other') {
                otherCompanyInput.style.display = 'block';
                otherCompanyInput.required = true;
            } else {
                otherCompanyInput.style.display = 'none';
                otherCompanyInput.required = false;
            }
        });
    }

    // Age / Experience validation
    const expInput = modal.querySelector('#agent-reg-experience');
    const errorMsg = modal.querySelector('#agent-age-exp-error');

    const validateAgeAndExperience = () => {
        const submitBtn = modal.querySelector('form[data-form="agent-register"] .auth-submit');
        if (!dobInput || !expInput || !errorMsg || !submitBtn) return;

        const dob = dobInput.value;
        const exp = expInput.value;

        if (dob && exp !== '') {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (parseInt(exp) > (age - 18)) {
                errorMsg.style.display = 'block';
                errorMsg.innerText = `年資 ${exp} 年不合理！您的年齡為 ${age} 歲，最多只能有 ${Math.max(0, age - 18)} 年資歷 (18歲起算)。`;
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
            } else {
                errorMsg.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.style.cursor = 'pointer';
            }
        } else {
            errorMsg.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
        }
    };

    if (dobInput) dobInput.addEventListener('change', validateAgeAndExperience);
    if (expInput) expInput.addEventListener('input', validateAgeAndExperience);

    // Form Submissions
    modal.querySelectorAll('.auth-form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formType = form.dataset.form;

            if (formType === 'agent-login') {
                const user = modal.querySelector('#agent-login-username').value;
                const pass = modal.querySelector('#agent-login-password').value;

                // Allow our demo account bypassing through the same route
                if (user === 'superuser' && pass === '0000') {
                    window.location.href = 'agent_profile.html';
                    return;
                }

                // standard login via auth.js
                if (typeof loginLocalUser === 'function') {
                    const loggedUser = loginLocalUser(user, pass);
                    if (!loggedUser) { alert('登入失敗：帳號或密碼錯誤'); return; }

                    // Allow agents and admins to login here
                    if (loggedUser.role !== 'agent' && loggedUser.role !== 'admin') {
                        alert('登入失敗：此帳號並非保險員，請使用一般登入入口。');
                        return;
                    }
                    setAuthenticatedUser(loggedUser);
                    alert(`登入成功，歡迎 ${loggedUser.displayName}！`);
                    closeModal();
                    window.location.href = 'agent_profile.html';
                } else {
                    alert('登入失敗，找不到認證模組。');
                }

            } else {
                const user = modal.querySelector('#agent-reg-username').value;
                const pass = modal.querySelector('#agent-reg-password').value;

                if (typeof registerLocalUser === 'function') {
                    const existing = findUserByUsername(user);
                    if (existing) { alert('此帳號已被使用，請改用其他帳號或直接登入。'); return; }

                    const newUser = registerLocalUser(user, user, pass);
                    // Update role manually (registerLocalUser defaults to 'user')
                    const users = JSON.parse(localStorage.getItem('localUsers') || '[]');
                    const targetIdx = users.findIndex(u => u.id === newUser.id);
                    if (targetIdx !== -1) {
                        users[targetIdx].role = 'agent';
                        localStorage.setItem('localUsers', JSON.stringify(users));
                        newUser.role = 'agent';
                    }
                    setAuthenticatedUser(newUser);

                    alert('註冊成功！我們將會盡快審核您的保險員資格。在此期間您可瀏覽部分後台功能。');
                    closeModal();

                    // Optionally push users to portal or profile
                    window.location.href = 'agent_profile.html';
                } else {
                    alert('保險員註冊失敗，系統模組異常。');
                }
            }
        });
    });

    window.openAgentAuthModal = (tab = 'agent-login') => {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        const targetBtn = modal.querySelector(`.auth-tab[data-tab="${tab}"]`);
        if (targetBtn) targetBtn.click();
    };
}

/**
 * --- Role Selection Modal ---
 * Initial selection when clicking "Login/Register" in header
 */
function initRoleModal() {
    if (document.getElementById('role-selection-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.id = 'role-selection-modal';
    modal.innerHTML = `
            < div class= "auth-modal-card role-modal-card" >
            <button class="auth-modal-close" type="button">×</button>
            <h2 class="role-modal-title">請選擇您的身份</h2>
            <div class="role-options">
                <button class="role-option-btn user-btn" id="role-user-btn">
                    <div class="role-icon">👤</div>
                    <div class="role-name">一般用戶</div>
                    <div class="role-desc">搜尋保單、管理保障、社群互動</div>
                </button>
                <button class="role-option-btn agent-btn" id="role-agent-btn">
                    <div class="role-icon">💼</div>
                    <div class="role-name">保險業務</div>
                    <div class="role-desc">專業諮詢回覆、管理個人服務簡介</div>
                </button>
            </div>
        </div >
            `;
    document.body.appendChild(modal);

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    };

    modal.querySelector('.auth-modal-close').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('#role-user-btn').onclick = () => {
        closeModal();
        window.openAuthModal('login');
    };

    modal.querySelector('#role-agent-btn').onclick = () => {
        closeModal();
        window.openAgentAuthModal('agent-login');
    };

    window.openRoleModal = () => {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    };
}

/**
 * --- 其他功能 (社群、保單、預算) ---
 */
function initCommunityFeatures() {
    const lists = Array.from(document.querySelectorAll('.horizontal-scroll'));
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const companyItems = document.querySelectorAll('.company-item');
    const searchInput = document.querySelector('.comm-search-input');
    const searchBtn = document.querySelector('.comm-search-btn');
    const main = document.querySelector('.community-main');

    // Sidebar Logic
    if (sidebarItems.length > 0) {
        // 0: All Posts, 1: Saved Posts, 2: Companies
        sidebarItems[0].addEventListener('click', () => {
            activeFilter = { type: 'all', value: null, label: '所有貼文' };
            applyFilter();
            // Visual active state update could be here
        });
        sidebarItems[1].addEventListener('click', () => {
            const user = getAuthenticatedUser();
            if (!user) {
                alert('請先登入後查看儲藏貼文！');
                window.openAuthModal('login');
                return;
            }
            activeFilter = { type: 'saved', value: null, label: '儲藏貼文' };
            applyFilter();
        });
        // 3rd item is companies dropdown/header, usually handled separately or just scrolls to list
    }
    let cachedPosts = [];
    let activeFilter = { type: 'all', value: null, label: '所有貼文' };
    let searchQuery = '';

    // Initialize Saved Posts IDs from LocalStorage
    let savedPostIds = JSON.parse(localStorage.getItem('community_saved_ids') || '[]');

    window.toggleSavePost = (postId, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        const user = getAuthenticatedUser();
        if (!user) {
            alert('請先登入後使用收藏功能！');
            if (typeof window.openAuthModal === 'function') {
                window.openAuthModal('login');
            }
            return;
        }

        const index = savedPostIds.indexOf(postId);
        if (index === -1) {
            savedPostIds.push(postId);
        } else {
            savedPostIds.splice(index, 1);
        }
        localStorage.setItem('community_saved_ids', JSON.stringify(savedPostIds));

        // Update Bookmark UI
        const btns = document.querySelectorAll(`.btn - save[data - post - id="${postId}"]`);
        btns.forEach(btn => {
            const icon = btn.querySelector('i');
            if (index === -1) {
                icon.className = 'fi fi-sr-bookmark';
                btn.classList.add('active');
            } else {
                icon.className = 'fi fi-br-bookmark';
                btn.classList.remove('active');
            }
        });

        if (activeFilter.type === 'saved') {
            applyFilter();
        }
    };

    window.toggleLikePost = (postId, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        let likedIds = JSON.parse(localStorage.getItem('community_liked_ids') || '[]');
        const index = likedIds.indexOf(postId);
        if (index === -1) {
            likedIds.push(postId);
        } else {
            likedIds.splice(index, 1);
        }
        localStorage.setItem('community_liked_ids', JSON.stringify(likedIds));

        const btns = document.querySelectorAll(`.btn - heart[data - post - id="${postId}"]`);
        btns.forEach(btn => {
            if (index === -1) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        if (activeFilter.type === 'saved') {
            applyFilter();
        }
    };

    window.sharePost = (postId, event) => {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const dummyUrl = window.location.origin + window.location.pathname + '#post-' + postId;
        navigator.clipboard.writeText(dummyUrl).then(() => {
            alert('貼文連結已複製到剪貼簿');
        });
    };

    // ============================
    // 1. 資料處理 (Data Handling)
    // ============================

    // 初始化貼文資料 (Local Storage + 預設)
    const loadPosts = () => {
        const stored = localStorage.getItem('community_posts');
        let localPosts = stored ? JSON.parse(stored) : [];

        // 預設貼文 (Restored original examples)
        const defaultPosts = [
            // Hot Posts
            { id: 'def-1', title: '車禍理賠對方一直拖...', content: '肇責全在他，結果保險公司說要等流程，已經兩個月了，請問有人遇過類似狀況嗎？', author: '匿名用戶', createdAt: Date.now() - 172800000, tags: ['理賠'], comments: [] },
            { id: 'def-2', title: '實支實付醫療險請益', content: '最近想補強醫療險，預算一年兩萬，請問大家推薦哪一家CP值比較高？', author: '保險小白', createdAt: Date.now() - 18000000, tags: ['醫療'], comments: [] },
            { id: 'def-3', title: '新生兒保單規劃', content: '寶寶快出生了，業務員推這張罐頭保單，包含重大傷病跟雙實支，這樣夠嗎？', author: '焦慮的媽媽', createdAt: Date.now() - 86400000, tags: ['新生兒'], comments: [] },
            { id: 'def-4', title: '住院收據遺失怎麼辦？', content: '住院出院後才發現收據不見了，還能補請領嗎？需要醫院出具什麼文件？', author: '理賠小白', createdAt: Date.now() - 259200000, tags: ['理賠'], comments: [] },
            { id: 'def-5', title: '實支實付重複理賠疑問', content: '我有兩張實支實付，真的可以兩家都請嗎？還是要看條款的「副本理賠」？', author: '保險冷知識', createdAt: Date.now() - 345600000, tags: ['醫療'], comments: [] },
            { id: 'def-6', title: '意外險搭配醫療險怎麼選', content: '一年保費預算一萬左右，想要意外+醫療的基本保障，大家怎麼搭配？', author: '小資族', createdAt: Date.now() - 518400000, tags: ['意外'], comments: [] },

            // New Posts
            { id: 'def-7', title: '寵物保險有推薦的嗎？', content: '家裡的貓咪最近想保險，看這幾家好像都不錯，主要擔心理賠會不會很刁難。', author: '貓奴', createdAt: Date.now() - 600000, tags: ['寵物'], comments: [] },
            { id: 'def-8', title: '乙式跟丙式車險差別', content: '新車剛買，業務一直推乙式，但覺得有點貴，丙式真的不夠用嗎？通常大家都保哪個？', author: '開車族', createdAt: Date.now() - 3600000, tags: ['車險'], comments: [] },
            { id: 'def-9', title: '儲蓄險值得買嗎？', content: '剛出社會月薪35k，被推銷6年期儲蓄險，說是強迫儲蓄，但我怕臨時要用錢。', author: '社會新鮮人', createdAt: Date.now() - 10800000, tags: ['儲蓄'], comments: [] },
            { id: 'def-10', title: '旅游險需不需要加買不便險', content: '下週要去日本，想知道班機延誤或行李遺失的保障是否值得加。', author: '旅遊控', createdAt: Date.now() - 14400000, tags: ['旅遊'], comments: [] },
            { id: 'def-11', title: '運動傷害理賠經驗分享', content: '健身拉傷住院三天，意外險+醫療險實際理賠流程分享給大家。', author: '健身人', createdAt: Date.now() - 86400000, tags: ['意外'], comments: [] },
            { id: 'def-12', title: '門診手術如何申請保險？', content: '門診手術沒有住院，保險申請需要哪些證明？我整理了清單。', author: '理賠筆記', createdAt: Date.now() - 90000000, tags: ['醫療'], comments: [] }
        ];

        // 合併：Local 的優先顯示
        cachedPosts = filterDeleted([...localPosts, ...defaultPosts]);
        // 這裡不全體排序，保留 "熱門" (前面的預設貼文) 和 "最新" (後面的預設貼文) 的區隔感，
        // 但新增的貼文(local)應該要在最前面。
        // 簡單策略：Local posts 插在最前面

        applyFilter();
    };

    // Helper to filter out deleted posts
    const filterDeleted = (posts) => {
        const deletedIds = JSON.parse(localStorage.getItem('community_deleted_ids') || '[]');
        return posts.filter(p => !deletedIds.includes(p.id));
    };

    const savePost = (post) => {
        const stored = localStorage.getItem('community_posts');
        let localPosts = stored ? JSON.parse(stored) : [];
        localPosts.unshift(post); // 新的放前面
        localStorage.setItem('community_posts', JSON.stringify(localPosts));
        loadPosts(); // Reload to update UI
    };

    const saveComment = (postId, comment) => {
        // 更新 Local Storage 中的貼文
        const stored = localStorage.getItem('community_posts');
        let localPosts = stored ? JSON.parse(stored) : [];
        const postIndex = localPosts.findIndex(p => p.id === postId);

        if (postIndex >= 0) {
            if (!localPosts[postIndex].comments) localPosts[postIndex].comments = [];
            localPosts[postIndex].comments.push(comment);
            localStorage.setItem('community_posts', JSON.stringify(localPosts));
            loadPosts();
            return true;
        }
        return false;
    };

    // ============================
    // 2. UI 渲染 (Rendering)
    // ============================

    const renderPosts = (target, posts) => {
        target.innerHTML = '';
        posts.forEach(post => {
            const dateStr = new Date(post.createdAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const card = document.createElement('div');
            card.className = 'comm-card';
            card.style.cursor = 'pointer';
            card.onclick = () => openPostDetail(post); // 點擊卡片查看詳情

            let fileIndicator = '';
            if (post.file) {
                fileIndicator = `<div style="font-size:0.8rem; color:#A3C98E; margin-top:5px;">📎 已附加檔案 / 圖片</div>`;
            }

            const isSaved = savedPostIds.includes(post.id);
            const likedIds = JSON.parse(localStorage.getItem('community_liked_ids') || '[]');
            const isLiked = likedIds.includes(post.id);
            const heartClass = isLiked ? 'btn-heart active' : 'btn-heart';
            const saveClass = isSaved ? 'btn-save active' : 'btn-save';
            const saveIcon = isSaved ? 'fi-sr-bookmark' : 'fi-br-bookmark';

            card.innerHTML = `
            <div class="comm-user">
                    <div class="comm-avatar" style="background-color: ${stringToColor(post.author)};"></div>
                    <div>
                        <div style="font-size: 0.8rem; color: #888;">${dateStr}</div>
                        <div style="font-weight: 600;">${post.author}</div>
                    </div>
                </div>
                <h3 style="margin: 0.8rem 0 0.5rem; font-size: 1.1rem;">${escapeHtml(post.title)}</h3>
                <p style="font-size: 0.9rem; color: #666; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 2.5rem;">${escapeHtml(post.content)}</p>
                ${fileIndicator}
        <div class="card-actions">
            <button class="${heartClass}" data-post-id="${post.id}" onclick="toggleLikePost('${post.id}', event)">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <button class="btn-share" onclick="sharePost('${post.id}', event)">
                <i class="fi fi-bs-share"></i>
            </button>
            <button class="${saveClass}" data-post-id="${post.id}" onclick="toggleSavePost('${post.id}', event)">
                <i class="fi ${saveIcon}"></i>
            </button>
        </div>
        `;
            target.appendChild(card);
        });
    };

    const applyFilter = () => {
        let filtered = cachedPosts;
        const badges = document.querySelectorAll('.section-badge');

        if (activeFilter.type === 'company') {
            filtered = cachedPosts.filter(p => p.company === activeFilter.value);
            // Restore headers if they were changed
            if (badges.length >= 2) {
                badges[0].textContent = '熱門貼文';
                badges[1].textContent = '最新貼文';
            }
        } else if (activeFilter.type === 'saved') {
            // Special categorized view for "Saved Posts"
            const likedIds = JSON.parse(localStorage.getItem('community_liked_ids') || '[]');

            const savedPosts = cachedPosts.filter(p => savedPostIds.includes(p.id));
            const likedPosts = cachedPosts.filter(p => likedIds.includes(p.id));

            if (badges.length >= 2) {
                badges[0].textContent = '收藏貼文';
                badges[1].textContent = '按讚貼文';
            }

            if (lists.length >= 2) {
                renderPosts(lists[0], savedPosts);
                renderPosts(lists[1], likedPosts);
            }
            return; // Exit early as we've handled the categorized render
        } else {
            // Restore default headers for 'all' or other types
            if (badges.length >= 2) {
                badges[0].textContent = '熱門貼文';
                badges[1].textContent = '最新貼文';
            }
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                (p.title && p.title.toLowerCase().includes(query)) ||
                (p.content && p.content.toLowerCase().includes(query))
            );
        }

        // 分配到兩個列表
        if (lists.length >= 2) {
            // 如果正在搜尋或篩選，就全部顯示在第一個，清空第二個
            if (searchQuery || activeFilter.type !== 'all') {
                renderPosts(lists[0], filtered);
                renderPosts(lists[1], []);
            } else {
                // 預設檢視：切分 "熱門" 和 "最新"
                const localCount = cachedPosts.length - 12;
                const cutIndex = Math.max(0, localCount) + 6;

                const hotPosts = filtered.slice(0, cutIndex);
                const newPosts = filtered.slice(cutIndex);

                renderPosts(lists[0], hotPosts);
                renderPosts(lists[1], newPosts);
            }
        } else if (lists.length === 1) {
            renderPosts(lists[0], filtered);
        }
    };

    // ============================
    // 3. Modal & Form Logic
    // ============================

    // 開啟發文 Modal
    const createBtn = document.querySelector('.create-post-fab');
    if (createBtn) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const user = getAuthenticatedUser();
            if (!user) {
                if (confirm('發布貼文需要登入，是否立即登入？')) {
                    window.openAuthModal('login');
                }
            } else {
                document.getElementById('create-post-modal').classList.add('show');
            }
        });
    }

    // 關閉 Modal helper (Global scope needed for onclick in HTML)
    window.closeCreatePostModal = () => {
        document.getElementById('create-post-modal').classList.remove('show');
        document.getElementById('create-post-form').reset();
        document.getElementById('file-preview-area').innerHTML = '';
        document.getElementById('file-preview-area').style.display = 'none';
        selectedFile = null;
    };

    window.closePostDetailModal = () => {
        document.getElementById('post-detail-modal').classList.remove('show');
    };

    // Delete Post Logic
    let pendingDeletePostId = null;

    window.confirmDeletePost = (postId) => {
        pendingDeletePostId = postId;
        document.getElementById('delete-confirm-modal').classList.add('show');
    };

    window.closeDeleteConfirmModal = () => {
        document.getElementById('delete-confirm-modal').classList.remove('show');
        pendingDeletePostId = null;
    };

    window.executeDeletePost = () => {
        if (!pendingDeletePostId) return;

        const stored = localStorage.getItem('community_posts');
        let localPosts = stored ? JSON.parse(stored) : [];

        // Remove post
        const newPosts = localPosts.filter(p => p.id !== pendingDeletePostId);
        // Also need to handle "default" posts if we want to allow deleting them locally (shadow delete)
        // For simplicity, let's assume we can only delete local posts or we use a "deleted_ids" list for defaults.
        // But the requirement implies we should be able to delete.
        // Let's stick to updating the localPosts array. If it was a default post, we might need a way to suppress it.
        // For now, let's assume we maintain the full list in memory/localstorage as the source of truth once loaded.

        // Actually, loadPosts merges defaults. We should update the "deleted" status.
        // Easier approach: Just filter it out from the current view and save the updated list?
        // But loadPosts merges defaultPosts every time.
        // Let's add a "deleted" flag in localStorage for default posts?

        // Current implementation of 'savePost' puts new items in localPosts.
        // 'loadPosts' merges localPosts + defaultPosts.
        // To delete a default post, we need to track "deletedIds".

        let deletedIds = JSON.parse(localStorage.getItem('community_deleted_ids') || '[]');
        deletedIds.push(pendingDeletePostId);
        localStorage.setItem('community_deleted_ids', JSON.stringify(deletedIds));

        // Also remove from local_posts if it exists there
        const updatedLocalPosts = localPosts.filter(p => p.id !== pendingDeletePostId);
        localStorage.setItem('community_posts', JSON.stringify(updatedLocalPosts));

        loadPosts();
        window.closeDeleteConfirmModal();
        window.closePostDetailModal();
        alert('貼文已刪除');
    };

    // 檔案處理
    let selectedFile = null;
    window.handleFileSelect = (input) => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = function (e) {
                selectedFile = {
                    name: file.name,
                    type: file.type,
                    data: e.target.result // Base64 for preview/storage
                };
                const preview = document.getElementById('file-preview-area');
                preview.style.display = 'block';
                if (file.type.startsWith('image/')) {
                    preview.innerHTML = `< img src = "${e.target.result}" style = "max-height: 150px; max-width: 100%; border-radius: 8px;" > `;
                } else {
                    preview.innerHTML = `< div style = "display:flex; align-items:center; gap:8px;" >📎 <span>${file.name}</span></div > `;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    // 提交發文
    const createForm = document.getElementById('create-post-form');
    if (createForm) {
        createForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = getAuthenticatedUser();
            if (!user) return;

            const title = document.getElementById('post-title').value;
            const content = document.getElementById('post-content').value;
            const isAnonymous = document.getElementById('post-anonymous').checked;

            const newPost = {
                id: 'post-' + Date.now(),
                title: title,
                content: content,
                author: isAnonymous ? '匿名用戶' : (user.displayName || user.username),
                authorId: isAnonymous ? null : user.id,
                createdAt: Date.now(),
                file: selectedFile,
                comments: []
            };

            savePost(newPost);
            window.closeCreatePostModal();
            alert('貼文已發布！');
        });
    }

    // 查看貼文詳情
    window.openPostDetail = (post) => {
        const modal = document.getElementById('post-detail-modal');
        const contentDiv = document.getElementById('detail-post-content');
        const commentsList = document.getElementById('comments-list');
        const commentForm = document.getElementById('comment-form');
        const guestMsg = document.getElementById('guest-comment-msg');

        const dateStr = new Date(post.createdAt).toLocaleString();

        let fileDisplay = '';
        if (post.file) {
            if (post.file.type.startsWith('image/')) {
                fileDisplay = `< img src = "${post.file.data}" style = "max-width:100%; border-radius:12px; margin-top:1rem;" > `;
            } else {
                fileDisplay = `< div style = "background:#f0f0f0; padding:10px; border-radius:8px; margin-top:1rem; display:inline-block;" >📎 ${post.file.name}</div > `;
            }
        }

        const user = getAuthenticatedUser();
        const isAuthor = user && (user.username === post.author || user.displayName === post.author); // Simple check
        const isAdmin = user && (user.username === 'superuser' || user.displayName === '系統管理員(本機)');

        let deleteBtn = '';
        if (isAuthor || isAdmin) {
            deleteBtn = `< button onclick = "confirmDeletePost('${post.id}')" style = "margin-left:auto; background:#ff4d4d; color:white; border:none; padding:5px 12px; border-radius:4px; cursor:pointer;" > 刪除貼文</button > `;
        }

        const isSaved = savedPostIds.includes(post.id);
        const heartClass = isSaved ? 'btn-heart active' : 'btn-heart';

        // In detail view, we can put heart next to delete or in top left. 
        // User asked for "Top Left" inside detail view too.
        // Current layout: Flex row with Avatar | Info.
        // We can add it before Avatar.

        contentDiv.innerHTML = `
            < div style = "position:relative; margin-bottom:1rem; padding-left: 50px;" > < !--space for heart-- >
                <button class="${heartClass}" data-post-id="${post.id}" onclick="toggleSavePost('${post.id}', event)" style="top:0; left:0;">
                    <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:40px; height:40px; border-radius:50%; background-color:${stringToColor(post.author)};"></div>
                    <div>
                        <div style="font-weight:700; font-size:1.1rem;">${post.author}</div>
                        <div style="color:#888; font-size:0.85rem;">${dateStr}</div>
                    </div>
                    ${deleteBtn}
                </div>
            </div >
            <h2 style="margin-bottom:1rem;">${escapeHtml(post.title)}</h2>
            <div style="font-size:1rem; line-height:1.6; color:#333; white-space: pre-wrap;">${escapeHtml(post.content)}</div>
            ${fileDisplay}
        `;

        // 渲染留言
        renderComments(post, commentsList);

        // 檢查權限 (留言)
        // Re-check user for comment form logic, but reuse variable if possible or just check auth again cleanly
        // The 'user' variable is already declared above (line 1158), so we shouldn't redeclare it.
        // We can just use it.
        if (user) {
            commentForm.style.display = 'flex';
            guestMsg.style.display = 'none';
            commentForm.onsubmit = (e) => {
                e.preventDefault();
                const input = document.getElementById('comment-input');
                const commentText = input.value.trim();
                if (commentText) {
                    const newComment = {
                        author: user.displayName || user.username,
                        content: commentText,
                        createdAt: Date.now()
                    };
                    // 如果是用 local dummy data, 下面這個 saveComment 可能會失敗 (如果是 default post)
                    // 這裡我們暫時只支援新貼文的留言，或者是模擬成功 UI
                    const success = savePostComment(post.id, newComment);
                    if (!success && post.id.startsWith('def-')) {
                        // 針對預設貼文的暫時處置 (存在 session 或 memory 讓它看起來會動)
                        post.comments = post.comments || [];
                        post.comments.push(newComment);
                    }

                    renderComments(post, commentsList);
                    input.value = '';
                }
            };
        } else {
            commentForm.style.display = 'none';
            guestMsg.style.display = 'block';
        }

        modal.classList.add('show');
    };

    const renderComments = (post, target) => {
        target.innerHTML = '';
        const comments = post.comments || [];
        const user = getAuthenticatedUser();
        const isAdmin = user && (user.username === 'superuser' || user.displayName === '系統管理員(本機)');

        if (comments.length === 0) {
            target.innerHTML = '<div style="color:#999; font-style:italic;">尚無留言，成為第一個留言的人吧！</div>';
            return;
        }
        comments.forEach((c, index) => {
            const row = document.createElement('div');
            row.style.cssText = 'padding: 10px; background: #fafafa; border-radius: 8px; position: relative;';
            const time = new Date(c.createdAt).toLocaleString();

            let deleteCommentBtn = '';
            if (isAdmin) {
                deleteCommentBtn = `< span onclick = "deleteComment('${post.id}', ${index})" style = "position:absolute; right:10px; top:10px; color:#ff4d4d; cursor:pointer; font-weight:bold;" >& times;</span > `;
            }

            row.innerHTML = `
            < div style = "display:flex; justify-content:space-between; margin-bottom:4px; padding-right: 20px;" >
                    <span style="font-weight:600; color:#555;">${c.author}</span>
                    <span style="font-size:0.8rem; color:#aaa;">${time}</span>
                </div >
            <div style="color:#333;">${escapeHtml(c.content)}</div>
                ${deleteCommentBtn}
        `;
            target.appendChild(row);
        });
    }

    window.deleteComment = (postId, commentIndex) => {
        if (confirm('確定要刪除此留言嗎？')) {
            const stored = localStorage.getItem('community_posts');
            let localPosts = stored ? JSON.parse(stored) : [];
            let postIdx = localPosts.findIndex(p => p.id === postId);

            if (postIdx >= 0) {
                localPosts[postIdx].comments.splice(commentIndex, 1);
                localStorage.setItem('community_posts', JSON.stringify(localPosts));
                loadPosts();
                // Refresh detail view if open?
                // We need to fetch the updated post from cachedPosts
                const updatedPost = cachedPosts.find(p => p.id === postId);
                if (updatedPost) {
                    const commentsList = document.getElementById('comments-list');
                    renderComments(updatedPost, commentsList);
                }
            } else {
                // Handle default posts comments (which are not in localPosts initially if no comments added)
                // This is tricky because we might need to "promote" the default post to local to modify it, 
                // or track deletedComments separate. 
                // For now, assume we can only delete comments on posts that are tracked in localPosts (modified posts).
                // Or simplified: Just remove it from the runtime object and save it?
                // Our caching strategy is a bit split. 
                // Let's rely on savePostComment logic: it promotes default posts to local? No, it just finds index.
                // We should ensure we can modify default posts' comments.

                // If it's a default post and not in localPosts yet, we can't save changes easily unless we copy it to local.
                // But `saveComment` logic in script.js (lines 902) only checks localPosts? 
                // Wait, logic at 902: 
                // `let localPosts = stored ? JSON.parse(stored) : []; `
                // `const postIndex = localPosts.findIndex...`
                // So currently we CANNOT add comments to default posts and have them persist? 
                // Let's check `saveComment` again. 

                // Line 906: `localPosts.findIndex`... 
                // So yes, currently comments on default posts might not be saving to localPosts unless we copy it there.
                // Step 1136 mentions: "If !success && post.id.startsWith('def-')... post.comments.push..." -> purely in-memory.

                // To support admin delete on default posts properly, we'd need a robust backend or full sync.
                // For this task, let's just update the in-memory `cachedPosts` and refresh UI.

                const post = cachedPosts.find(p => p.id === postId);
                if (post && post.comments) {
                    post.comments.splice(commentIndex, 1);
                    // If it's a local post, save it.
                    if (!postId.startsWith('def-')) {
                        // It's local, so find it in localPosts
                        const localIdx = localPosts.findIndex(p => p.id === postId);
                        if (localIdx >= 0) {
                            localPosts[localIdx].comments = post.comments;
                            localStorage.setItem('community_posts', JSON.stringify(localPosts));
                        }
                    }
                    const commentsList = document.getElementById('comments-list');
                    renderComments(post, commentsList);
                }
            }
        }
    };

    // Save comment helper (re-implementation of logic)
    const savePostComment = (postId, comment) => {
        const stored = localStorage.getItem('community_posts');
        let localPosts = stored ? JSON.parse(stored) : [];
        const idx = localPosts.findIndex(p => p.id === postId);
        if (idx >= 0) {
            if (!localPosts[idx].comments) localPosts[idx].comments = [];
            localPosts[idx].comments.push(comment);
            localStorage.setItem('community_posts', JSON.stringify(localPosts));
            loadPosts(); // Refresh background list
            return true;
        }
        return false;
    };

    // Helpers
    const escapeHtml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const stringToColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    };

    // 初始化
    loadPosts();

    // 搜尋相關
    if (searchBtn) searchBtn.addEventListener('click', () => {
        searchQuery = searchInput.value.trim();
        applyFilter();
    });
    if (searchInput) searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim();
        applyFilter();
    });
}

function initPolicyFeatures() {
    const listContainer = document.querySelector('.policy-list-container');
    const uploadCard = document.querySelector('.upload-card-content');
    const currentUserId = localStorage.getItem('currentUserId');
    const user = getAuthenticatedUser();

    // Initial data load or mock
    let policies = user ? [
        {
            id: 'p1', title: '超級醫療險計畫', date: '2024-01-15', type: '醫', color: 'green',
            company: '富邦人壽', policyNo: 'FB-998122',
            details: {
                sickness_inpatient: { lifetime: 1000, term: 2000 },
                surgery: { outpatient: 50000, inpatient: 150000 },
                reimbursement: { medical: 150000 }
            }
        },
        {
            id: 'p2', title: '安心終身壽險', date: '2023-10-05', type: '壽', color: 'blue',
            company: '國泰人壽', policyNo: 'CT-776211',
            details: {
                life_insurance: { general: 3000000 },
                assets: 500000
            }
        },
        {
            id: 'p3', title: '意外傷害保險', date: '2024-02-01', type: '意', color: 'orange',
            company: '南山人壽', policyNo: 'NS-554300',
            details: {
                accident_inpatient: { term: 1000 },
                reimbursement: { accident: 50000 },
                life_insurance: { accident_only: 1000000 }
            }
        },
        {
            id: 'p4', title: '防癌健康保險', date: '2022-05-20', type: '癌', color: 'purple',
            company: '全球人壽', policyNo: 'GL-112233',
            details: {
                cancer: 1000000,
                sickness_inpatient: { term: 2000 }
            }
        }
    ] : [];

    function renderPolicies() {
        listContainer.innerHTML = '';
        policies.forEach(policy => {
            addPolicyToUI(policy);
        });

        // Hide detail view if no policies
        const detailCard = document.querySelector('.detail-view-card');
        if (detailCard) {
            detailCard.style.display = policies.length === 0 ? 'none' : 'block';
        }

        // Update Pyramid Analysis
        if (typeof renderPyramidAnalysis === 'function') {
            renderPyramidAnalysis(policies);
        }
    }

    function addPolicyToUI(policy, prepend = false) {
        const div = document.createElement('div');
        div.className = 'policy-item';
        div.dataset.id = policy.id;

        let colorStyle = 'color: #4CAF50; background: #E8F5E9;'; // Default Green (Medical)
        if (policy.color === 'blue' || policy.type === '壽') colorStyle = 'color: #4A90E2; background: #E3F2FD;';
        if (policy.color === 'orange' || policy.type === '意') colorStyle = 'color: #FF9800; background: #FFF3E0;';
        if (policy.color === 'purple' || policy.type === '癌') colorStyle = 'color: #9C27B0; background: #F3E5F5;';

        div.innerHTML = `
            < div class= "policy-type-side" >
                <span class="policy-type-badge-large" style="${colorStyle}">${policy.type || '保'}</span>
            </div >
            <div class="policy-content-side">
                <div class="policy-info-line-centered">
                    <h4 class="policy-title-text-centered">${policy.title}</h4>
                </div>
                <div class="policy-info-line-centered">
                    <span class="policy-date-text-centered">生效日：${policy.date ? policy.date.split('T')[0] : '剛剛'}</span>
                </div>
                <div class="policy-actions-line-centered">
                    <button class="btn-action-inline view" onclick="viewPolicy('${policy.id}')" title="查看">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button class="btn-action-inline edit" onclick="editPolicy('${policy.id}')" title="修改">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-action-inline delete" onclick="deletePolicy('${policy.id}')" title="刪除">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;

        // Click on item itself to view (except if clicking actions)
        div.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-action')) {
                viewPolicy(policy.id);
            }
        });

        if (prepend) listContainer.prepend(div); else listContainer.appendChild(div);
    }

    // Expose CRUD functions to window for onclick handlers
    window.viewPolicy = (id) => {
        document.querySelectorAll('.policy-item').forEach(el => el.classList.remove('active'));
        const item = document.querySelector(`.policy - item[data - id="${id}"]`);
        if (item) item.classList.add('active');

        const p = policies.find(x => x.id === id);
        if (p) {
            // Update Header
            document.querySelector('.detail-title h2').textContent = p.title;
            const metaSpans = document.querySelectorAll('.detail-meta span');
            if (metaSpans.length >= 5) {
                metaSpans[0].textContent = `承保: ${p.company || '未知'} `;
                metaSpans[2].textContent = `保單號: ${p.policyNo || 'N/A'} `;
                metaSpans[4].textContent = `生效日: ${p.date ? p.date.split('T')[0] : 'N/A'} `;
            }

            // Update Content based on details
            const d = p.details || {};
            const groups = document.querySelectorAll('.detail-content .data-group');

            // 預設重置所有值
            document.querySelectorAll('.info-value').forEach(el => el.textContent = '-');

            if (d.sickness_inpatient || d.accident_inpatient) {
                const daily = (d.sickness_inpatient?.lifetime || 0) + (d.sickness_inpatient?.term || 0) + (d.accident_inpatient?.term || 0);
                const inpatientVal = document.querySelectorAll('.info-value')[0];
                if (inpatientVal) inpatientVal.textContent = `$ ${daily.toLocaleString()} / 日`;

                const icuVal = document.querySelectorAll('.info-value')[1];
                if (icuVal) icuVal.textContent = `$ ${(daily * 2).toLocaleString()} / 日 (模擬)`;
            }

            if (d.reimbursement) {
                const limitVal = document.querySelectorAll('.info-value')[2];
                if (limitVal) limitVal.textContent = `$ ${(d.reimbursement.medical || d.reimbursement.accident || 0).toLocaleString()} / 次`;
            }

            if (d.surgery) {
                const surgInpatientVal = document.querySelectorAll('.info-value')[3];
                if (surgInpatientVal) surgInpatientVal.textContent = `$ ${(d.surgery.inpatient || 0).toLocaleString()} / 次`;

                const surgOutpatientVal = document.querySelectorAll('.info-value')[4];
                if (surgOutpatientVal) surgOutpatientVal.textContent = `$ ${(d.surgery.outpatient || 0).toLocaleString()} / 次`;
            }

            // 如果是癌症或身故，可以擴展 UI 顯示，但這裡先維持現有結構
            if (d.cancer) {
                const limitVal = document.querySelectorAll('.info-value')[2];
                if (limitVal) limitVal.textContent = `$ ${d.cancer.toLocaleString()} (癌症給付)`;
            }
            if (d.life_insurance) {
                const limitVal = document.querySelectorAll('.info-value')[2];
                if (limitVal) limitVal.textContent = `$ ${(d.life_insurance.general || d.life_insurance.accident_only).toLocaleString()} (身故給付)`;
            }
        }
    };

    window.editPolicy = (id) => {
        // Trigger hidden upload for edit
        const input = document.getElementById('edit-policy-input');
        if (input) {
            input.dataset.editId = id;
            input.click();
        }
    };

    window.deletePolicy = (id) => {
        if (confirm('確定要刪除此保單嗎？')) {
            policies = policies.filter(p => p.id !== id);
            renderPolicies();
            // If deleted active one, select first available?
            const active = document.querySelector('.policy-item.active');
            if (!active && policies.length > 0) {
                viewPolicy(policies[0].id);
            } else if (policies.length === 0) {
                // If no more policies, hide the detail card
                const detailCard = document.querySelector('.detail-view-card');
                if (detailCard) detailCard.style.display = 'none';
            }
        }
    };

    // Initial Render
    renderPolicies();
    // Select first one by default
    if (policies.length > 0) window.viewPolicy(policies[0].id);

    // Hide Pyramid button for unauthenticated users
    if (!user) {
        const pyramidBtn = document.querySelector('.pyramid-fab');
        if (pyramidBtn) pyramidBtn.style.display = 'none';

        // Also hide it from its specific container if it exists
        const pyramidContainer = document.getElementById('pyramid-btn-container');
        if (pyramidContainer) pyramidContainer.style.display = 'none';
    }


    if (uploadCard) {
        // Upload New
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        document.body.appendChild(input);

        // Upload Update (Edit)
        const editInput = document.createElement('input');
        editInput.type = 'file';
        editInput.id = 'edit-policy-input';
        editInput.style.display = 'none';
        document.body.appendChild(editInput);

        uploadCard.addEventListener('click', () => input.click());

        // Handle New Upload
        input.addEventListener('change', () => {
            if (input.files[0]) processUpload(input.files[0].name);
            input.value = '';
        });

        // Handle Edit Upload
        editInput.addEventListener('change', () => {
            if (editInput.files[0]) {
                const id = editInput.dataset.editId;
                const file = editInput.files[0];
                // Update Mock Data
                const idx = policies.findIndex(p => p.id === id);
                if (idx >= 0) {
                    policies[idx].title = file.name.split('.')[0]; // Update title to filename
                    policies[idx].date = new Date().toISOString();
                    renderPolicies();
                    alert(`已更新保單：${file.name}`);
                    window.viewPolicy(id);
                }
            }
            editInput.value = '';
        });
    }

    function processUpload(fileName) {
        // Enforce guest limits for unauthenticated users
        if (!user) {
            const today = new Date().toLocaleDateString();
            const lastUploadDate = localStorage.getItem('guest_upload_date');
            let count = parseInt(localStorage.getItem('guest_translation_count') || '0');

            // Reset count if it's a new day
            if (lastUploadDate !== today) {
                count = 0;
                localStorage.setItem('guest_upload_date', today);
            }

            if (count >= 3) {
                alert('今日訪客試用次數已達上限，請登入或註冊帳號以繼續使用完整功能！');
                if (typeof window.openAuthModal === 'function') {
                    window.openAuthModal('login');
                }
                return;
            }
            count++;
            localStorage.setItem('guest_translation_count', count.toString());
        }

        const temp = document.createElement('div');
        temp.className = 'policy-item';
        temp.innerHTML = `<div><h4>${fileName}</h4><span>AI 辨識中...</span></div>`;
        listContainer.prepend(temp);

        setTimeout(() => {
            temp.remove();
            const newId = 'p-' + Date.now();
            const newPolicy = { id: newId, title: fileName.split('.')[0], date: new Date().toISOString(), type: '新', color: 'green' };
            policies.unshift(newPolicy); // Add to top
            renderPolicies();
            window.viewPolicy(newId);

        }, 1500);
    }
}

function initBudgetEstimator() {
    const btn = document.querySelector('.budget-search-btn');
    const input = document.querySelector('.budget-search-input');
    if (btn && input) {
        btn.addEventListener('click', () => {
            const val = 120000;
            document.querySelectorAll('.budget-dash-card')[0].querySelector('div:nth-child(2)').textContent = `$ ${val.toLocaleString()}`;
            document.querySelectorAll('.budget-dash-card')[1].querySelector('div:nth-child(2)').textContent = `$ ${(val * 0.8).toLocaleString()}`;
            document.querySelectorAll('.budget-dash-card')[2].querySelector('div:nth-child(2)').textContent = `$ ${(val * 0.2).toLocaleString()}`;

        });
    }
}

// 供全域呼叫的變數
window.selectedAgent = null;
window.selectAgent = function (type) {
    document.querySelectorAll('.consulting-item').forEach(i => i.classList.remove('selected'));
    document.getElementById('agent-' + type).classList.add('selected');
    window.selectedAgent = type;
    updateChatAgentUI(type);
};

window.startConsulting = function () {
    if (!window.selectedAgent) { alert('請先選擇一位保險員'); return; }
    document.getElementById('selection-layout').style.display = 'none';
    document.getElementById('start-btn').style.display = 'none';

    const chatInterface = document.getElementById('chat-interface');
    chatInterface.style.display = 'flex';
    updateChatAgentUI(window.selectedAgent);

    // 清空舊訊息
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';

    if (window.selectedAgent === 'human') {
        // --- 真人保險員邏輯 ---
        appendSystemMessage('正在為您尋找線上保險員...');
        setChatInputState(false, '等待保險員接案中...');

        // 保持在此狀態，不自動連接
        // 之前是用 setTimeout 模擬連接，現在移除

    } else {
        // --- AI 保險員邏輯 ---
        setChatInputState(true, '輸入您的問題...');
        setTimeout(() => {
            appendAgentMessage('ai', '嗨！我是 AI 保險員。您可以問我關於「理賠」、「旅遊險」或「手術費用」的問題喔！');
        }, 500);
    }

};

window.endConsulting = function () {
    if (confirm('結束諮詢？')) location.reload();
}

window.sendMessage = function () {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
        // 顯示使用者訊息
        const msg = document.createElement('div');
        msg.className = 'message user';
        msg.textContent = text;
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        input.value = '';

        // AI 自動回覆邏輯
        if (window.selectedAgent === 'ai') {
            simulateAIResponse(text);
        }
    }
}

window.handleChatInput = function (e) {
    if (e.key === 'Enter') {
        const input = document.getElementById('chat-input');
        if (!input.disabled) window.sendMessage();
    }
}

const AGENT_CONFIG = {
    ai: { name: 'AI 保險員', avatar: 'AI機器人.png' },
    human: { name: '真人保險員', avatar: '真人保險員.png' }
};

function updateChatAgentUI(type) {
    const config = AGENT_CONFIG[type];
    if (!config) return;
    const nameEl = document.getElementById('chat-agent-name');
    const avatarEl = document.getElementById('chat-agent-avatar');
    if (nameEl) nameEl.textContent = config.name;
    if (avatarEl) avatarEl.src = config.avatar;
}

// ==========================================
// Chat Helper Functions
// ==========================================

function appendSystemMessage(text) {
    const chatMessages = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'message system';
    msg.style.cssText = 'text-align: center; color: #888; font-size: 0.85rem; margin: 10px 0;';
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendAgentMessage(type, text) {
    const chatMessages = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = `message agent ${type}`;
    // 簡單樣式 fallback，以防 style.css 沒定義
    if (!msg.className.includes('user')) {
        msg.style.cssText = 'background: #f1f1f1; padding: 10px 15px; border-radius: 12px 12px 12px 0; align-self: flex-start; max-width: 80%; margin-bottom: 10px; color: #333;';
    }
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setChatInputState(enabled, placeholderText) {
    const input = document.getElementById('chat-input');
    const btn = document.querySelector('.chat-send-btn');
    if (input) {
        input.disabled = !enabled;
        if (placeholderText) input.placeholder = placeholderText;
    }
    if (btn) btn.disabled = !enabled;
}

function simulateAIResponse(text) {
    const chatMessages = document.getElementById('chat-messages');

    // 顯示正在輸入
    const typingId = 'typing-' + Date.now();
    const typingMsg = document.createElement('div');
    typingMsg.className = 'message agent ai typing';
    typingMsg.id = typingId;
    typingMsg.style.cssText = 'font-style: italic; color: #aaa; font-size: 0.8rem; margin-bottom: 5px;';
    typingMsg.textContent = 'AI 正在輸入...';
    chatMessages.appendChild(typingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        let response = '抱歉，我不確定您說的是什麼。您可以試著問「理賠流程」或「保費預算」。';

        // 簡單關鍵字邏輯
        if (text.includes('車禍') || text.includes('理賠') || text.includes('受傷') || text.includes('accident')) {
            response = '發生事故了嗎？別擔心！您可以點擊首頁的「理賠急救」按鈕，我會一步步引導您處理現場與報警。或者您想查詢特定險種的理賠？';
        } else if (text.includes('旅遊') || text.includes('出國') || text.includes('travel')) {
            response = '出國旅遊建議投保「旅平險」加上「不便險」。我們可以幫您試算額度，請告訴我您的目的地。';
        } else if (text.includes('費用') || text.includes('預算') || text.includes('多少錢') || text.includes('budget')) {
            response = '想知道手術或保費預算嗎？請參考上方的「費用預算」頁面，我們可以根據您的年齡與需求做精確試算。';
        } else if (text.includes('你好') || text.includes('嗨') || text.includes('hello') || text.includes('hi')) {
            response = '您好！我是您的 AI 保險小幫手。今天有什麼可以幫您的？';
        } else if (text.includes('真人') || text.includes('人')) {
            response = '如果您需要專人服務，請結束對話後選擇「真人保險員」喔！';
        }

        appendAgentMessage('ai', response);
    }, 1500);
}

// ==========================================
// Local Auth Helpers (使用 localStorage，暫時不連伺服器)
// ==========================================
function getLocalUsers() {
    try { return JSON.parse(localStorage.getItem('localUsers') || '[]'); } catch (e) { return []; }
}
function saveLocalUsers(users) { localStorage.setItem('localUsers', JSON.stringify(users)); }
function findUserByUsername(username) {
    if (!username) return null;
    return getLocalUsers().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}
function registerLocalUser(displayName, username, password) {
    const users = getLocalUsers();
    const id = 'local-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
    const user = { id, displayName, username, password };
    users.push(user);
    saveLocalUsers(users);
    return user;
}
function loginLocalUser(username, password) {
    const user = findUserByUsername(username);
    if (!user) return null;
    // 注意：此範例以明文比對密碼（僅供開發/Demo 用）
    if (user.password === password) return user;
    return null;
}
function setAuthenticatedUser(user) {
    if (!user) return;
    localStorage.setItem('authUser', JSON.stringify({ id: user.id, displayName: user.displayName, username: user.username }));
    localStorage.setItem('userAuthed', 'true');
    updateNavAuthUI();
}
function getAuthenticatedUser() {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
}
function clearAuth() {
    localStorage.removeItem('authUser');
    localStorage.removeItem('userAuthed');
    updateNavAuthUI();
}

function updateNavAuthUI() {
    const acct = document.getElementById('account-controls');
    if (!acct) return;
    acct.innerHTML = '';

    // [整合版] 只保留 Help Icon，使用者名稱/登出由 auth.js 的 auth-info-bar 統一處理
    const helpBtn = document.createElement('div');
    helpBtn.className = 'help-trigger';
    helpBtn.innerHTML = '?';
    helpBtn.title = '使用教學';
    helpBtn.onclick = () => openTutorial();
    acct.appendChild(helpBtn);
}

// ==========================================
// 4. 使用教學 (Tutorial Cards)
// ==========================================
const tutorialSteps = [
    {
        title: '歡迎來到「譯保通」',
        desc: '我們將複雜的保險條款轉化為白話文，讓您不再被艱澀條款困擾。點擊「下一步」開始探索！',
        icon: '👋'
    },
    {
        title: '理賠急救🚨',
        desc: '遇到突發狀況時，點擊右下角的「理賠急救」按鈕。AI會即時指導您現場處理流程與應對建議。',
        gif: '理賠急救範例.gif'
    },
    {
        title: '智慧保單📊',
        desc: '上傳您的保單，系統會自動辨識並歸納保障內容，幫助您發現潛在的風險缺口。',
        gif: '智慧保單範例.gif'
    },
    {
        title: '保險諮詢💬',
        desc: '不論是想問AI或是尋找專業真人顧問，您都可以在諮詢頁面獲得建議並解決問題。',
        gif: '保險諮詢範例.gif'
    },
    {
        title: '準備好了嗎？',
        desc: '快來體驗譯保通的各項功能吧！如果您需要更多協助，隨時可以點擊問號重新查看教學。',
        icon: '✨'
    }
];

let currentTutorialStep = 0;

function openTutorial() {
    let modal = document.getElementById('tutorial-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tutorial-modal';
        modal.className = 'tutorial-modal';
        modal.innerHTML = `
            <div class="tutorial-card">
                <span class="tutorial-close">&times;</span>
                <div class="tutorial-image"></div>
                <div class="tutorial-dots" id="tut-dots"></div>
                <div class="tutorial-content">
                    <h2 id="tut-title"></h2>
                    <p id="tut-desc"></p>
                </div>
                <div class="tutorial-footer">
                    <div class="tutorial-nav" style="width: 100%; justify-content: space-between;">
                        <button class="tutorial-btn prev" id="tut-prev">上一步</button>
                        <button class="tutorial-btn next" id="tut-next">下一步</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.tutorial-close').onclick = closeTutorial;
        modal.addEventListener('click', (e) => { if (e.target === modal) closeTutorial(); });
        modal.querySelector('#tut-prev').onclick = () => moveTutorial(-1);
        modal.querySelector('#tut-next').onclick = () => moveTutorial(1);
    }

    currentTutorialStep = 0;
    renderTutorialStep();
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    document.body.style.overflow = 'hidden';
}

function renderTutorialStep() {
    const modal = document.getElementById('tutorial-modal');
    if (!modal) return;

    const step = tutorialSteps[currentTutorialStep];
    modal.querySelector('#tut-title').textContent = step.title;
    modal.querySelector('#tut-desc').textContent = step.desc;

    const imageContainer = modal.querySelector('.tutorial-image');
    if (step.gif) {
        imageContainer.innerHTML = `<img src="${step.gif}" alt="${step.title}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 12px;">`;
        imageContainer.style.fontSize = '0';
    } else {
        imageContainer.textContent = step.icon;
        imageContainer.style.fontSize = '4rem';
    }

    // Render Dots
    const dotsContainer = modal.querySelector('#tut-dots');
    dotsContainer.innerHTML = '';
    tutorialSteps.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.className = `dot ${idx === currentTutorialStep ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
    });

    const prevBtn = modal.querySelector('#tut-prev');
    const nextBtn = modal.querySelector('#tut-next');

    prevBtn.style.visibility = currentTutorialStep === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = currentTutorialStep === tutorialSteps.length - 1 ? '完成' : '下一步';
}

function moveTutorial(dir) {
    if (dir === 1 && currentTutorialStep === tutorialSteps.length - 1) {
        closeTutorial();
        return;
    }
    currentTutorialStep += dir;
    renderTutorialStep();
}

function closeTutorial() {
    const modal = document.getElementById('tutorial-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }
}

// 初始化 nav 帳號狀態
setTimeout(() => { if (typeof updateNavAuthUI === 'function') updateNavAuthUI(); }, 300);

// ==========================================
// Server integration helpers
// ==========================================
function timeoutPromise(ms) {
    return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
}

async function tryServerAuth(formType, payload) {
    // 嘗試呼叫伺服器，若成功回傳使用者資料 { id, displayName, username }
    const url = `/api/auth/${formType}`;
    try {
        const res = await Promise.race([fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }), timeoutPromise(2200)]);

        if (!res || !res.ok) return null;
        const data = await res.json();
        if (data && data.user) return { id: data.user.id || data.user._id || null, displayName: data.user.displayName || data.user.name || data.user.username, username: data.user.username || payload.username };
        return null;
    } catch (err) {
        return null; // 伺服器不可用或超時
    }
}

async function attemptAutoConnect() {
    // 嘗試從伺服器取得 session
    try {
        const res = await Promise.race([fetch('/api/auth/session'), timeoutPromise(1800)]);
        if (res && res.ok) {
            const data = await res.json();
            if (data && data.user) {
                setAuthenticatedUser({ id: data.user.id || data.user._id, displayName: data.user.displayName || data.user.name || data.user.username, username: data.user.username });
                return;
            }
        }
    } catch (e) {
        // 忽略錯誤，保持 local 狀態
    }

    // 若伺服器不可用，保留 local 狀態（已由 updateNavAuthUI 處理）
}

function ensureLocalDemoUser() {
    const users = getLocalUsers();
    const hasDemo = users.some(u => (u.username || '').toLowerCase() === 'superuser');
    if (!hasDemo) {
        users.push({ id: 'local-superuser', displayName: '系統管理員(本機)', username: 'superuser', password: '0000' });
        saveLocalUsers(users);
    }
}

let tourGuardActive = false;
let tourGuardTarget = null;

function enableTourGuard(target) {
    tourGuardTarget = target;
    if (tourGuardActive) return;
    tourGuardActive = true;
    document.addEventListener('click', handleTourGuard, true);
}

function disableTourGuard() {
    if (!tourGuardActive) return;
    tourGuardActive = false;
    tourGuardTarget = null;
    document.removeEventListener('click', handleTourGuard, true);
}

function handleTourGuard(e) {
    const isTooltip = e.target.closest('.tour-tooltip');
    const isHighlight = e.target.closest('.tour-highlight');
    const isTarget = tourGuardTarget && tourGuardTarget.contains(e.target);

    if (isTooltip || isHighlight || isTarget) return;
    e.preventDefault();
    e.stopPropagation();
}
// ==========================================
// [Merged from 11246081] AI Customization & Image Generation
// ==========================================

function initCustomizationBindings() {
    const startBtn = document.getElementById('start-customization-btn');
    const skipBtn = document.getElementById('skip-customization-btn');
    const genBtn = document.getElementById('generate-image-btn');

    if (startBtn && !startBtn.dataset.bound) {
        startBtn.dataset.bound = 'true';
        startBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startCustomization();
        });
    }

    if (skipBtn && !skipBtn.dataset.bound) {
        skipBtn.dataset.bound = 'true';
        skipBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            skipCustomization();
        });
    }

    if (genBtn && !genBtn.dataset.bound) {
        genBtn.dataset.bound = 'true';
        genBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            generateImage();
        });
    }
}


// ==========================================
// AI Customization Flow
// ==========================================
let isPersonalizingAI = false;

window.startCustomization = function () {
    console.log('Starting customization flow...');
    isPersonalizingAI = true;

    clearInteractionBlockers();

    const confirmModal = document.getElementById('customize-confirm-modal');
    if (confirmModal) {
        confirmModal.style.display = 'none';
        confirmModal.style.setProperty('display', 'none', 'important');
    }

    openImageGenerationModal();

    const modalTitle = document.querySelector('#image-gen-modal .modal-title');
    if (modalTitle) modalTitle.textContent = '打造您的專屬 AI 保險員';
    const promptInput = document.getElementById('image-prompt-input');
    if (promptInput) promptInput.placeholder = '請描述您理想的保險員形象與背景... (例如：一位穿著韓系西裝的帥哥業務員，背景是高級咖啡廳)';
};

window.skipCustomization = function () {
    isPersonalizingAI = false;
    launchChat();
};

window.applyCustomization = function () {
    const imgEl = document.getElementById('generated-image');
    if (imgEl && imgEl.src) {
        // 更新 AI 保險員設定
        AGENT_CONFIG['ai'].avatar = imgEl.src;

        // 設定聊天室背景
        const chatInterface = document.getElementById('chat-interface');
        if (chatInterface) {
            chatInterface.style.backgroundImage = `url('${imgEl.src}')`;
            chatInterface.style.backgroundSize = 'cover';
            chatInterface.style.backgroundPosition = 'center';
            // 增加遮罩讓文字清楚
            chatInterface.style.position = 'relative';

            // 確保訊息區域背景半透明
            const messagesArea = document.getElementById('chat-messages');
            if (messagesArea) {
                messagesArea.style.background = 'rgba(255, 255, 255, 0.85)';
                messagesArea.style.backdropFilter = 'blur(5px)';
            }
        }
    }
    closeImageGenerationModal();
    launchChat();
};

window.retryGeneration = function () {
    // 重設按鈕狀態
    const btn = document.getElementById('generate-image-btn');
    if (btn) {
        btn.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '生成圖片';
    }

    // 隱藏客製化動作區塊
    const customActions = document.getElementById('customization-actions');
    if (customActions) customActions.style.display = 'none';

    document.getElementById('image-result-container').style.display = 'none';
    document.getElementById('image-prompt-input').focus();
};

// ==========================================
// Image Generation Feature
// ==========================================
window.openImageGenerationModal = function () {
    const modal = document.getElementById('image-gen-modal');
    if (!modal) return;

    // 強制設定 style，不依賴 CSS class 切換 (備用方案)
    modal.style.setProperty('display', 'flex', 'important');

    document.getElementById('image-prompt-input').value = '';
    document.getElementById('image-result-container').style.display = 'none';
    document.getElementById('generated-image').style.display = 'none';
    document.getElementById('image-error').style.display = 'none';

    const customActions = document.getElementById('customization-actions');
    if (customActions) customActions.style.display = 'none';

    const statusEl = document.getElementById('image-gen-status');
    if (statusEl) {
        statusEl.classList.remove('ok', 'warn');
        statusEl.textContent = '生成服務檢查中...';
    }

    checkLocalImageServices();

    // 如果不是在客製化流程中開啟 (即點擊聊天室按鈕開啟)，重置為預設狀態
    if (!isPersonalizingAI) {
        const modalTitle = document.querySelector('#image-gen-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'AI 圖片生成';
        const promptInput = document.getElementById('image-prompt-input');
        if (promptInput) promptInput.placeholder = '請描述您想生成的圖片內容...';
    }
};

async function checkLocalImageServices() {
    const statusEl = document.getElementById('image-gen-status');
    if (!statusEl) return;

    const check = async (url, timeout = 3000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            return res.ok;
        } catch (e) {
            return false;
        } finally {
            clearTimeout(timer);
        }
    };

    const a1111Ok = await check('http://127.0.0.1:7860/sdapi/v1/sd-models');
    if (a1111Ok) {
        statusEl.classList.add('ok');
        statusEl.textContent = '已連線：AUTOMATIC1111 (本機)';
        return;
    }

    const comfyOk = await check('http://127.0.0.1:8188/system_stats');
    if (comfyOk) {
        statusEl.classList.add('ok');
        statusEl.textContent = '已連線：ComfyUI (本機)';
        return;
    }

    statusEl.classList.add('warn');
    statusEl.textContent = '本機生成未啟用，將使用保底圖';
}

window.closeImageGenerationModal = function () {
    const modal = document.getElementById('image-gen-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    // 如果是從「客製化流程」中關閉視窗，視為放棄客製化，直接開始聊天
    if (isPersonalizingAI) {
        isPersonalizingAI = false;
        launchChat();
    }
};

window.generateImage = async function () {
    const promptInput = document.getElementById('image-prompt-input').value.trim();
    if (!promptInput) {
        alert('請輸入圖片描述');
        return;
    }

    const btn = document.getElementById('generate-image-btn');
    const resultContainer = document.getElementById('image-result-container');
    const loadingEl = document.getElementById('image-loading');
    const imgEl = document.getElementById('generated-image');
    const errorEl = document.getElementById('image-error');
    const customActions = document.getElementById('customization-actions');

    btn.disabled = true;
    btn.textContent = '生成中...';
    resultContainer.style.display = 'block';
    loadingEl.style.display = 'block';
    imgEl.style.display = 'none';
    errorEl.style.display = 'none';
    if (customActions) customActions.style.display = 'none';

    const setGenerateError = (message) => {
        loadingEl.style.display = 'none';
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '生成圖片';
        btn.style.display = 'block';
    };

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const fetchWithTimeout = async (url, options = {}, timeout = 20000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };

    const buildLocalFallbackImage = (text) => {
        const raw = (text || 'AI 保險員形象').trim();
        const safeText = raw.replace(/[<>&"']/g, '').slice(0, 28);
        const lower = raw.toLowerCase();

        const isCat = /貓|cat/.test(lower);
        const isDog = /狗|dog/.test(lower);
        const isCafe = /咖啡|cafe|coffee/.test(lower);
        const isOffice = /辦公|office|商務|西裝/.test(lower);
        const isWarm = /暖|夕陽|sunset|golden/.test(lower);
        const bg1 = isWarm ? '#fde68a' : (isCafe ? '#f5d0a9' : '#bfdbfe');
        const bg2 = isWarm ? '#fb7185' : (isCafe ? '#fdba74' : '#93c5fd');
        const sceneLabel = isCafe ? '咖啡廳場景' : (isOffice ? '專業辦公場景' : '個人化場景');
        const avatar = isCat ? '🐱' : (isDog ? '🐶' : '🧑‍💼');

        const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
    <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${bg1}"/>
            <stop offset="100%" stop-color="${bg2}"/>
        </linearGradient>
    </defs>
    <rect width="1024" height="768" fill="url(#g)"/>
    <rect x="56" y="56" width="912" height="656" rx="28" fill="rgba(255,255,255,0.86)"/>
    <rect x="96" y="110" width="832" height="320" rx="22" fill="#ffffff" stroke="#dbeafe"/>
    <text x="512" y="210" text-anchor="middle" font-size="120">${avatar}</text>
    <text x="512" y="280" text-anchor="middle" font-size="44" font-family="Inter, Arial, sans-serif" fill="#0f172a" font-weight="700">AI 保險員形象</text>
    <text x="512" y="330" text-anchor="middle" font-size="30" font-family="Inter, Arial, sans-serif" fill="#334155">${sceneLabel}</text>
    <rect x="180" y="480" width="664" height="140" rx="18" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="512" y="548" text-anchor="middle" font-size="34" font-family="Inter, Arial, sans-serif" fill="#1f2937">${safeText}</text>
    <text x="512" y="596" text-anchor="middle" font-size="22" font-family="Inter, Arial, sans-serif" fill="#64748b">示意圖（免費模式）</text>
</svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    };

    const tryGenerateWithA1111 = async (promptText) => {
        const endpoint = 'http://127.0.0.1:7860/sdapi/v1/txt2img';
        const payload = {
            prompt: promptText,
            negative_prompt: 'low quality, blurry, distorted, extra fingers, bad anatomy',
            width: 768,
            height: 768,
            steps: 24,
            cfg_scale: 7,
            sampler_name: 'Euler a',
            batch_size: 1
        };

        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 45000);

        if (!response.ok) throw new Error(`A1111 HTTP ${response.status}`);
        const data = await response.json();
        const base64 = data?.images?.[0];
        if (!base64) throw new Error('A1111 no image');
        return `data:image/png;base64,${base64}`;
    };

    const tryGenerateWithComfyUI = async (promptText) => {
        const comfyBase = 'http://127.0.0.1:8188';

        let ckptName = localStorage.getItem('comfy_ckpt_name') || '';
        if (!ckptName) {
            try {
                const infoRes = await fetchWithTimeout(`${comfyBase}/object_info/CheckpointLoaderSimple`, {}, 8000);
                if (infoRes.ok) {
                    const info = await infoRes.json();
                    ckptName = info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]?.[0] || '';
                    if (ckptName) localStorage.setItem('comfy_ckpt_name', ckptName);
                }
            } catch (e) {
                ckptName = '';
            }
        }
        if (!ckptName) throw new Error('ComfyUI checkpoint not found');

        const workflow = {
            '3': {
                class_type: 'KSampler',
                inputs: {
                    seed: Math.floor(Math.random() * 1000000000),
                    steps: 24,
                    cfg: 7,
                    sampler_name: 'euler',
                    scheduler: 'normal',
                    denoise: 1,
                    model: ['4', 0],
                    positive: ['6', 0],
                    negative: ['7', 0],
                    latent_image: ['5', 0]
                }
            },
            '4': {
                class_type: 'CheckpointLoaderSimple',
                inputs: { ckpt_name: ckptName }
            },
            '5': {
                class_type: 'EmptyLatentImage',
                inputs: { width: 768, height: 768, batch_size: 1 }
            },
            '6': {
                class_type: 'CLIPTextEncode',
                inputs: { text: promptText, clip: ['4', 1] }
            },
            '7': {
                class_type: 'CLIPTextEncode',
                inputs: { text: 'low quality, blurry, deformed, bad anatomy', clip: ['4', 1] }
            },
            '8': {
                class_type: 'VAEDecode',
                inputs: { samples: ['3', 0], vae: ['4', 2] }
            },
            '9': {
                class_type: 'SaveImage',
                inputs: { filename_prefix: 'iafm', images: ['8', 0] }
            }
        };

        const promptRes = await fetchWithTimeout(`${comfyBase}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        }, 12000);
        if (!promptRes.ok) throw new Error(`ComfyUI prompt HTTP ${promptRes.status}`);

        const promptData = await promptRes.json();
        const promptId = promptData?.prompt_id;
        if (!promptId) throw new Error('ComfyUI prompt_id missing');

        for (let i = 0; i < 50; i++) {
            await wait(1000);
            const historyRes = await fetchWithTimeout(`${comfyBase}/history/${promptId}`, {}, 10000);
            if (!historyRes.ok) continue;
            const history = await historyRes.json();
            const outputs = history?.[promptId]?.outputs || {};
            const outputNode = outputs['9'] || Object.values(outputs)[0];
            const imageMeta = outputNode?.images?.[0];
            if (!imageMeta?.filename) continue;

            const params = new URLSearchParams({
                filename: imageMeta.filename,
                subfolder: imageMeta.subfolder || '',
                type: imageMeta.type || 'output'
            });
            return `${comfyBase}/view?${params.toString()}`;
        }

        throw new Error('ComfyUI generation timeout');
    };

    try {
        // 1. 先呼叫 Gemini 將中文描述轉換為高品質的英文繪圖 Prompt
        const enhancementPrompt = `你是一個專業的 AI 繪圖提示詞 (Prompt) 生成器。請將使用者的描述「${promptInput}」改寫為一段詳細的英文 Prompt，適用於 Stable Diffusion 或類似的 AI 繪圖模型。
        
        請包含以下要素：
        - 主體細節 (Subject details)
        - 藝術風格 (Art style, e.g., cinematic lighting, photorealistic, 8k, highly detailed)
        - 氛圍 (Mood/Atmosphere)
        - 構圖 (Composition)
        
        請直接回傳英文 Prompt 即可，不要有任何解釋或其他文字。`;

        let enhancedPrompt = "";
        try {
            enhancedPrompt = await callGeminiAPI(enhancementPrompt);
            console.log("Gemini Enhanced Prompt:", enhancedPrompt);
        } catch (e) {
            console.warn("Gemini prompt enhancement failed, using original input.", e);
            enhancedPrompt = promptInput + " insurance concept, high quality, professional, photorealistic, cinematic lighting";
        }

        if (!enhancedPrompt || enhancedPrompt.includes("抱歉")) {
            enhancedPrompt = promptInput + " insurance concept, high quality, professional, photorealistic, cinematic lighting";
        }

        // 2. 先嘗試本機 Stable Diffusion (免付費 API)
        let finalImageUrl = '';
        try {
            loadingEl.textContent = '圖片生成中（本機 A1111）...';
            finalImageUrl = await tryGenerateWithA1111(enhancedPrompt);
        } catch (e1) {
            try {
                loadingEl.textContent = '圖片生成中（本機 ComfyUI）...';
                finalImageUrl = await tryGenerateWithComfyUI(enhancedPrompt);
            } catch (e2) {
                loadingEl.textContent = '本機模型未啟用，改用保底圖...';
                await wait(120);
                finalImageUrl = buildLocalFallbackImage(enhancedPrompt || promptInput);
            }
        }

        imgEl.src = finalImageUrl;
        imgEl.style.width = '100%';
        imgEl.style.maxHeight = '340px';
        imgEl.style.objectFit = 'contain';

        loadingEl.style.display = 'none';
        imgEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '生成圖片';

        if (isPersonalizingAI && customActions) {
            customActions.style.display = 'flex';
            btn.style.display = 'none';
        }

    } catch (error) {
        console.error("Image Generation Error:", error);
        setGenerateError('圖片生成失敗，請稍後再試。');
    }
};

