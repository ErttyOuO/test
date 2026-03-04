(function () {
    const container = document.getElementById('policyContainer');
    const searchInput = document.getElementById('policySearchInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterFollowBtn = document.getElementById('filterFollowBtn');
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    const filterSection = document.getElementById('filterSection');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const resultCountText = document.getElementById('resultCount');

    let allPolicies = [];
    let socialData = {};
    let showFollowedOnly = false;
    let selectedCompanies = [];
    let selectedCategories = [];

    function loadSocialData() {
        socialData = JSON.parse(localStorage.getItem('policy_social_data')) || {};
    }

    function save() {
        localStorage.setItem('policy_social_data', JSON.stringify(socialData));
    }

    function getCategoryGroups(cat) {
        if (!cat) return [];
        const groups = [];
        if (/人壽保險|壽險保障|壽險/.test(cat)) groups.push('人壽保險');
        if (/健康與傷害保險|健康醫療險|健康醫療/.test(cat)) groups.push('健康醫療');
        if (/意外傷害/.test(cat)) groups.push('意外傷害');
        if (/投資|變額/.test(cat)) groups.push('投資型保險');
        if (/年金|養老|還本/.test(cat)) groups.push('還本/年金型保險');
        if (/旅遊平安險/.test(cat)) groups.push('旅遊平安險');
        if (/團體保險/.test(cat)) groups.push('團體保險');
        return groups.length > 0 ? groups : ['其他'];
    }

    async function init() {
        loadSocialData();
        try {
            const res = await fetch('policy_data.json');
            const data = await res.json();

            allPolicies = data.map(p => ({
                ...p,
                id: p.id || p.policy_id || Math.random().toString(36).substr(2, 9),
                mappedGroups: getCategoryGroups(p.category)
            }));

            allPolicies.forEach(p => {
                if (!socialData[p.id]) {
                    socialData[p.id] = { likes: 0, comments: [], isFollowed: false, isLiked: false };
                }
            });

            save();
            createFilters();

            // 讀取從首頁帶過來的 URL 參數，自動套用搜尋條件
            const urlParams = new URLSearchParams(window.location.search);
            const paramCompany = urlParams.get('company');
            const paramCategory = urlParams.get('category');

            if (paramCompany) {
                searchInput.value = paramCompany;
            }

            if (paramCategory) {
                // 自動勾選對應的類別 checkbox
                const categoryCheckboxes = document.querySelectorAll('#categoryFilters input[type="checkbox"]');
                categoryCheckboxes.forEach(cb => {
                    if (cb.value === paramCategory) {
                        cb.checked = true;
                        selectedCategories.push(paramCategory);
                    }
                });
                // 展開進階篩選面板讓使用者看到已勾選的條件
                filterSection.classList.remove('hidden');
            }

            render();
        } catch (err) {
            console.error(err);
            container.innerHTML = '<div style="text-align:center;padding:50px;">載入資料失敗</div>';
        }
    }

    function createFilters() {
        const companies = [...new Set(allPolicies.map(p => p.source))];
        const categories = ['人壽保險', '健康醫療', '意外傷害', '投資型保險', '還本/年金型保險', '旅遊平安險', '團體保險', '其他'];

        document.querySelector('#companyFilters .checkbox-list').innerHTML = companies.map(c => `
            <label><input type="checkbox" value="${c}"><span>${c}</span></label>
        `).join('');

        document.querySelector('#categoryFilters .checkbox-list').innerHTML = categories.map(cat => `
            <label><input type="checkbox" value="${cat}"><span>${cat}</span></label>
        `).join('');

        document.querySelectorAll('.filter-section input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const val = e.target.value;
                const targetArray = e.target.closest('#companyFilters') ? selectedCompanies : selectedCategories;
                if (e.target.checked) targetArray.push(val);
                else { const idx = targetArray.indexOf(val); if (idx > -1) targetArray.splice(idx, 1); }
                render();
            });
        });
    }

    function render() {
        const term = (searchInput.value || "").toLowerCase();
        let filtered = allPolicies.filter(p => {
            const s = socialData[p.id] || { isFollowed: false };
            const matchesSearch = p.name.toLowerCase().includes(term) || p.source.toLowerCase().includes(term);
            const matchesFollow = showFollowedOnly ? s.isFollowed : true;
            const matchesCompany = selectedCompanies.length ? selectedCompanies.includes(p.source) : true;
            const matchesCategory = selectedCategories.length ? p.mappedGroups.some(g => selectedCategories.includes(g)) : true;
            return matchesSearch && matchesFollow && matchesCompany && matchesCategory;
        });

        if (sortSelect.value === 'likes') filtered.sort((a, b) => (socialData[b.id].likes || 0) - (socialData[a.id].likes || 0));
        else if (sortSelect.value === 'comments') filtered.sort((a, b) => (socialData[b.id].comments.length || 0) - (socialData[a.id].comments.length || 0));

        resultCountText.textContent = `共 ${filtered.length} 筆結果`;

        container.innerHTML = filtered.map(p => {
            const s = socialData[p.id];
            return `
                <article class="policy-card" onclick="window.openDetail('${p.id}')">
                    <span class="card-source">${p.source} | ${p.mappedGroups.join(', ')}</span>
                    <h3 class="card-title">${p.name}</h3>
                    <p class="card-summary">${p.summary || '點擊查看詳情...'}</p>
                    <div class="card-social">
                        <div class="social-item ${s.isLiked ? 'active' : ''}" onclick="window.doLike('${p.id}', event)">
                            <i class="fi fi-rr-social-network"></i><span>${s.likes}</span>
                        </div>
                        <div class="social-item" onclick="window.openDetail('${p.id}', true)">
                            <i class="fi fi-rr-comment"></i><span>${s.comments.length}</span>
                        </div>
                        <div class="social-item ${s.isFollowed ? 'following' : ''}" onclick="window.doFollow('${p.id}', event)">
                            <i class="fi ${s.isFollowed ? 'fi-sr-star' : 'fi-rr-star'}"></i><span>${s.isFollowed ? '已關注' : '關注'}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    window.openDetail = (id, scrollComment = false) => {
        const p = allPolicies.find(x => x.id == id);
        const s = socialData[id];
        if (!p) return;

        const featureSection = (p.content_sections || []).find(s => s.title === "商品特色");
        const body = document.getElementById('modalBody');

        // 處理爬取日期
        const crawlDate = p.crawl_date || '2026-02-09';

        body.innerHTML = `
            <div class="modal-badge-group">
                <span class="modal-badge">${p.source}</span>
                <span class="modal-badge">${p.mappedGroups.join(' / ')}</span>
                <span class="modal-badge">爬取日期: ${crawlDate}</span>
            </div>
            
            <h2 class="modal-policy-title">${p.name}</h2>
            <p class="modal-policy-desc">${p.summary || '暫無描述'}</p>
            
            <div class="modal-action-buttons">
                <a href="${p.dm_pdf_url || '#'}" target="_blank" class="btn-blue-link">
                    <i class="fi fi-rr-document"></i> 開啟 DM
                </a>
                <a href="${p.terms_pdf_url || '#'}" target="_blank" class="btn-blue-link">
                    <i class="fi fi-rr-file-pdf"></i> 查看條款 PDF
                </a>
                <a href="${p.url || '#'}" target="_blank" class="btn-gray-link">
                    <i class="fi fi-rr-link"></i> 官方網站
                </a>
            </div>

            <div class="modal-section">
                <h3 class="modal-section-title">商品特色</h3>
                <div class="feature-content">
                    ${featureSection ? featureSection.content : '暫無特色說明'}
                </div>
            </div>

            <div class="comment-section">
                <h3 class="modal-section-title">留言區 (${s.comments.length})</h3>
                <div class="comment-list" id="commentList">
                    ${s.comments.length ? s.comments.map((c, index) => `
                        <div class="comment-item" id="comment-${index}">
                            <div class="comment-meta">
                                <span class="comment-user">用戶</span>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span class="comment-date">${c.date}</span>
                                    <div class="comment-actions">
                                        <button class="btn-edit" onclick="window.startEdit('${p.id}', ${index})"><i class="fi fi-rr-edit"></i></button>
                                        <button class="btn-delete" onclick="window.deleteComment('${p.id}', ${index})"><i class="fi fi-rr-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                            <p class="comment-text" id="text-${index}">${c.text}</p>
                        </div>
                    `).join('') : '<p class="no-comment">目前尚無留言，快來分享您的看法！</p>'}
                </div>
                <div class="comment-input-area">
                    <textarea id="commentInput" placeholder="分享您的投保心得或疑問..."></textarea>
                    <button class="btn-submit-comment" onclick="window.submitComment('${p.id}')">發表心得</button>
                </div>
            </div>
        `;

        document.getElementById('detailModal').classList.add('show');

        if (scrollComment) {
            setTimeout(() => {
                document.querySelector('.comment-section').scrollIntoView({ behavior: 'smooth' });
            }, 200);
        }
    };

    // 1. 刪除留言
    window.deleteComment = (policyId, commentIndex) => {
        if (!confirm('確定要刪除這條心得嗎？')) return;

        socialData[policyId].comments.splice(commentIndex, 1);
        save();
        window.openDetail(policyId); // 刷新彈窗
        render(); // 刷新主頁面數字
    };

    // 2. 開啟編輯模式
    window.startEdit = (policyId, index) => {
        const textElement = document.getElementById(`text-${index}`);
        const originalText = textElement.innerText;

        textElement.innerHTML = `
            <textarea id="edit-input-${index}" class="edit-textarea">${originalText}</textarea>
            <div class="edit-save-group">
                <button class="btn-clear" onclick="window.openDetail('${policyId}')">取消</button>
                <button class="btn-submit-comment" style="padding: 5px 15px;" onclick="window.saveEdit('${policyId}', ${index})">儲存</button>
            </div>
        `;
    };

    // 3. 儲存編輯後的內容
    window.saveEdit = (policyId, index) => {
        const newText = document.getElementById(`edit-input-${index}`).value.trim();
        if (!newText) return;

        socialData[policyId].comments[index].text = newText;
        socialData[policyId].comments[index].date += ' (已編輯)';

        save();
        window.openDetail(policyId);
    };

    window.submitComment = (id) => {
        const input = document.getElementById('commentInput');
        const text = input.value.trim();
        if (!text) return;

        socialData[id].comments.push({
            text: text,
            date: new Date().toLocaleString('zh-TW', { hour12: false }).slice(0, 16)
        });

        save();
        input.value = ''; // 提交後清空輸入框
        window.openDetail(id, true); // 刷新 Modal 並滾動至留言區
        render();
    };

    window.closeDetailModal = () => document.getElementById('detailModal').classList.remove('show');
    window.doLike = (id, e) => { e.stopPropagation(); socialData[id].isLiked = !socialData[id].isLiked; socialData[id].likes += socialData[id].isLiked ? 1 : -1; save(); render(); };
    window.doFollow = (id, e) => { e.stopPropagation(); socialData[id].isFollowed = !socialData[id].isFollowed; save(); render(); };

    searchInput.addEventListener('input', render);
    sortSelect.addEventListener('change', render);
    filterFollowBtn.addEventListener('click', () => { showFollowedOnly = !showFollowedOnly; filterFollowBtn.classList.toggle('active'); render(); });
    filterToggleBtn.addEventListener('click', () => filterSection.classList.toggle('hidden'));
    clearFiltersBtn.addEventListener('click', () => { selectedCompanies = []; selectedCategories = []; searchInput.value = ''; showFollowedOnly = false; document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false); render(); });
    window.onclick = (e) => { if (e.target == document.getElementById('detailModal')) window.closeDetailModal(); };

    init();
})();