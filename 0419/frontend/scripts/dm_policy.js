(function () {
    const container = document.getElementById('policyContainer');
    const topContainer = document.getElementById('topRecommended');
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

    // 用戶名數組
    const user_names = [
        '小明', '小華', '小美', '小麗', '小強', '小芳', '小偉', '小玲', '小龍', '小鳳',
        '阿明', '阿華', '阿美', '阿麗', '阿強', '阿芳', '阿偉', '阿玲', '阿龍', '阿鳳',
        '張小明', '李小華', '王小美', '陳小麗', '林小強', '黃小芳', '吳小偉', '蔡小玲', '楊小龍', '趙小鳳',
        '保險達人', '理財專家', '保障小幫手', '保單控', '險種分析師', '理賠快手', '保費獵人', '保障守護者',
        '財富規劃師', '風險管理員', '保險小王子', '保障小公主', '理財小達人', '保單收藏家', '險種研究員',
        '理賠專家', '保費計算師', '保障規劃師', '風險評估師', '保險顧問', '財富守護者', '保障天使',
        '保險小助手', '理財小秘書', '保障小精靈', '保單小魔術師', '險種小偵探', '理賠小助手',
        '保費小計算機', '保障小衛士', '風險小預言家', '保險小智者', '財富小管家', '保障小醫生',
        '保險小老師', '理財小學者', '保障小工程師', '保單小藝術家', '險種小設計師', '理賠小律師',
        '保費小經濟學家', '保障小心理學家', '風險小統計學家', '保險小歷史學家', '財富小哲學家', '保障小詩人'
    ];

    function loadSocialData() {
        socialData = JSON.parse(localStorage.getItem('policy_social_data')) || {};
        console.log('Loaded social data:', Object.keys(socialData).length, 'items');

        // 為舊數據添加用戶名字段
        let hasUpdates = false;
        Object.keys(socialData).forEach(policyId => {
            const policy = socialData[policyId];
            if (policy.comments && policy.comments.length > 0) {
                policy.comments.forEach(comment => {
                    if (!comment.user) {
                        comment.user = user_names[Math.floor(Math.random() * user_names.length)];
                        hasUpdates = true;
                    }
                });
            }
        });

        if (hasUpdates) {
            save();
        }
    }

    function save() {
        localStorage.setItem('policy_social_data', JSON.stringify(socialData));
        console.log('Saved social data:', Object.keys(socialData).length, 'items');
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
        if (/防癌|癌症/.test(cat)) groups.push('防癌險');
        if (/長照|長期照護/.test(cat)) groups.push('長照險');
        if (/儲蓄|分紅/.test(cat)) groups.push('儲蓄險');
        return groups.length > 0 ? groups : ['其他'];
    }

    async function init() {
        loadSocialData();
        try {
            const res = await fetch('../../data/policy/policy_data.json');
            const data = await res.json();

            allPolicies = data.map(p => ({
                ...p,
                id: p.id || p.policy_id || `${p.source}_${p.name}`.replace(/[^a-zA-Z0-9]/g, '_'),
                mappedGroups: getCategoryGroups(p.category)
            }));

            allPolicies.forEach(p => {
                if (!socialData[p.id]) {
                    // 生成假的點讚數（50-500）
                    const fakeLikes = Math.floor(Math.random() * 450) + 50;
                    // 生成假的留言（0-5條）
                    const fakeCommentCount = Math.floor(Math.random() * 6);
                    const fakeComments = [];
                    const comments_samples = [
                        '保障範圍很廣，很滿意！',
                        '理賠快速方便，推薦給朋友',
                        '保費合理，性價比高',
                        '客服態度很好，很專業',
                        '保單條款清楚明白',
                        '投保過程簡單快速',
                        '理賠文件準備很齊全',
                        '保單權益多元化',
                        '客戶服務一流',
                        '保額充足，適合全家'
                    ];
                    for (let i = 0; i < fakeCommentCount; i++) {
                        const randomComment = comments_samples[Math.floor(Math.random() * comments_samples.length)];
                        const randomUser = user_names[Math.floor(Math.random() * user_names.length)];
                        const daysAgo = Math.floor(Math.random() * 30) + 1;
                        const date = new Date();
                        date.setDate(date.getDate() - daysAgo);
                        fakeComments.push({
                            user: randomUser,
                            text: randomComment,
                            date: date.toLocaleString('zh-TW', { hour12: false }).slice(0, 16)
                        });
                    }
                    socialData[p.id] = { likes: fakeLikes, comments: fakeComments, isFollowed: false, isLiked: false };
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
        const categories = ['人壽保險', '健康醫療', '意外傷害', '投資型保險', '還本/年金型保險', '旅遊平安險', '團體保險', '防癌險', '長照險', '儲蓄險', '其他'];

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

    function normalizeSearchText(text) {
        return String(text || '').toLowerCase().replace(/\s+/g, '');
    }

    function isSubsequenceMatch(query, target) {
        if (!query) return true;
        let qi = 0;
        for (let ti = 0; ti < target.length && qi < query.length; ti++) {
            if (target[ti] === query[qi]) qi++;
        }
        return qi === query.length;
    }

    function isLoosePolicyNameMatch(policyName, rawTerm) {
        const name = normalizeSearchText(policyName);
        const term = normalizeSearchText(rawTerm);
        if (!term) return true;
        if (name.includes(term)) return true;
        return isSubsequenceMatch(term, name);
    }

    function renderTopRecommended() {
        // 隱藏推薦區（policy_tab.html 不包含此區）
        if (topContainer) topContainer.style.display = 'none';
    }

    function render() {
        const term = searchInput.value || "";
        let filtered = allPolicies.filter(p => {
            const s = socialData[p.id] || { isFollowed: false };
            const matchesSearch = isLoosePolicyNameMatch(p.name, term);
            const matchesFollow = showFollowedOnly ? s.isFollowed : true;
            const matchesCompany = selectedCompanies.length ? selectedCompanies.includes(p.source) : true;
            const matchesCategory = selectedCategories.length ? p.mappedGroups.some(g => selectedCategories.includes(g)) : true;
            return matchesSearch && matchesFollow && matchesCompany && matchesCategory;
        });

        if (sortSelect.value === 'likes') filtered.sort((a, b) => ((socialData[b.id] || {}).likes || 0) - ((socialData[a.id] || {}).likes || 0));
        else if (sortSelect.value === 'comments') filtered.sort((a, b) => ((socialData[b.id] || {}).comments || []).length - ((socialData[a.id] || {}).comments || []).length);

        resultCountText.textContent = `共 ${filtered.length} 筆結果`;

        container.innerHTML = filtered.map(p => {
            const s = socialData[p.id] || { likes: 0, comments: [], isFollowed: false, isLiked: false };
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
        const s = socialData[id] || { likes: 0, comments: [], isFollowed: false, isLiked: false };
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
                                <span class="comment-user">${c.user || '用戶'}</span>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span class="comment-date">${c.date}</span>
                                    <div class="comment-actions">
                                        <button class="btn-edit" onclick="window.startEdit('${p.id}', ${index})"><i class="fi fi-rr-edit"></i></button>
                                        <button class="btn-delete" onclick="window.deleteComment('${p.id}', ${index})"><i class="fi fi-rr-trash"></i></button>
                                    </div>
                                </div>
                            </div>
                            <div class="comment-text">${c.text}</div>
                        </div>
                    `).join('') : '<p style="color:#999; text-align:center; padding:20px;">還沒有留言，快來分享你的使用心得吧！</p>'}
                </div>
                <div class="comment-form">
                    <textarea id="commentInput" placeholder="分享你的使用心得..."></textarea>
                    <button class="btn-submit-comment" onclick="window.submitComment('${p.id}')">發表心得</button>
                </div>
            </div>
        `;

        document.getElementById('detailModal').classList.add('show');
        if (scrollComment) {
            setTimeout(() => document.getElementById('commentList').scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    window.startEdit = (policyId, index) => {
        const comment = socialData[policyId].comments[index];
        const commentDiv = document.getElementById(`comment-${index}`);
        commentDiv.innerHTML = `
            <div class="comment-meta">
                <span class="comment-user">${comment.user || '用戶'}</span>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="comment-date">${comment.date}</span>
                    <div class="comment-actions">
                        <button class="btn-save" onclick="window.saveEdit('${policyId}', ${index})"><i class="fi fi-rr-check"></i></button>
                        <button class="btn-cancel" onclick="window.cancelEdit('${policyId}', ${index})"><i class="fi fi-rr-cross"></i></button>
                    </div>
                </div>
            </div>
            <textarea id="edit-input-${index}" class="edit-input">${comment.text}</textarea>
        `;
    };

    window.saveEdit = (policyId, index) => {
        const newText = document.getElementById(`edit-input-${index}`).value.trim();
        if (!newText) return;

        if (!socialData[policyId]) socialData[policyId] = { likes: 0, comments: [], isFollowed: false, isLiked: false };

        socialData[policyId].comments[index].text = newText;
        socialData[policyId].comments[index].date += ' (已編輯)';

        save();
        window.openDetail(policyId);
    };

    window.cancelEdit = (policyId, index) => {
        window.openDetail(policyId);
    };

    window.deleteComment = (policyId, index) => {
        if (confirm('確定要刪除這則留言嗎？')) {
            if (!socialData[policyId]) socialData[policyId] = { likes: 0, comments: [], isFollowed: false, isLiked: false };
            socialData[policyId].comments.splice(index, 1);
            save();
            window.openDetail(policyId);
        }
    };

    window.submitComment = (id) => {
        const input = document.getElementById('commentInput');
        const text = input.value.trim();
        if (!text) return;

        if (!socialData[id]) socialData[id] = { likes: 0, comments: [], isFollowed: false, isLiked: false };

        const randomUser = user_names[Math.floor(Math.random() * user_names.length)];

        socialData[id].comments.push({
            user: randomUser,
            text: text,
            date: new Date().toLocaleString('zh-TW', { hour12: false }).slice(0, 16)
        });

        save();
        input.value = '';
        window.openDetail(id, true);
        render();
    };

    window.closeDetailModal = () => document.getElementById('detailModal').classList.remove('show');
    window.doLike = (id, e) => { e.stopPropagation(); if (!socialData[id]) socialData[id] = { likes: 0, comments: [], isFollowed: false, isLiked: false }; socialData[id].isLiked = !socialData[id].isLiked; socialData[id].likes += socialData[id].isLiked ? 1 : -1; save(); render(); };
    window.doFollow = (id, e) => { e.stopPropagation(); if (!socialData[id]) socialData[id] = { likes: 0, comments: [], isFollowed: false, isLiked: false }; socialData[id].isFollowed = !socialData[id].isFollowed; save(); render(); };

    searchInput.addEventListener('input', render);
    sortSelect.addEventListener('change', render);
    filterFollowBtn.addEventListener('click', () => { showFollowedOnly = !showFollowedOnly; filterFollowBtn.classList.toggle('active'); render(); });
    filterToggleBtn.addEventListener('click', () => filterSection.classList.toggle('hidden'));
    clearFiltersBtn.addEventListener('click', () => { selectedCompanies = []; selectedCategories = []; searchInput.value = ''; showFollowedOnly = false; document.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false); render(); });
    window.onclick = (e) => { if (e.target == document.getElementById('detailModal')) window.closeDetailModal(); };

    init();
})();
