/**
 * auth.js — 共用認證與資料同步模組
 * ============================================================
 * 【新手導讀】
 * 這個檔案是整個網站的「大腦」，所有頁面都會引用它（<script src="auth.js">）。
 * 它負責三件核心事情：
 *   1. 帳號管理：註冊、登入、登出
 *   2. 資料存取：讀寫每個使用者的 coins、VIP、簽到紀錄等
 *   3. 統一 Header：在每一頁的上方注入一致的資訊列（coins、頭像、方案）
 *
 * 【為什麼用 localStorage？】
 * localStorage 是瀏覽器內建的儲存空間（像一個小型資料庫），
 * 資料以「key-value」形式存放，關閉瀏覽器後資料還在。
 * 這讓 Demo 不需要後端伺服器就能運作。
 * 未來上線時會改用真正的後端 API + 資料庫。
 *
 * 共用 localStorage key：
 *   - localUsers                : 使用者清單（陣列）
 *   - authUser                  : 當前登入使用者（JSON 物件）
 *   - userAuthed                : 是否已認證 ('true' 字串)
 *   - user_data_<userId>        : 每位使用者的個別資料（coins, VIP 等）
 *   - coin_history_<userId>     : 每位使用者的交易紀錄（陣列）
 *   - avatar_<userId>           : 使用者頭像 (base64 字串)
 *
 * 全域 API（其他頁面可直接呼叫的函式）：
 *   getUserData() / saveUserData(data)    → 讀/寫使用者資料
 *   getHistory() / addHistory(...)        → 讀/寫交易紀錄
 *   isLoggedIn() / getAuthenticatedUser() → 檢查登入狀態
 *   getAiDailyLimit(data) / ensureDailyReset() → AI 額度管理
 *   updateHeaderInfo()                    → 各頁可呼叫以刷新 header
 *   getAvatar() / saveAvatar(base64)      → 頭像讀/寫
 *   updateDisplayName(newName)            → 修改顯示名稱
 */

// ===== Local User Store =====
// 【區塊說明】管理「有哪些帳號」的增刪查改
// 所有帳號存在 localStorage 的 'localUsers' key 裡，格式是 JSON 陣列

// 取得所有已註冊的本機使用者
// JSON.parse() 把 JSON 字串轉成 JS 物件/陣列
// try-catch 防止 JSON 格式壞掉導致整頁當掉
// || '[]' 是「如果 localStorage 裡沒有這個 key，就當作空陣列」
function getLocalUsers() {
    try { return JSON.parse(localStorage.getItem('localUsers') || '[]'); } catch { return []; }
}

// 把使用者陣列存回 localStorage
// JSON.stringify() 把 JS 物件/陣列轉成 JSON 字串（localStorage 只能存字串）
function saveLocalUsers(users) { localStorage.setItem('localUsers', JSON.stringify(users)); }

// 用帳號名稱（email）查找使用者
// .find() 會遍歷陣列，找到第一個符合條件的元素
// .toLowerCase() 讓比對不分大小寫（例如 Admin 和 admin 視為同一人）
// || null 代表「找不到就回傳 null」
function findUserByUsername(username) {
    if (!username) return null; // 沒輸入帳號就直接回傳 null
    return getLocalUsers().find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

// 註冊新使用者
// 產生唯一 ID：用「時間戳 + 亂數」確保每次都不同
// Date.now() 回傳現在的毫秒數（例如 1707849600000）
// Math.random() 產生 0~1 之間的亂數，乘以 9000 再加 1000 → 得到 1000~9999 的四位數
function registerLocalUser(displayName, username, password) {
    const users = getLocalUsers();                          // 先取得現有的使用者陣列
    const id = 'local-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000); // 產生唯一 ID
    const user = {
        id, displayName, username, password,
        role: 'user',                                       // 預設角色
        createdAt: new Date().toISOString(),                 // 建立時間
        lastLoginAt: ''                                      // 尚未登入過
    };
    users.push(user);                                       // 加到陣列最後面
    saveLocalUsers(users);                                  // 存回 localStorage
    return user;                                            // 回傳新使用者（給後續登入用）
}

// 登入驗證：用帳號找到使用者後，比對密碼
// 回傳 user 物件（成功）或 null（失敗）
function loginLocalUser(username, password) {
    const user = findUserByUsername(username); // 先找帳號
    if (!user) return null;                   // 帳號不存在 → 失敗
    if (user.password !== password) return null; // 密碼錯誤 → 失敗

    // 登入成功 → 更新 lastLoginAt
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
        users[idx].lastLoginAt = new Date().toISOString();
        saveLocalUsers(users);
    }
    return user;
}

// ===== Demo 帳號 & 資料遷移 =====
// 確保四個 Demo 帳號存在：superuser / sponsorA / agentA / admin
// 同時對舊帳號做 migration（補 role / createdAt / lastLoginAt）
function ensureDemoAccounts() {
    const users = getLocalUsers();
    const now = new Date().toISOString();

    // Demo 帳號定義
    // role 可用值：'user' | 'sponsor' | 'agent' | 'admin'
    const demos = [
        { id: 'local-superuser', displayName: '系統管理員(本機)', username: 'superuser', password: '0000', role: 'user' },
        { id: 'local-sponsorA', displayName: 'A 贊助商', username: 'sponsorA', password: '1111', role: 'sponsor' },
        { id: 'local-agentA', displayName: 'A 保險員', username: 'agentA', password: '2222', role: 'agent' },
        { id: 'local-admin', displayName: '系統管理員', username: 'admin', password: '9999', role: 'admin' }
    ];

    let changed = false;
    demos.forEach(demo => {
        const exists = users.some(u => (u.username || '').toLowerCase() === demo.username.toLowerCase());
        if (!exists) {
            users.push({
                ...demo,
                createdAt: now,
                lastLoginAt: ''
            });
            changed = true;
        }
    });

    // 資料遷移：舊帳號補 role / createdAt / lastLoginAt / referral_code
    users.forEach(u => {
        if (!u.role) { u.role = 'user'; changed = true; }
        if (!u.createdAt) { u.createdAt = now; changed = true; }
        if (u.lastLoginAt === undefined) { u.lastLoginAt = ''; changed = true; }
        // 推薦碼遷移：確保每個帳號都有固定推薦碼
        if (!u.referral_code) {
            u.referral_code = _generateReferralCode(u);
            changed = true;
        }
    });

    if (changed) saveLocalUsers(users);

    // sponsorA 自動建立 sponsor profile + wallet
    _ensureSponsorAProfile();
}

// sponsorA demo 的 sponsor 資料初始化
function _ensureSponsorAProfile() {
    try {
        const sp = JSON.parse(localStorage.getItem('sponsor_profiles') || '{}');
        if (!sp['local-sponsorA']) {
            sp['local-sponsorA'] = {
                user_id: 'local-sponsorA',
                company_name: 'A 贊助商',
                verified: true,
                frozen: false,
                created_at: new Date().toISOString()
            };
            localStorage.setItem('sponsor_profiles', JSON.stringify(sp));
        }
        const sw = JSON.parse(localStorage.getItem('sponsor_wallets') || '{}');
        if (!sw['local-sponsorA']) {
            sw['local-sponsorA'] = { balance: 0, total_deposited: 0, total_spent: 0 };
            localStorage.setItem('sponsor_wallets', JSON.stringify(sw));
        }
    } catch (e) { /* ignore */ }
}

// ===== 角色查詢 & 權限檢查 =====
// 從 localUsers 查詢指定 userId 的 role
function getUserRole(userId) {
    // local-admin 永遠保持 admin 角色，防止測試時被意外覆寫
    if (userId === 'local-admin') return 'admin';
    const users = getLocalUsers();
    const u = users.find(x => x.id === userId);
    return (u && u.role) || 'user';
}

// 取得目前登入者的 role
function getCurrentUserRole() {
    const auth = getAuthenticatedUser();
    if (!auth) return 'user';
    return getUserRole(auth.id);
}

// 權限閘道：若目前 user 的 role 不在 allowedRoles 中 → 顯示模糊遮罩卡片
// 用法：requireRole('admin') 或 requireRole('sponsor', 'admin')
function requireRole(...allowedRoles) {
    const role = getCurrentUserRole();
    if (allowedRoles.includes(role)) return true;

    // 若根本沒登入，讓 initAuthGate 顯示登入畫面，不顯示「權限不足」
    if (!isLoggedIn()) return false;

    // 若是贊助商或保險員進入無權限的後台頁面，自動導向服務入口頁
    if (role === 'sponsor' || role === 'agent') {
        if (window.navigateWithPageTransition && window.navigateWithPageTransition('portal.html')) {
            return false;
        }
        window.location.href = 'portal.html';
        return false;
    }

    // 注入樣式（只注入一次）
    if (!document.getElementById('_auth-modal-style')) {
        const style = document.createElement('style');
        style.id = '_auth-modal-style';
        style.textContent = `
#_auth-deny-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: _authFadeIn 0.3s ease;
}
@keyframes _authFadeIn {
    from { opacity:0; }
    to   { opacity:1; }
}
#_auth-deny-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 20px;
    padding: 2.2rem 2rem;
    max-width: 380px;
    width: 90%;
    text-align: center;
    box-shadow: 0 24px 60px rgba(0,0,0,0.6);
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: _authSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes _authSlideUp {
    from { transform: translateY(40px) scale(0.93); opacity:0; }
    to   { transform: translateY(0)    scale(1);    opacity:1; }
}
#_auth-deny-card .adm-icon {
    font-size: 2.8rem;
    margin-bottom: 0.6rem;
}
#_auth-deny-card .adm-title {
    font-size: 1.1rem;
    font-weight: 800;
    margin-bottom: 0.4rem;
}
#_auth-deny-card .adm-desc {
    font-size: 0.82rem;
    color: #848d97;
    margin-bottom: 1.6rem;
    line-height: 1.6;
}
#_auth-deny-card .adm-role-tag {
    display: inline-block;
    background: rgba(248,81,73,0.12);
    color: #f85149;
    border: 1px solid rgba(248,81,73,0.25);
    border-radius: 6px;
    padding: 2px 10px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 1.4rem;
}
#_auth-deny-card .adm-btns {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}
#_auth-deny-card .adm-btn {
    padding: 0.7rem 1.2rem;
    border-radius: 12px;
    border: none;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
}
#_auth-deny-card .adm-btn.primary {
    background: linear-gradient(135deg, #9CC98D, #7BB369);
    color: #000;
}
#_auth-deny-card .adm-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(156,201,141,0.3);
}
#_auth-deny-card .adm-btn.secondary {
    background: rgba(255,255,255,0.06);
    color: #848d97;
    border: 1px solid #30363d;
}
#_auth-deny-card .adm-btn.secondary:hover {
    background: rgba(255,255,255,0.11);
    color: #e6edf3;
}
`;
        document.head.appendChild(style);
    }

    // 建立遮罩卡片
    const backdrop = document.createElement('div');
    backdrop.id = '_auth-deny-backdrop';
    backdrop.innerHTML = `
        <div id="_auth-deny-card">
            <div class="adm-icon">🔒</div>
            <div class="adm-title">權限不足</div>
            <div class="adm-role-tag">需要角色：${allowedRoles.join(' / ')}</div>
            <div class="adm-desc">您目前的帳號無法存取此頁面。<br>請回到主頁或切換至有權限的帳號。</div>
            <div class="adm-btns">
                <button class="adm-btn primary" id="_adm-home-btn">🏠 回主頁</button>
                <button class="adm-btn secondary" id="_adm-switch-btn">🔄 切換帳號</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    document.getElementById('_adm-home-btn').addEventListener('click', () => {
        if (window.navigateWithPageTransition && window.navigateWithPageTransition('subscription.html')) {
            return;
        }
        window.location.href = 'subscription.html';
    });
    document.getElementById('_adm-switch-btn').addEventListener('click', () => {
        localStorage.removeItem('authUser');
        localStorage.removeItem('userAuthed');
        window.location.reload();
    });

    return false;
}

// ===== Auth State =====
// 【區塊說明】管理「目前是誰在使用」的登入狀態
// authUser 存放當前登入者的資訊，userAuthed 是一個簡單的旗標

// 取得目前登入的使用者資訊
// 回傳物件 { id, displayName, username } 或 null（未登入）
function getAuthenticatedUser() {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
}

// 設定目前登入的使用者（登入成功後呼叫）
// 只存必要的欄位（不存密碼，避免安全問題）
// 同時設定 'userAuthed' = 'true' 作為快速判斷旗標
function setAuthenticatedUser(user) {
    if (!user) return; // 防呆：如果傳入 null/undefined 就不做事
    localStorage.setItem('authUser', JSON.stringify({
        id: user.id,              // 使用者唯一識別碼
        displayName: user.displayName, // 顯示名稱（暱稱）
        username: user.username   // 帳號（email）
    }));
    localStorage.setItem('userAuthed', 'true'); // 設定「已認證」旗標
}

// 檢查是否已登入
// 同時確認兩個條件：旗標為 'true' 且 authUser 解析成功
// 用 && 連接代表「兩個都要成立」
function isLoggedIn() {
    return localStorage.getItem('userAuthed') === 'true' && getAuthenticatedUser() !== null;
}

// 登出：清除登入資訊，重新整理頁面
// removeItem() 會從 localStorage 刪除指定的 key
// reload() 重新載入頁面 → 觸發 initAuthGate() → 顯示登入畫面
function logoutUser() {
    localStorage.removeItem('authUser');
    localStorage.removeItem('userAuthed');
    window.location.reload();
}

// ===== User-keyed Data Storage =====
// 【區塊說明】每位使用者都有自己的 localStorage key（例如 user_data_local-12345）
// 這樣不同帳號的 coins、VIP 等資料不會互相覆蓋
// 這種設計叫做「user-keyed storage」（以使用者 ID 當作 key 的一部分）

// 預設使用者資料：新帳號剛建立時會用這組值
// 用 const 宣告表示這個物件不會被重新賦值（但裡面的值可以被複製出去修改）
const _DEFAULT_USER_DATA = {
    is_vip: false,        // 是否為付費會員
    vip_level: 'free',    // 方案等級：'free' / 'basic' / 'pro'
    coins: 120,           // 平台幣餘額（新帳號送 120）
    daily_ai_used: 0,     // 今天已使用的 AI 諮詢次數
    last_checkin: "",      // 上次簽到日期（格式 "2026-02-14"）
    streak: 0,            // 連續簽到天數
    bonus_ai_quota: 0,    // 額外購買的 AI 次數（用幣買的）
    last_ai_date: "",     // 上次使用 AI 的日期（用來判斷是否要重置每日額度）
    // ===== Ad Manager 欄位 =====
    is_sponsor: false,              // 是否為贊助商
    rewarded_today_count: 0,        // 今日 rewarded 廣告觀看次數（每日上限 3）
    rewarded_today_date: ""         // 記錄日期，跨日自動歸零
};

// 產生這位使用者的 localStorage key
// 底線開頭 _ 表示這是「私有函式」，只在這個檔案內部使用
// 如果使用者沒登入，就用通用的 'user_data'（不加 ID）
function _getUserDataKey() {
    const user = getAuthenticatedUser();
    if (!user || !user.id) return 'user_data';  // 未登入 → 用通用 key
    return 'user_data_' + user.id;               // 已登入 → 加上 user ID
}

// 產生交易紀錄的 localStorage key（原理同上）
function _getHistoryKey() {
    const user = getAuthenticatedUser();
    if (!user || !user.id) return 'coin_history';
    return 'coin_history_' + user.id;
}

// 讀取使用者資料
// 【重要技巧】展開運算子 ...
//   { ..._DEFAULT_USER_DATA, ...JSON.parse(raw) }
//   意思是：先複製預設值，再用存儲的值覆蓋 → 確保新增欄位也有預設值
//   例如：未來如果新增 'referral_count' 欄位，舊帳號也不會缺少這個值
function getUserData() {
    const key = _getUserDataKey();
    const raw = localStorage.getItem(key);  // 從 localStorage 讀取原始 JSON 字串
    if (!raw) {
        // 第一次讀取（還沒有資料）→ 寫入預設值
        localStorage.setItem(key, JSON.stringify(_DEFAULT_USER_DATA));
        return { ..._DEFAULT_USER_DATA }; // 回傳預設值的副本（不是原始物件，避免被意外修改）
    }
    try {
        return { ..._DEFAULT_USER_DATA, ...JSON.parse(raw) }; // 合併：預設值 + 已存值
    } catch {
        // JSON 解析失敗（資料損壞）→ 重設為預設值
        localStorage.setItem(key, JSON.stringify(_DEFAULT_USER_DATA));
        return { ..._DEFAULT_USER_DATA };
    }
}

// 儲存使用者資料 — 整個物件覆蓋寫入
// 呼叫方式：修改 data 物件後，呼叫 saveUserData(data)
function saveUserData(data) {
    const key = _getUserDataKey();
    localStorage.setItem(key, JSON.stringify(data));
}

// 讀取交易紀錄（陣列格式）
function getHistory() {
    const key = _getHistoryKey();
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

// 新增一筆交易紀錄
// unshift() 把新紀錄加到陣列「最前面」（最新的在最上面）
// list.length = 50 是一個技巧：截斷陣列，只保留前 50 筆（避免無限增長）
function addHistory(type, label, amount) {
    const key = _getHistoryKey();
    const list = getHistory();
    list.unshift({
        type: type,     // 類型：'earn'（獲得）或 'spend'（消費）
        label: label,   // 說明文字：例如 '每日簽到獎勵'
        amount: amount, // 金額：正數（獲得）或負數（消費）
        time: new Date().toLocaleString('zh-TW') // 時間：用台灣格式顯示
    });
    if (list.length > 50) list.length = 50; // 只保留最近 50 筆
    localStorage.setItem(key, JSON.stringify(list));
}

// ===== Avatar =====
// 【區塊說明】頭像使用 base64 編碼存在 localStorage
// base64 是把圖片二進位資料轉成純文字的方式，可以直接當作 <img src="..."> 使用
// 缺點：圖片太大會佔很多空間，所以上傳時會先壓縮到 200x200

// 取得頭像（回傳 base64 字串，沒有則回傳空字串）
function getAvatar() {
    const user = getAuthenticatedUser();
    if (!user) return '';
    return localStorage.getItem('avatar_' + user.id) || '';
}

// 儲存頭像
function saveAvatar(base64) {
    const user = getAuthenticatedUser();
    if (!user) return;
    localStorage.setItem('avatar_' + user.id, base64);
}

// ===== Display Name =====
// 【區塊說明】修改暱稱需要更新三個地方：
//   1. localUsers 陣列（帳號清單）
//   2. authUser（當前登入者）
//   3. Header UI（頁面上顯示的名稱）

function updateDisplayName(newName) {
    if (!newName || !newName.trim()) return; // .trim() 去掉前後空白，防止只輸入空格
    const user = getAuthenticatedUser();
    if (!user) return;

    // 第一步：更新 localUsers 帳號清單中的名稱
    const users = getLocalUsers();
    const idx = users.findIndex(u => u.id === user.id); // findIndex 找到該使用者在陣列中的位置
    if (idx >= 0) {
        users[idx].displayName = newName.trim();
        saveLocalUsers(users);
    }

    // 第二步：更新 authUser（當前登入者資訊）
    user.displayName = newName.trim();
    localStorage.setItem('authUser', JSON.stringify(user));

    // 第三步：立刻更新頁面上 header 顯示的名稱
    updateHeaderInfo();
}

// ===== Daily Reset & AI Quota =====
// 【區塊說明】AI 諮詢有每日使用上限，不同會員等級額度不同
// 每天第一次使用時，自動重置使用次數為 0

// 根據 VIP 等級回傳每日 AI 使用上限
// free = 15 次、basic = 150 次、pro = 1500 次
function getAiDailyLimit(data) {
    const level = (data && data.vip_level) || 'free'; // 如果沒有 vip_level，預設為 'free'
    if (level === 'pro') return 1500;   // Pro 會員 → 1500 次
    if (level === 'basic') return 150;  // Basic 會員 → 150 次
    return 15;                          // 免費會員 → 15 次
}

// 每日重置：如果今天日期和 last_ai_date 不同，就重置使用次數
// 【為什麼自己算日期？】因為沒有後端伺服器，無法用 cron job 定時重置
// 所以每次頁面載入時自己檢查，如果日期變了就重置
function ensureDailyReset() {
    if (!isLoggedIn()) return; // 沒登入就不用做
    const data = getUserData();
    const today = new Date();
    // 手動拼出 "YYYY-MM-DD" 格式（padStart 確保月/日是兩位數）
    const todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    if (data.last_ai_date !== todayStr) {
        // 日期不同 → 新的一天 → 重置 AI 使用次數和額外額度
        data.daily_ai_used = 0;
        data.bonus_ai_quota = 0;
        data.last_ai_date = todayStr;
        saveUserData(data);
    }
}

// ===== Auth Gate UI =====
// 【區塊說明】頁面載入時的第一道關卡
// 這個函式在每一頁的 DOMContentLoaded 事件觸發時自動執行（見檔案最後一行）
// 它決定：已登入 → 注入 header 資訊 / 未登入 → 顯示登入畫面
function isInPolicySearchFolder() {
    const rawPath = window.location.pathname.replace(/\\/g, '/');
    let decodedPath = rawPath;
    try {
        decodedPath = decodeURIComponent(rawPath);
    } catch (e) {
        decodedPath = rawPath;
    }
    return decodedPath.includes('/保單搜尋/') || rawPath.includes('/%E4%BF%9D%E5%96%AE%E6%90%9C%E5%B0%8B/');
}

function initAuthGate() {
    ensureDemoAccounts(); // 先確保 Demo 帳號存在 + 舊資料 migration

    if (isLoggedIn()) {
        // 已登入：重置 AI 每日額度 → 注入統一 header
        ensureDailyReset();
        injectHeaderInfo();
        return; // return 提前結束，不會執行下面的 showAuthLock()
    }

    // [整合版修改] 主頁面（前台介紹頁）允許訪客瀏覽，不強制登入鎖
    // 這些頁面有自己的 guest-mode / auth-entry 按鈕流程
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const mainPages = ['index.html', 'consulting.html', 'dm.html', 'budget.html', 'policy.html', 'community.html', 'policy_tab.html',
        'insurance_register.html', 'agent_profile.html', 'agent_chat_dashboard.html', 'user_match.html', 'user_group.html'];
    if (mainPages.includes(currentPage)) {
        console.log('[auth] 主頁面訪客模式，跳過登入鎖');
        return; // 不顯示 auth lock，讓使用者自由瀏覽
    }

    // 未登入且在商業化頁面：顯示全螢幕的登入/註冊表單
    showAuthLock();
}

// ===== Unified Header Info Bar =====
// 【區塊說明】在每一頁的 <header> 裡注入統一的資訊列
// 包含：🪙 coin pill → 💳 plan badge → 👤 頭像+暱稱 → 登出按鈕
// 這樣不用在每個 HTML 裡重複寫同樣的 header 程式碼

// 注入 header 專用的 CSS 樣式（只執行一次）
// 【技巧】用 JS 動態建立 <style> 標籤，好處是不用修改每個 HTML 的 CSS
function _injectHeaderStyles() {
    if (document.getElementById('auth-header-styles')) return; // 已注入就跳過（防止重複）
    const style = document.createElement('style'); // 建立 <style> 元素
    style.id = 'auth-header-styles'; // 給一個 ID，方便後續檢查是否已存在
    style.textContent = `
        .auth-info-bar {
            display: flex;
            align-items: center;
            gap: 0.32rem;
            margin-left: auto;
            flex-shrink: 0;
            min-width: 0;
            white-space: nowrap;
            padding: 0.14rem 0.18rem 0.14rem 0.22rem;
            position: relative;
            overflow: hidden;
            isolation: isolate;
            border-radius: 999px;
            background:
                linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.46)),
                radial-gradient(circle at 14% 14%, rgba(255,255,255,0.54), transparent 48%);
            border: 1px solid rgba(255,255,255,0.58);
            box-shadow:
                0 14px 34px rgba(15,23,42,0.12),
                inset 0 1px 0 rgba(255,255,255,0.62),
                inset 0 -1px 0 rgba(148,163,184,0.18);
            backdrop-filter: saturate(185%) blur(18px);
            -webkit-backdrop-filter: saturate(185%) blur(18px);
        }
        .auth-info-bar::before {
            content: "";
            position: absolute;
            inset: 1px;
            border-radius: inherit;
            background:
                linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.04) 62%, rgba(148,163,184,0.08)),
                radial-gradient(circle at top left, rgba(255,255,255,0.34), transparent 42%);
            pointer-events: none;
            z-index: -1;
        }
        .auth-pill-group {
            display: inline-flex;
            align-items: center;
            gap: 0.28rem;
        }
        .auth-coin-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.2rem;
            min-height: 28px;
            background: rgba(255, 200, 46, 0.18);
            padding: 0.08rem 0.52rem;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 700;
            color: #b7791f;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.3);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
            transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
            text-decoration: none;
        }
        .auth-coin-pill:hover {
            background: rgba(255, 200, 46, 0.28);
            transform: translateY(-1px);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.34), 0 8px 18px rgba(183,121,31,0.12);
        }
        .auth-plan-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 28px;
            gap: 0.18rem;
            padding: 0.08rem 0.56rem;
            border-radius: 999px;
            font-size: 0.71rem;
            font-weight: 700;
            text-decoration: none;
            border: 1px solid rgba(255,255,255,0.28);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.28);
            transition: background 0.2s, color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .auth-plan-pill.free {
            background: rgba(148,163,184,0.14);
            color: #64748b;
        }
        .auth-plan-pill.free:hover { background: rgba(148,163,184,0.22); }
        .auth-plan-pill.basic {
            background: linear-gradient(135deg, rgba(255, 231, 166, 0.92), rgba(255, 245, 205, 0.98));
            color: #b7791f;
        }
        .auth-plan-pill.basic:hover { transform: translateY(-1px); }
        .auth-plan-pill.pro {
            background: linear-gradient(135deg, rgba(92, 72, 255, 0.16), rgba(205, 154, 255, 0.22));
            color: #7c3aed;
        }
        .auth-plan-pill.pro:hover { transform: translateY(-1px); }
        .auth-user-chip,
        .auth-avatar-link {
            display: flex;
            align-items: center;
            gap: 0.36rem;
            text-decoration: none;
            cursor: pointer;
            min-height: 30px;
            padding: 0.08rem 0.34rem 0.08rem 0.12rem;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,255,255,0.56));
            border: 1px solid rgba(255,255,255,0.36);
            color: #1f2937;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.34);
            transition: opacity 0.2s, transform 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .auth-user-chip:hover,
        .auth-avatar-link:hover {
            opacity: 1;
            transform: translateY(-1px);
            background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.68));
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.38), 0 10px 20px rgba(15,23,42,0.1);
        }
        .auth-user-meta {
            display: flex;
            align-items: flex-start;
            justify-content: center;
            flex-direction: column;
            gap: 0.06rem;
            min-width: 0;
        }
        .auth-avatar-circle {
            width: 24px; height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.72rem;
            overflow: hidden;
            background: linear-gradient(135deg, #3b82f6, #7c3aed);
            border: 2px solid rgba(255,255,255,0.8);
            transition: border-color 0.3s;
            flex-shrink: 0;
        }
        .auth-avatar-circle.vip-basic { border-color: #FFD700; }
        .auth-avatar-circle.vip-pro { border-color: #f093fb; box-shadow: 0 0 8px rgba(240,147,251,0.3); }
        .auth-avatar-circle img {
            width: 100%; height: 100%; object-fit: cover;
        }
        .auth-username {
            color: #374151;
            font-size: 0.7rem;
            font-weight: 700;
            max-width: 72px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .auth-logout-btn {
            background: linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.52));
            border: 1px solid rgba(255,255,255,0.3);
            color: #6b7280;
            min-height: 28px;
            padding: 0.08rem 0.52rem;
            border-radius: 999px;
            font-size: 0.66rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.32);
            transition: all 0.2s;
        }
        .auth-logout-btn:hover {
            border-color: rgba(239,68,68,0.22);
            color: #dc2626;
            background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.68));
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 20px rgba(239,68,68,0.08);
        }
        .auth-role-badge {
            display: inline-flex;
            align-items: center;
            padding: 0.08rem 0.34rem;
            border-radius: 999px;
            font-size: 0.56rem;
            font-weight: 700;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .auth-role-badge.role-user {
            background: rgba(156,201,141,0.15);
            color: #9CC98D;
        }
        .auth-role-badge.role-sponsor {
            background: rgba(240,192,64,0.12);
            color: #f0c040;
        }
        .auth-role-badge.role-agent {
            background: rgba(188,140,255,0.15);
            color: #bc8cff;
        }
        .auth-role-badge.role-admin {
            background: rgba(248,81,73,0.15);
            color: #f85149;
        }
        .auth-info-bar .help-trigger {
            width: 28px;
            height: 28px;
            margin-right: 0;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,255,255,0.5));
            border: 1px solid rgba(255,255,255,0.3);
            color: #475569;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
            flex-shrink: 0;
            font-size: 0.88rem;
        }
        .auth-info-bar .help-trigger:hover {
            background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,255,255,0.66));
            border-color: rgba(59,130,246,0.22);
            color: #1d4ed8;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 20px rgba(29,78,216,0.08);
        }
    `;
    document.head.appendChild(style);
}

// 注入 Header 資訊列到頁面中
// 【流程】取得使用者 → 找到 <header> → 建立 DOM → 插入到 header 最後
// 這個函式在 initAuthGate() 中登入成功後被呼叫
function injectHeaderInfo() {
    const user = getAuthenticatedUser();
    if (!user) return; // 沒登入就不注入

    const header = document.querySelector('header'); // 找到頁面上的 <header> 元素
    if (!header) return; // 頁面沒有 <header> 就跳過
    if (document.getElementById('auth-info-bar')) return; // 已注入就跳過（防止重複）

    _injectHeaderStyles(); // 先注入 CSS

    const data = getUserData();
    const avatar = getAvatar();
    const level = data.vip_level || 'free';
    const inSubFolder = isInPolicySearchFolder();
    const rootPrefix = inSubFolder ? '../' : '';

    const bar = document.createElement('div');
    bar.id = 'auth-info-bar';
    bar.className = 'auth-info-bar';

    const levelNames = { free: 'Free', basic: '⭐ Basic', pro: '👑 Pro' };
    const levelIcons = { free: '', basic: '⭐', pro: '👑' };
    const avatarClass = level === 'pro' ? 'vip-pro' : level === 'basic' ? 'vip-basic' : '';
    const avatarContent = avatar
        ? `<img src="${avatar}" alt="avatar">`
        : `<span style="color:#ccc;font-size:0.75rem;">👤</span>`;

    const roleLabels = { user: '用戶', sponsor: '贊助商', agent: '保險員', admin: '管理員' };
    const userRole = getCurrentUserRole();
    const roleLabel = roleLabels[userRole] || '用戶';

    bar.innerHTML = `
        <span class="auth-role-badge role-${userRole}">${roleLabel}</span>
        <a href="${rootPrefix}wallet.html" class="auth-coin-pill" id="auth-coins" title="前往錢包">
            🪙 <span id="auth-coins-val">${data.coins}</span>
        </a>
        <a href="${rootPrefix}subscription.html" class="auth-plan-pill ${level}" id="auth-plan" title="查看方案">
            ${levelNames[level] || 'Free'}
        </a>
        <a href="${rootPrefix}profile.html" class="auth-avatar-link" title="個人檔案">
            <div class="auth-avatar-circle ${avatarClass}" id="auth-avatar-circle">
                ${avatarContent}
            </div>
            <span class="auth-username" id="auth-display-name">${user.displayName || user.username}</span>
        </a>
        <button class="auth-logout-btn" id="auth-logout-btn">登出</button>
    `;

    header.appendChild(bar); // 把整個資訊列加到 header 最後面
    // 幫登出按鈕綁定 click 事件 → 點擊就呼叫 logoutUser()
    document.getElementById('auth-logout-btn').addEventListener('click', logoutUser);
}

// 更新 header 中的 coins / plan badge / avatar
// 【何時呼叫？】當 coins 變動、VIP 升級、頭像更換時，各頁面呼叫此函式即時更新
// 不需要重新整理頁面，只更新 DOM 中的文字和圖片
function updateHeaderInfo() {
    if (!isLoggedIn()) return; // 沒登入就不更新
    const data = getUserData();
    const user = getAuthenticatedUser();
    const avatar = getAvatar();
    const level = data.vip_level || 'free';

    // Coins
    const coinsEl = document.getElementById('auth-coins-val');
    if (coinsEl) coinsEl.textContent = data.coins;

    // Plan badge
    const planEl = document.getElementById('auth-plan');
    if (planEl) {
        const levelNames = { free: 'Free', basic: '⭐ Basic', pro: '👑 Pro' };
        planEl.className = 'auth-plan-pill ' + level;
        planEl.textContent = levelNames[level] || 'Free';
    }

    // Avatar circle
    const avatarCircle = document.getElementById('auth-avatar-circle');
    if (avatarCircle) {
        avatarCircle.className = 'auth-avatar-circle' +
            (level === 'pro' ? ' vip-pro' : level === 'basic' ? ' vip-basic' : '');
        avatarCircle.innerHTML = avatar
            ? `<img src="${avatar}" alt="avatar">`
            : `<span style="color:#ccc;font-size:0.75rem;">👤</span>`;
    }

    // Display name
    const nameEl = document.getElementById('auth-display-name');
    if (nameEl && user) nameEl.textContent = user.displayName || user.username;

    // Also update any page-specific h-badge elements (backward compat)
    const hBadge = document.getElementById('h-badge');
    if (hBadge) {
        if (level === 'pro') { hBadge.textContent = '👑 VIP Pro'; hBadge.className = 'member-badge vip'; }
        else if (level === 'basic') { hBadge.textContent = '⭐ VIP Basic'; hBadge.className = 'member-badge vip'; }
        else { hBadge.textContent = 'Free'; hBadge.className = 'member-badge'; }
    }
}

// ===== Full-page Auth Lock =====
// 【區塊說明】未登入時顯示的全螢幕覆蓋層
// 用 JS 動態建立整個登入/註冊介面（不需要額外的 HTML 檔）
// 包含：登入表單 + 註冊表單 + 分頁切換
// 【為什麼用 JS 動態建立而不是寫在 HTML？】
// 因為每一頁都需要，用 JS 建立可以只維護一份程式碼
function showAuthLock() {
    // 建立覆蓋層 <div>，fixed 定位讓它覆蓋整個畫面
    const overlay = document.createElement('div');
    overlay.id = 'auth-lock-overlay';
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:8000;
        background:rgba(0,0,0,0.6);
        backdrop-filter:blur(8px);
        display:flex;align-items:center;justify-content:center;
    `;
    overlay.innerHTML = `
        <div id="auth-lock-card" style="
            background:#fff;border-radius:20px;padding:2.2rem 2rem;
            width:min(380px,90vw);box-shadow:0 20px 60px rgba(0,0,0,0.25);
            animation:authIn 0.35s ease-out;
        ">
            <div style="text-align:center;margin-bottom:1.2rem;">
                <div style="font-size:2.5rem;margin-bottom:0.5rem;">🔐</div>
                <h2 style="font-size:1.3rem;font-weight:600;margin-bottom:0.3rem;">請先登入</h2>
                <p style="font-size:0.85rem;color:#888;">登入後即可使用所有功能</p>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:14px;" id="auth-tabs">
                <button class="atab active" data-tab="login" type="button" style="
                    flex:1;padding:8px;border-radius:10px;border:none;cursor:pointer;
                    background:#9CC98D;color:#000;font-weight:600;font-size:0.9rem;
                ">登入</button>
                <button class="atab" data-tab="register" type="button" style="
                    flex:1;padding:8px;border-radius:10px;border:none;cursor:pointer;
                    background:#f4f4f4;color:#555;font-weight:500;font-size:0.9rem;
                ">註冊</button>
            </div>
            <form id="auth-login-form" style="display:block;">
                <input type="text" placeholder="電子郵件或帳號" required style="
                    width:100%;padding:10px 14px;border-radius:10px;border:1px solid #eee;
                    margin-bottom:10px;font-size:0.9rem;font-family:inherit;outline:none;
                ">
                <input type="password" placeholder="密碼" required style="
                    width:100%;padding:10px 14px;border-radius:10px;border:1px solid #eee;
                    margin-bottom:12px;font-size:0.9rem;font-family:inherit;outline:none;
                ">
                <button type="submit" style="
                    width:100%;padding:10px;border-radius:10px;border:none;
                    background:linear-gradient(135deg,#9CC98D,#7BB369);
                    color:#fff;font-weight:600;font-size:0.95rem;cursor:pointer;
                ">登入</button>
                <div style="font-size:0.78rem;color:#888;margin-top:8px;text-align:center;">
                    Demo：superuser/0000 · sponsorA/1111 · admin/9999
                </div>
            </form>
            <form id="auth-register-form" style="display:none;">
                <input type="text" placeholder="姓名" required style="
                    width:100%;padding:10px 14px;border-radius:10px;border:1px solid #eee;
                    margin-bottom:10px;font-size:0.9rem;font-family:inherit;outline:none;
                ">
                <input type="email" placeholder="電子郵件" required style="
                    width:100%;padding:10px 14px;border-radius:10px;border:1px solid #eee;
                    margin-bottom:10px;font-size:0.9rem;font-family:inherit;outline:none;
                ">
                <input type="password" placeholder="設定密碼" required style="
                    width:100%;padding:10px 14px;border-radius:10px;border:1px solid #eee;
                    margin-bottom:12px;font-size:0.9rem;font-family:inherit;outline:none;
                ">
                <button type="submit" style="
                    width:100%;padding:10px;border-radius:10px;border:none;
                    background:linear-gradient(135deg,#9CC98D,#7BB369);
                    color:#fff;font-weight:600;font-size:0.95rem;cursor:pointer;
                ">註冊</button>
                <div style="font-size:0.78rem;color:#888;margin-top:8px;text-align:center;">
                    註冊後可同步保單與諮詢紀錄
                </div>
            </form>
        </div>
    `;

    if (!document.getElementById('auth-anim-style')) {
        const style = document.createElement('style');
        style.id = 'auth-anim-style';
        style.textContent = `
            @keyframes authIn {
                from { transform: scale(0.92) translateY(20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const tabs = overlay.querySelectorAll('.atab');
    const loginForm = document.getElementById('auth-login-form');
    const registerForm = document.getElementById('auth-register-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const isLogin = tab.dataset.tab === 'login';
            tabs.forEach(t => {
                t.style.background = '#f4f4f4'; t.style.color = '#555'; t.style.fontWeight = '500';
                t.classList.remove('active');
            });
            tab.style.background = '#9CC98D'; tab.style.color = '#000'; tab.style.fontWeight = '600';
            tab.classList.add('active');
            loginForm.style.display = isLogin ? 'block' : 'none';
            registerForm.style.display = isLogin ? 'none' : 'block';
        });
    });

    // 【登入表單提交事件】
    // e.preventDefault() 阻止表單預設行為（預設會跳轉頁面）
    // 改為用 JS 處理登入邏輯
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // 阻止頁面跳轉
        const inputs = loginForm.querySelectorAll('input'); // 取得所有 <input>
        const user = loginLocalUser(inputs[0].value.trim(), inputs[1].value); // 驗證帳密
        if (!user) { alert('登入失敗：帳號或密碼錯誤'); return; }
        setAuthenticatedUser(user);          // 儲存登入狀態
        document.body.style.overflow = '';   // 恢復頁面可捲動
        overlay.remove();                    // 移除覆蓋層
        alert(`登入成功，歡迎 ${user.displayName}！`);
        window.location.reload();            // 重新載入以初始化頁面
    });

    // 【註冊表單提交事件】— 邏輯類似登入，多了「帳號重複」檢查
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputs = registerForm.querySelectorAll('input');
        const displayName = inputs[0].value.trim();  // 姓名
        const email = inputs[1].value.trim();         // 帳號（email）
        const password = inputs[2].value;             // 密碼
        if (!displayName || !email || !password) { alert('請填寫所有欄位'); return; }
        if (findUserByUsername(email)) { alert('此帳號已存在，請直接登入'); return; } // 重複檢查
        const newUser = registerLocalUser(displayName, email, password); // 建立帳號
        setAuthenticatedUser(newUser); // 自動登入
        document.body.style.overflow = '';
        overlay.remove();
        alert('註冊成功，已自動登入！');
        window.location.reload();
    });
}

// ===== Cross-Tab Sync =====
// 【區塊說明】跨分頁同步 — 解決「在 A 分頁簽到，B 分頁的 coins 沒更新」的問題
// 使用兩種機制：
//   1. storage event：當「其他分頁」修改 localStorage 時觸發
//   2. setInterval 輪詢：每 1.5 秒檢查一次（因為 storage event 「不偵測同分頁」的修改）
// 【為什麼需要兩種？】storage event 只會在「不同分頁」之間觸發，
//   所以還需要 setInterval 來偵測「同一分頁」內的變化（例如其他模組修改了 localStorage）

// 用 IIFE (Immediately Invoked Function Expression) 包裝，避免變數污染全域
// (function() { ... })() 會立即執行，且內部變數不會暴露到全域
(function () {
    // 【機制一】storage event — 偵測其他分頁的 localStorage 變化
    window.addEventListener('storage', (e) => {
        // 如果登入/登出狀態改變 → 立刻重新載入（可能在另一個分頁登出了）
        if (e.key === 'authUser' || e.key === 'userAuthed') {
            window.location.reload();
            return;
        }
        // 如果使用者資料、交易紀錄、頭像改變 → 更新 header 並通知其他模組
        if (e.key && (e.key.startsWith('user_data_') || e.key.startsWith('coin_history_') || e.key.startsWith('avatar_'))) {
            updateHeaderInfo();
            // CustomEvent 讓其他頁面可以監聽 'userDataSync' 事件來更新自己的 UI
            window.dispatchEvent(new CustomEvent('userDataSync'));
        }
    });

    // 「快照」：記住上次看到的 localStorage 值
    let _lastAuthSnap = localStorage.getItem('authUser');
    let _lastDataSnap = '';

    // 取得使用者資料的快照（用來比對是否有變化）
    function _getDataSnap() {
        try {
            const key = _getUserDataKey();
            return localStorage.getItem(key) || '';
        } catch { return ''; }
    }

    // 【機制二】setInterval 輪詢 — 每 1.5 秒檢查一次
    document.addEventListener('DOMContentLoaded', () => {
        // 頁面載入完成後，記住初始快照
        _lastAuthSnap = localStorage.getItem('authUser');
        _lastDataSnap = _getDataSnap();

        setInterval(() => {
            // 檢查登入狀態是否改變
            const currentAuth = localStorage.getItem('authUser');
            if (currentAuth !== _lastAuthSnap) {
                _lastAuthSnap = currentAuth;
                window.location.reload(); // 登入狀態改變 → 重新載入
                return;
            }

            // 檢查使用者資料是否改變
            const currentData = _getDataSnap();
            if (currentData !== _lastDataSnap) {
                _lastDataSnap = currentData;
                updateHeaderInfo(); // 資料改變 → 更新 header
                window.dispatchEvent(new CustomEvent('userDataSync')); // 通知其他模組
            }
        }, 1500); // 每 1500 毫秒（1.5 秒）檢查一次
    });
})();

// ===== 推薦碼系統 =====
// 為每位使用者產生固定推薦碼（deterministic，基於 username + id）
function _generateReferralCode(user) {
    const prefix = ((user.username || user.id || 'USR').slice(0, 3)).toUpperCase();
    // 簡易 hash：把 id 字串轉為 4 碼大寫英數
    let hash = 0;
    const src = user.id || user.username || '';
    for (let i = 0; i < src.length; i++) {
        hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
    }
    const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 4).padEnd(4, '0');
    return prefix + '-' + code;
}

// 取得目前登入者的推薦碼
function getMyReferralCode() {
    const auth = getAuthenticatedUser();
    if (!auth) return null;
    const users = getLocalUsers();
    const u = users.find(x => x.id === auth.id);
    return u ? u.referral_code : null;
}

// 根據推薦碼查找推薦人
function findUserByReferralCode(code) {
    if (!code) return null;
    const users = getLocalUsers();
    return users.find(u => u.referral_code === code.trim().toUpperCase()) || null;
}

// 檢查目前用戶是否可以輸入推薦碼（24H 內 + 尚未使用）
function canInputReferral() {
    const auth = getAuthenticatedUser();
    if (!auth) return { canInput: false, reason: 'not_logged_in' };

    const users = getLocalUsers();
    const u = users.find(x => x.id === auth.id);
    if (!u) return { canInput: false, reason: 'user_not_found' };

    // 已使用推薦碼
    if (u.referred_by) return { canInput: false, reason: 'already_used', referrer: u.referred_by };

    // 24H 倒數計算
    const createdAt = new Date(u.createdAt || Date.now());
    const deadline = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();

    if (remaining <= 0) return { canInput: false, reason: 'expired' };

    return {
        canInput: true,
        deadline: deadline.toISOString(),
        remainingMs: remaining,
        remainingText: _formatCountdown(remaining)
    };
}

function _formatCountdown(ms) {
    if (ms <= 0) return '已過期';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}時${m}分${s}秒`;
}

// 套用推薦碼（新用戶使用推薦碼 → 雙方獲獎）
// 回傳 { success, message, referrerName }
function applyReferralCode(code) {
    const auth = getAuthenticatedUser();
    if (!auth) return { success: false, message: '請先登入' };

    const check = canInputReferral();
    if (!check.canInput) {
        const reasons = {
            already_used: '您已經使用過推薦碼了',
            expired: '推薦碼輸入期限已過（24小時）',
            not_logged_in: '請先登入',
            user_not_found: '帳號異常'
        };
        return { success: false, message: reasons[check.reason] || '無法使用' };
    }

    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) return { success: false, message: '請輸入推薦碼' };

    // 不能用自己的推薦碼
    const myCode = getMyReferralCode();
    if (trimmed === myCode) return { success: false, message: '不能使用自己的推薦碼' };

    // 查找推薦人
    const referrer = findUserByReferralCode(trimmed);
    if (!referrer) return { success: false, message: '推薦碼無效，找不到對應帳號' };

    const users = getLocalUsers();
    const now = new Date().toISOString();

    // 標記被推薦人
    const me = users.find(x => x.id === auth.id);
    if (me) {
        me.referred_by = referrer.id;
        me.referred_at = now;
    }
    saveLocalUsers(users);

    // === 被推薦人獎勵 ===
    const myData = getUserData();
    myData.coins = (myData.coins || 0) + 5;
    saveUserData(myData);
    addHistory('earn', '推薦碼新手禮', 5);

    // === 推薦人獎勵 ===
    // 更新推薦人的 referral_data
    const refKey = 'referral_data_' + referrer.id;
    let refData;
    try { refData = JSON.parse(localStorage.getItem(refKey) || '{}'); } catch { refData = {}; }
    refData.code = refData.code || referrer.referral_code;
    refData.count = (refData.count || 0) + 1;
    refData.referrals = refData.referrals || [];
    refData.referrals.unshift({
        name: auth.displayName || auth.username || '新用戶',
        time: new Date().toLocaleString('zh-TW')
    });
    refData.claimed_tiers = refData.claimed_tiers || [];
    localStorage.setItem(refKey, JSON.stringify(refData));

    // 推薦人加 coins（也改 userData）
    const refUserDataKey = 'userData_' + referrer.id;
    let refUserData;
    try { refUserData = JSON.parse(localStorage.getItem(refUserDataKey) || '{}'); } catch { refUserData = {}; }
    refUserData.coins = (refUserData.coins || 0) + 10;
    localStorage.setItem(refUserDataKey, JSON.stringify(refUserData));

    // 推薦人解鎖限定貼圖（推薦滿 1 人即送「推薦之心」貼圖）
    const stickerKey = 'sticker_unlocks_' + referrer.id;
    let stickerArr;
    try { stickerArr = JSON.parse(localStorage.getItem(stickerKey) || '[]'); } catch { stickerArr = []; }
    if (!stickerArr.includes('stk_referral_heart')) {
        stickerArr.push('stk_referral_heart');
        localStorage.setItem(stickerKey, JSON.stringify(stickerArr));
    }

    return {
        success: true,
        message: `推薦碼套用成功！您獲得 5 Coins 新手禮，${referrer.displayName || referrer.username} 也獲得 10 Coins + 限定貼圖！`,
        referrerName: referrer.displayName || referrer.username
    };
}

// ===== Auto Init =====
// 【這行是整個 auth.js 的啟動開關】
// DOMContentLoaded 事件：當 HTML 載入完成（但圖片等資源可能還沒載完）時觸發
// 每一頁載入時都會執行 initAuthGate() → 檢查登入 → 注入 header 或顯示登入畫面
document.addEventListener('DOMContentLoaded', initAuthGate);

function ensureAdaptiveAuthBarStyles() {
    if (document.getElementById('auth-header-dark-overrides')) return;

    const style = document.createElement('style');
    style.id = 'auth-header-dark-overrides';
    style.textContent = `
        .auth-info-bar.auth-info-bar-dark {
            background:
                linear-gradient(135deg, rgba(23, 40, 73, 0.8), rgba(10, 17, 34, 0.68)),
                radial-gradient(circle at 18% 18%, rgba(143, 187, 255, 0.16), transparent 46%);
            border-color: rgba(181, 207, 255, 0.22);
            box-shadow:
                0 18px 40px rgba(2, 8, 23, 0.4),
                inset 0 1px 0 rgba(255,255,255,0.14),
                inset 0 -1px 0 rgba(93, 132, 207, 0.12);
            backdrop-filter: saturate(185%) blur(20px);
            -webkit-backdrop-filter: saturate(185%) blur(20px);
        }
        .auth-info-bar.auth-info-bar-dark::before {
            background:
                linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 58%, rgba(93,132,207,0.08)),
                radial-gradient(circle at top left, rgba(187, 214, 255, 0.12), transparent 44%);
        }
        .auth-info-bar.auth-info-bar-dark .auth-user-chip,
        .auth-info-bar.auth-info-bar-dark .auth-avatar-link,
        .auth-info-bar.auth-info-bar-dark .auth-logout-btn,
        .auth-info-bar.auth-info-bar-dark .help-trigger {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
            border-color: rgba(181, 207, 255, 0.18);
            color: #e5eefc;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .auth-info-bar.auth-info-bar-dark .auth-user-chip:hover,
        .auth-info-bar.auth-info-bar-dark .auth-avatar-link:hover,
        .auth-info-bar.auth-info-bar-dark .auth-logout-btn:hover,
        .auth-info-bar.auth-info-bar-dark .help-trigger:hover {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.1));
            color: #ffffff;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 24px rgba(4,11,26,0.18);
        }
        .auth-info-bar.auth-info-bar-dark .auth-username {
            color: #f8fbff;
        }
        .auth-info-bar.auth-info-bar-dark .auth-role-badge.role-user {
            background: rgba(156, 201, 141, 0.18);
            color: #cde5bd;
        }
        .auth-info-bar.auth-info-bar-dark .auth-role-badge.role-sponsor {
            background: rgba(240, 192, 64, 0.18);
            color: #ffd46b;
        }
        .auth-info-bar.auth-info-bar-dark .auth-role-badge.role-agent {
            background: rgba(188, 140, 255, 0.2);
            color: #d6b7ff;
        }
        .auth-info-bar.auth-info-bar-dark .auth-role-badge.role-admin {
            background: rgba(248, 81, 73, 0.2);
            color: #ffb2ad;
        }
        .auth-info-bar.auth-info-bar-dark .auth-coin-pill {
            background: linear-gradient(135deg, rgba(255, 196, 66, 0.18), rgba(255, 235, 174, 0.08));
            color: #ffd46a;
            border-color: rgba(255, 223, 129, 0.2);
        }
        .auth-info-bar.auth-info-bar-dark .auth-coin-pill:hover {
            background: linear-gradient(135deg, rgba(255, 196, 66, 0.24), rgba(255, 235, 174, 0.12));
        }
        .auth-info-bar.auth-info-bar-dark .auth-plan-pill.free {
            background: linear-gradient(135deg, rgba(148, 163, 184, 0.18), rgba(148, 163, 184, 0.08));
            color: #d7e2f0;
        }
        .auth-info-bar.auth-info-bar-dark .auth-plan-pill.basic {
            background: linear-gradient(135deg, rgba(255, 221, 132, 0.26), rgba(255, 235, 174, 0.16));
            color: #ffd46a;
        }
        .auth-info-bar.auth-info-bar-dark .auth-plan-pill.pro {
            background: linear-gradient(135deg, rgba(106, 90, 255, 0.26), rgba(205, 154, 255, 0.18));
            color: #e4ccff;
        }
    `;
    document.head.appendChild(style);
}

function isHeaderDarkSurface() {
    const header = document.querySelector('header');
    if (!header) return false;

    const bg = window.getComputedStyle(header).backgroundColor || '';
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return false;

    const [, r, g, b] = match.map(Number);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.48;
}

function syncAuthInfoBarTheme() {
    ensureAdaptiveAuthBarStyles();

    const bar = document.getElementById('auth-info-bar');
    if (!bar) return;

    bar.classList.toggle('auth-info-bar-dark', isHeaderDarkSurface());
}

const _codexInjectHeaderInfo = injectHeaderInfo;
injectHeaderInfo = function () {
    _codexInjectHeaderInfo();
    syncAuthInfoBarTheme();
};

const _codexUpdateHeaderInfo = updateHeaderInfo;
updateHeaderInfo = function () {
    _codexUpdateHeaderInfo();
    syncAuthInfoBarTheme();
};

window.addEventListener('load', syncAuthInfoBarTheme);
window.addEventListener('resize', () => window.requestAnimationFrame(syncAuthInfoBarTheme));

function injectHeaderInfo() {
    const user = getAuthenticatedUser();
    if (!user) return;

    const header = document.querySelector('header');
    if (!header) return;

    const existingBar = document.getElementById('auth-info-bar');
    if (existingBar) existingBar.remove();

    _injectHeaderStyles();

    const data = getUserData();
    const avatar = getAvatar();
    const level = data.vip_level || 'free';
    const inSubFolder = isInPolicySearchFolder();
    const rootPrefix = inSubFolder ? '../' : '';

    const bar = document.createElement('div');
    bar.id = 'auth-info-bar';
    bar.className = 'auth-info-bar';

    const levelNames = { free: 'Free', basic: 'Basic', pro: 'Pro' };
    const avatarClass = level === 'pro' ? 'vip-pro' : level === 'basic' ? 'vip-basic' : '';
    const avatarContent = avatar
        ? `<img src="${avatar}" alt="avatar">`
        : `<span style="color:#fff;font-size:0.8rem;">👤</span>`;

    const roleLabels = { user: '用戶', sponsor: '贊助商', agent: '顧問', admin: '管理員' };
    const userRole = getCurrentUserRole();
    const roleLabel = roleLabels[userRole] || '用戶';

    bar.innerHTML = `
        <a href="${rootPrefix}profile.html" class="auth-user-chip" title="前往個人資料">
            <div class="auth-avatar-circle ${avatarClass}" id="auth-avatar-circle">
                ${avatarContent}
            </div>
            <div class="auth-user-meta">
                <span class="auth-username" id="auth-display-name">${user.displayName || user.username}</span>
                <span class="auth-role-badge role-${userRole}" id="auth-role-badge">${roleLabel}</span>
            </div>
        </a>
        <div class="auth-pill-group">
            <a href="${rootPrefix}wallet.html" class="auth-coin-pill" id="auth-coins" title="前往錢包">
                <span aria-hidden="true">🪙</span>
                <span id="auth-coins-val">${data.coins}</span>
            </a>
            <a href="${rootPrefix}subscription.html" class="auth-plan-pill ${level}" id="auth-plan" title="查看會員方案">
                ${levelNames[level] || 'Free'}
            </a>
        </div>
        <button class="auth-logout-btn" id="auth-logout-btn">登出</button>
    `;

    header.appendChild(bar);
    document.getElementById('auth-logout-btn').addEventListener('click', logoutUser);

    if (typeof window.updateNavAuthUI === 'function') {
        window.updateNavAuthUI();
    }
}

function updateHeaderInfo() {
    if (!isLoggedIn()) return;

    const data = getUserData();
    const user = getAuthenticatedUser();
    const avatar = getAvatar();
    const level = data.vip_level || 'free';

    const coinsEl = document.getElementById('auth-coins-val');
    if (coinsEl) coinsEl.textContent = data.coins;

    const planEl = document.getElementById('auth-plan');
    if (planEl) {
        const levelNames = { free: 'Free', basic: 'Basic', pro: 'Pro' };
        planEl.className = 'auth-plan-pill ' + level;
        planEl.textContent = levelNames[level] || 'Free';
    }

    const avatarCircle = document.getElementById('auth-avatar-circle');
    if (avatarCircle) {
        avatarCircle.className = 'auth-avatar-circle' +
            (level === 'pro' ? ' vip-pro' : level === 'basic' ? ' vip-basic' : '');
        avatarCircle.innerHTML = avatar
            ? `<img src="${avatar}" alt="avatar">`
            : `<span style="color:#fff;font-size:0.8rem;">👤</span>`;
    }

    const nameEl = document.getElementById('auth-display-name');
    if (nameEl && user) nameEl.textContent = user.displayName || user.username;

    const roleEl = document.getElementById('auth-role-badge');
    if (roleEl) {
        const roleLabels = { user: '用戶', sponsor: '贊助商', agent: '顧問', admin: '管理員' };
        const userRole = getCurrentUserRole();
        roleEl.className = `auth-role-badge role-${userRole}`;
        roleEl.textContent = roleLabels[userRole] || '用戶';
    }

    const hBadge = document.getElementById('h-badge');
    if (hBadge) {
        if (level === 'pro') { hBadge.textContent = 'VIP Pro'; hBadge.className = 'member-badge vip'; }
        else if (level === 'basic') { hBadge.textContent = 'VIP Basic'; hBadge.className = 'member-badge vip'; }
        else { hBadge.textContent = 'Free'; hBadge.className = 'member-badge'; }
    }

    if (typeof window.updateNavAuthUI === 'function') {
        window.updateNavAuthUI();
    }
}
