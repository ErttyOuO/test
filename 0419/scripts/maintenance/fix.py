import os

script_path = r'c:\Users\user\Desktop\IAFM\重新設計版面樣式\script.js'

injection_code = '''
// =========== Global Floating Button Fix ===========
function openFaqModal() {
    let modal = document.getElementById('faq-modal');
    if (!modal) {
        // Inject faq-modal
        const modalHtml = `
        <div class="faq-modal-overlay" id="faq-modal">
            <div class="faq-modal-content">
                <div class="faq-modal-header">
                    <h3 class="faq-modal-title">客服與常見問題</h3>
                    <button class="faq-modal-close" onclick="closeFaqModal()">
                        <i class="fi fi-rr-cross"></i>
                    </button>
                </div>
                <div class="faq-modal-body">
                    <div class="faq-item">
                        <div class="faq-question">如何重置密碼？</div>
                        <div class="faq-answer">請在登入頁面點擊「忘記密碼」，我們將發送重置連結到您的信箱。</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-question">保單資訊多久更新一次？</div>
                        <div class="faq-answer">平台保單資訊每日凌晨進行同步，確保資料為最新狀態。</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-question">如何聯繫專人客服？</div>
                        <div class="faq-answer">
                            您可透過以下方式聯繫我們：<br>
                            <i class="fi fi-rr-phone-call"></i> 客服專線：0800-123-456<br>
                            <i class="fi fi-rr-envelope"></i> 聯絡客服 (Email)
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('faq-modal');
    }
    
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

window.openFaqModal = openFaqModal;

function closeFaqModal() {
    const modal = document.getElementById('faq-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

window.closeFaqModal = closeFaqModal;

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
});
'''

with open(script_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'Global Floating Button Fix' not in content:
    with open(script_path, 'a', encoding='utf-8') as f:
        f.write('\n' + injection_code)
    print('Floating button fix injected into script.js')
else:
    print('Fix already in script.js')
