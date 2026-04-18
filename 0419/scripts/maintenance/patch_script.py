import os
import re

ref_script_path = r'c:\Users\user\Desktop\IAFM\客服_留言按讚次數\script.js'
target_script_path = r'c:\Users\user\Desktop\IAFM\重新設計版面樣式\script.js'

with open(ref_script_path, 'r', encoding='utf-8') as f:
    ref_content = f.read()

# Extract FAQ Logic
match = re.search(r'(// --- FAQ & Contact Form Logic ---.*?// ==========================================\n// 3\. 認證模組 \(Auth\))', ref_content, re.DOTALL)
faq_logic = match.group(1).replace('// ==========================================\n// 3. 認證模組 (Auth)', '').strip()

with open(target_script_path, 'r', encoding='utf-8') as f:
    target_content = f.read()

# 1. Remove my previous injection
if "// =========== Global Floating Button Fix ===========" in target_content:
    parts = target_content.split("// =========== Global Floating Button Fix ===========")
    target_content = parts[0].strip()

# 2. Append the real FAQ logic
if "// --- FAQ & Contact Form Logic ---" not in target_content:
    target_content += "\n\n" + faq_logic + "\n"

# 3. Append the global button fix & modal injection
global_fix = """
window.addEventListener('load', () => {
    // Fix floating buttons globally
    document.querySelectorAll('.float-btn').forEach(btn => {
        if (btn.classList.contains('emergency') || btn.classList.contains('faq-btn') || btn.querySelector('.float-tooltip')) {
            btn.classList.remove('emergency');
            btn.classList.add('faq-btn');
            btn.setAttribute('onclick', 'openFaqModal()');
            const tooltip = btn.querySelector('.float-tooltip');
            if (tooltip) {
                tooltip.textContent = '聯絡客服';
            }
        }
    });

    if (!document.getElementById('faq-modal')) {
        const modalHtml = `
    <div class="faq-modal-overlay" id="faq-modal">
        <div class="faq-modal-content">
            <button class="modal-close" onclick="closeFaqModal()">×</button>
            <div class="faq-modal-header">
                <div class="faq-modal-title">客服支援 & 常見問題</div>
            </div>

            <button class="faq-contact-btn" onclick="showContactForm()">
                <i class="fi fi-rr-envelope"></i> 聯絡客服 (Email)
            </button>

            <div class="faq-accordion">
                <div class="faq-item">
                    <div class="faq-question">
                        <span>忘記密碼怎麼辦？</span>
                        <i class="fi fi-rr-angle-down faq-icon"></i>
                    </div>
                    <div class="faq-answer">
                        若您忘記密碼，請在登入畫面點擊「忘記密碼」，我們將會發送密碼重置信件至您的註冊信箱，請依照信件指示重新設定即可。
                    </div>
                </div>
                <div class="faq-item">
                    <div class="faq-question">
                        <span>如何新增保單？</span>
                        <i class="fi fi-rr-angle-down faq-icon"></i>
                    </div>
                    <div class="faq-answer">
                        請前往「保單搜尋」頁面，您可以透過上傳保單截圖、PDF 掃描檔，或是直接向保險顧問索取專屬的 DR Code 數位碼來快速匯入您的保單。
                    </div>
                </div>
            </div>

            <div id="faq-form-container" class="faq-form-container"></div>
        </div>
    </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
});
"""

if "Fix floating buttons globally" not in target_content:
    target_content += "\n" + global_fix + "\n"

# 4. Fix Theme Toggle Logic
old_theme_logic = """function initThemeToggle() {
    // Determine initial theme
    const savedTheme = localStorage.getItem('app-theme') || 'home-future';
    if (savedTheme === 'home-future') {
        document.body.classList.add('home-future');
    } else {
        document.body.classList.remove('home-future');
    }"""

new_theme_logic = """function initThemeToggle() {
    // Determine initial theme
    const savedTheme = localStorage.getItem('app-theme') || 'home-future';
    if (savedTheme === 'home-future') {
        document.body.classList.add('home-future');
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.classList.remove('home-future');
        document.body.removeAttribute('data-theme');
    }"""
target_content = target_content.replace(old_theme_logic, new_theme_logic)

old_toggle_light = """            if (e.target.checked) {
                document.body.classList.remove('home-future');
                localStorage.setItem('app-theme', 'clean-white');"""

new_toggle_light = """            if (e.target.checked) {
                document.body.classList.remove('home-future');
                document.body.removeAttribute('data-theme');
                localStorage.setItem('app-theme', 'clean-white');"""
target_content = target_content.replace(old_toggle_light, new_toggle_light)

old_toggle_dark = """            } else {
                document.body.classList.add('home-future');
                localStorage.setItem('app-theme', 'home-future');"""

new_toggle_dark = """            } else {
                document.body.classList.add('home-future');
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('app-theme', 'home-future');"""
target_content = target_content.replace(old_toggle_dark, new_toggle_dark)

with open(target_script_path, 'w', encoding='utf-8') as f:
    f.write(target_content)

print("Patched script.js successfully")
