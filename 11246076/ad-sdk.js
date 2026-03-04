/**
 * ============================================================
 *  ad-sdk.js — 譯保通 Ad Manager SDK
 *  統一廣告播放 / 投放 / 計費 / 事件記錄
 *  所有頁面載入此檔 + auth.js 即可使用
 * ============================================================
 *
 *  公開 API：
 *    showRewardedAd({ placement, onReward, onCancel })
 *    showBanner(containerId, placement)
 *    pickAdForUser(placement)
 *    recordAdEvent(campaignId, eventType, placement, meta)
 *    chargeSponsor(campaignId, adType, eventType)
 *    ensureRewardedCapReset()
 *    getRewardedCapRemaining()
 *
 *  localStorage keys（集中管理）：
 *    ad_campaigns          — 所有廣告活動
 *    ad_events             — 所有事件記錄
 *    sponsor_profiles      — 贊助商資料 { [userId]: {...} }
 *    sponsor_wallets       — 贊助商錢包 { [userId]: {...} }
 *    sponsor_wallet_history_{id} — 交易紀錄
 *    fallback_creatives    — 平台自家宣傳素材
 */

/* ======================================================================
   常數 & 工具
   ====================================================================== */

const AD_SDK = (() => {
    'use strict';

    // ── 常數 ──
    const REWARDED_DAILY_CAP = 3;
    const REWARDED_DURATION_FREE = 15;      // 秒
    const REWARDED_DURATION_VIP = 5;       // 秒

    // ── 各頁面獎勵設定 ──
    const REWARDED_REWARDS = {
        wallet: { coins: 3, label: '觀看廣告 +3 Coins' },
        sticker: { coins: 0, label: '觀看廣告免費解鎖' },
        checkin: { coins: 0, label: '觀看廣告補簽' }
    };

    // ── House Ad（無贊助商時播放）──
    const HOUSE_AD_CREATIVE = {
        html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#e8e8e8;font-family:Inter,sans-serif;text-align:center;padding:2rem;">
            <div style="font-size:3rem;margin-bottom:1rem;">🏠</div>
            <h2 style="margin-bottom:0.5rem;">譯保通</h2>
            <p style="font-size:0.85rem;color:#aaa;">感謝您的支持！您的獎勵即將到來。</p>
        </div>`
    };

    const LS_CAMPAIGNS = 'ad_campaigns';
    const LS_EVENTS = 'ad_events';
    const LS_SPONSOR_PROFILES = 'sponsor_profiles';
    const LS_SPONSOR_WALLETS = 'sponsor_wallets';
    const LS_FALLBACK = 'fallback_creatives';
    const LS_SYSTEM_SETTINGS = 'system_settings';

    // 預設費率表（admin 可透過 system_settings 覆蓋）
    const FALLBACK_RATES = {
        banner: { impression: 0.5, click: 10 },
        rewarded: { impression: 2, complete: 5, click: 10 }
    };

    // ── 日期工具 ──
    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    function uid() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    // ── localStorage 讀寫 ──
    function lsGet(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; }
        catch { return fallback; }
    }
    function lsSet(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }

    /* ==================================================================
       資料存取
       ================================================================== */

    function getCampaigns() { return lsGet(LS_CAMPAIGNS, []); }
    function saveCampaigns(list) { lsSet(LS_CAMPAIGNS, list); }

    function getEvents() { return lsGet(LS_EVENTS, []); }
    function saveEvents(list) { lsSet(LS_EVENTS, list); }

    function getSponsorProfiles() { return lsGet(LS_SPONSOR_PROFILES, {}); }
    function saveSponsorProfiles(o) { lsSet(LS_SPONSOR_PROFILES, o); }

    function getSponsorWallets() { return lsGet(LS_SPONSOR_WALLETS, {}); }
    function saveSponsorWallets(o) { lsSet(LS_SPONSOR_WALLETS, o); }

    function getSponsorHistory(id) {
        return lsGet('sponsor_wallet_history_' + id, []);
    }
    function saveSponsorHistory(id, list) {
        lsSet('sponsor_wallet_history_' + id, list);
    }

    function getFallbacks() { return lsGet(LS_FALLBACK, []); }
    function saveFallbacks(list) { lsSet(LS_FALLBACK, list); }

    // ── 系統設定（費率預設值等）──
    function getSystemSettings() {
        return lsGet(LS_SYSTEM_SETTINGS, {
            RATES: FALLBACK_RATES
        });
    }
    function saveSystemSettings(s) { lsSet(LS_SYSTEM_SETTINGS, s); }

    /**
     * 根據廣告類型取得費率表
     * @param {'banner'|'rewarded'} type
     * @returns {object} { impression, complete, click }
     */
    function getDefaultRates(type) {
        const s = getSystemSettings();
        const rates = s.RATES || FALLBACK_RATES;
        return rates[type] || FALLBACK_RATES[type];
    }

    /* ==================================================================
       每日 Cap 管理
       ================================================================== */

    /** 跨日歸零（由 showRewardedAd 自動呼叫） */
    function ensureRewardedCapReset() {
        if (typeof getUserData !== 'function') return;
        const data = getUserData();
        const today = todayStr();
        if (data.rewarded_today_date !== today) {
            data.rewarded_today_count = 0;
            data.rewarded_today_date = today;
            saveUserData(data);
        }
    }

    /** 今日剩餘次數 */
    function getRewardedCapRemaining() {
        ensureRewardedCapReset();
        if (typeof getUserData !== 'function') return REWARDED_DAILY_CAP;
        const data = getUserData();
        return Math.max(0, REWARDED_DAILY_CAP - (data.rewarded_today_count || 0));
    }

    /** 消耗一次 */
    function consumeRewardedCap() {
        const data = getUserData();
        data.rewarded_today_count = (data.rewarded_today_count || 0) + 1;
        data.rewarded_today_date = todayStr();
        saveUserData(data);
        // 通知其他元件 cap 已變動
        window.dispatchEvent(new Event('userDataSync'));
    }

    /** cap 資訊（給 UI 使用） */
    function getRewardedCapInfo() {
        const remaining = getRewardedCapRemaining();
        return {
            remaining,
            total: REWARDED_DAILY_CAP,
            exhausted: remaining <= 0
        };
    }

    /* ==================================================================
       投放邏輯 — pickAdForUser
       ================================================================== */

    /**
     * 選出最適合的廣告
     * @param {string} placement - 'rewarded' | 'banner'
     * @returns {object|null} campaign 物件，null 表示無可用廣告
     */
    function pickAdForUser(placement) {
        const campaigns = getCampaigns();
        const profiles = getSponsorProfiles();
        const wallets = getSponsorWallets();
        const today = todayStr();

        // 判斷使用者身份
        let userLevel = 'free';
        let userCreatedAt = '';
        if (typeof getUserData === 'function') {
            const d = getUserData();
            userLevel = d.vip_level || 'free';
            userCreatedAt = d.created_at || '';
        }
        const isVip = (userLevel === 'basic' || userLevel === 'pro');

        // 廣告類型映射
        const adType = (placement === 'banner' || placement?.startsWith('banner')) ? 'banner' : 'rewarded';

        const eligible = campaigns.filter(c => {
            // 1. 狀態
            if (c.status !== 'active') return false;

            // 2. 類型
            if (c.type !== adType) return false;

            // 3. 排程
            if (c.schedule) {
                if (c.schedule.start_date && today < c.schedule.start_date) return false;
                if (c.schedule.end_date && today > c.schedule.end_date) return false;
            }

            // 4. Sponsor 未凍結
            const sp = profiles[c.sponsor_id];
            if (sp && sp.frozen) return false;

            // 5. Sponsor 錢包餘額 >= 該次曝光的最低費用
            const w = wallets[c.sponsor_id];
            const rates = c.budget?.rates || getDefaultRates(c.type);
            const impressionCost = rates.impression || 0;
            if (!w || w.balance < impressionCost) return false;

            // 6. 每日預算
            if (c.budget) {
                // 跨日重置
                if (c.budget.spent_today_date !== today) {
                    c.budget.spent_today = 0;
                    c.budget.spent_today_date = today;
                }
                if (c.budget.daily_limit > 0 && c.budget.spent_today >= c.budget.daily_limit) return false;
                // 總預算
                if (c.budget.total_limit > 0 && c.budget.spent_total >= c.budget.total_limit) return false;
            }

            // 7. 受眾
            if (c.targeting === 'vip' && !isVip) return false;
            if (c.targeting === 'new_users') {
                // 簡化版：註冊 30 天內算新用戶
                if (userCreatedAt) {
                    const diff = (new Date() - new Date(userCreatedAt)) / 86400000;
                    if (diff > 30) return false;
                }
            }

            return true;
        });

        // 儲存可能被改過的 campaigns（spent_today 跨日重置）
        saveCampaigns(campaigns);

        if (eligible.length === 0) return null;

        // 排序：可以依照完整觀看/點擊的潛在收益排序，這裡暫依 click rate 高者優先
        eligible.sort((a, b) => {
            const rA = a.budget?.rates || getDefaultRates(a.type);
            const rB = b.budget?.rates || getDefaultRates(b.type);
            return (rB.click || 0) - (rA.click || 0);
        });
        return eligible[0];
    }

    /* ==================================================================
       事件記錄
       ================================================================== */

    function recordAdEvent(campaignId, eventType, placement, meta) {
        const events = getEvents();
        const userId = (typeof getAuthenticatedUser === 'function')
            ? (getAuthenticatedUser()?.id || 'anon')
            : 'anon';

        events.push({
            id: 'evt_' + uid(),
            campaign_id: campaignId || 'fallback',
            user_id: userId,
            event_type: eventType,      // impression | complete | click | report
            placement: placement || '',
            timestamp: new Date().toISOString(),
            metadata: meta || {}
        });
        saveEvents(events);

        // 若是 impression → 更新 campaign spent_today（曝光時累算每日預算消耗量，但不扣幣）
        // 我們只在 click 時扣 CPC，這裡僅做統計
    }

    /* ==================================================================
       動態計費扣款 (CPM, CPV, CPC)
       ------------------------------------------------------------------
       根據推廣事件類型進行扣款：
         - impression: 廣告曝光
         - complete: 完整觀看 (Rewarded 專屬)
         - click: 點擊廣告 CTA
       ================================================================== */

    function chargeSponsor(campaignId, adType, eventType) {
        if (!['impression', 'complete', 'click'].includes(eventType)) return;

        const campaigns = getCampaigns();
        const camp = campaigns.find(c => c.id === campaignId);
        if (!camp) return;

        // 向下相容：若舊資料使用 cpc 結構，則只在 click 時扣款
        let amount = 0;
        if (camp.budget?.rates) {
            amount = camp.budget.rates[eventType] || 0;
        } else if (eventType === 'click' && camp.budget?.cpc) {
            amount = camp.budget.cpc;
        }

        if (amount <= 0) return;

        const wallets = getSponsorWallets();
        const w = wallets[camp.sponsor_id];
        if (!w) return;

        // 若餘額不足支付該次費用，強制停止活動並放棄扣除
        if (w.balance < amount) {
            camp.status = 'paused';
            saveCampaigns(campaigns);
            console.warn('[AdSDK] Sponsor 餘額不足以支付事件', eventType, '，活動已自動暫停:', camp.name);
            return;
        }

        // 扣款
        w.balance -= amount;
        w.total_spent = (w.total_spent || 0) + amount;

        // 更新 campaign spent
        camp.budget.spent_total = (camp.budget.spent_total || 0) + amount;
        camp.budget.spent_today = (camp.budget.spent_today || 0) + amount;

        saveSponsorWallets(wallets);
        saveCampaigns(campaigns);

        // 寫交易紀錄
        const eventLabels = {
            impression: '曝光',
            complete: '完整觀看',
            click: '點擊'
        };
        const evtLabel = eventLabels[eventType] || eventType;

        const h = getSponsorHistory(camp.sponsor_id);
        h.push({
            id: 'swh_' + uid(),
            type: `charge_${eventType}`,
            amount: -amount,
            label: `${evtLabel} 扣款 — ${camp.name}`,
            campaign_id: campaignId,
            timestamp: new Date().toISOString()
        });
        saveSponsorHistory(camp.sponsor_id, h);
    }

    /* ==================================================================
       Fallback 素材
       ================================================================== */

    function getFallbackCreative(type) {
        const fbs = getFallbacks();
        const match = fbs.filter(f => f.type === type);
        if (match.length === 0) return null;
        return match[Math.floor(Math.random() * match.length)];
    }

    /* ==================================================================
       全螢幕 Rewarded Ad Player — 動態注入 overlay
       ================================================================== */

    /**
     * 顯示獎勵型廣告
     * @param {Object} opts
     * @param {string} opts.placement - 'wallet' | 'sticker' | 'checkin'
     * @param {Function} opts.onReward - 觀看完成後的回呼
     * @param {Function} [opts.onCancel] - 使用者取消或 cap 用完
     */
    function showRewardedAd(opts) {
        const { placement = 'rewarded', onReward, onCancel } = opts;

        // 1. 檢查每日上限
        ensureRewardedCapReset();
        const remaining = getRewardedCapRemaining();
        if (remaining <= 0) {
            _showCapExhaustedToast();
            if (typeof onCancel === 'function') onCancel();
            return;
        }

        // 2. 選廣告
        const campaign = pickAdForUser('rewarded');
        const fallback = campaign ? null : getFallbackCreative('rewarded');

        if (!campaign && !fallback) {
            // 完全沒素材 → 使用 House Ad（平台自家宣傳）作為 fallback
            // 仍然顯示 overlay，讓使用者完整觀看後領取獎勵
        }

        // 3. 判斷影片時長 & VIP 狀態
        let duration = REWARDED_DURATION_FREE;
        let isVip = false;
        if (typeof getUserData === 'function') {
            const data = getUserData();
            const level = data.vip_level || 'free';
            if (level === 'basic' || level === 'pro') {
                duration = REWARDED_DURATION_VIP;
                isVip = true;
            }
        }

        // 4. 建立 overlay
        const campaignId = campaign ? campaign.id : null;
        const creative = campaign
            ? campaign.creative
            : (fallback || HOUSE_AD_CREATIVE);
        const clickUrl = campaign ? campaign.click_url : (fallback?.click_url || '');

        // 記錄 impression
        if (campaignId) {
            recordAdEvent(campaignId, 'impression', placement);
            chargeSponsor(campaignId, 'rewarded', 'impression');
        }

        _createAdOverlay({
            creative,
            duration,
            clickUrl,
            campaignId,
            placement,
            isFallback: !campaign,
            isVip,
            onComplete: () => {
                // 記錄完整觀看
                if (campaignId) {
                    recordAdEvent(campaignId, 'complete', placement);
                    chargeSponsor(campaignId, 'rewarded', 'complete');
                }
                consumeRewardedCap();
                if (typeof onReward === 'function') onReward();
            },
            onClick: () => {
                if (campaignId) {
                    recordAdEvent(campaignId, 'click', placement);
                    chargeSponsor(campaignId, 'rewarded', 'click');
                }
                if (clickUrl) {
                    window.open(clickUrl, '_blank');
                }
            },
            onReport: (reason) => {
                if (campaignId) {
                    recordAdEvent(campaignId, 'report', placement, { reason });
                }
            },
            onCancel
        });
    }

    /* ==================================================================
       Banner 廣告
       ================================================================== */

    function showBanner(containerId, placement) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const campaign = pickAdForUser('banner');
        const fallback = campaign ? null : getFallbackCreative('banner');

        if (!campaign && !fallback) {
            container.style.display = 'none';
            return;
        }

        const creative = campaign ? campaign.creative : fallback;
        const clickUrl = campaign ? campaign.click_url : (fallback?.click_url || '');
        const campaignId = campaign ? campaign.id : null;

        // impression
        if (campaignId) {
            recordAdEvent(campaignId, 'impression', placement);
            chargeSponsor(campaignId, 'banner', 'impression');
        }

        const imgSrc = creative?.data_base64 || '';
        const fileId = creative?.fileId || creative?.file_id;

        // 先用 placeholder，若有 fileId 再非同步載入
        container.innerHTML = `
            <div class="ad-sdk-banner" style="
                cursor:${clickUrl ? 'pointer' : 'default'};
                border-radius:12px;overflow:hidden;position:relative;
                background:#111;text-align:center;
            ">
                <img id="ad-sdk-banner-img" src="${imgSrc}" alt="廣告"
                     style="max-width:100%;height:auto;display:block;margin:0 auto;">
                <span style="position:absolute;top:4px;left:8px;
                    font-size:0.6rem;color:#888;background:rgba(0,0,0,0.5);
                    padding:1px 6px;border-radius:4px;">AD</span>
            </div>`;
        container.style.display = 'block';

        // IndexedDB 非同步載入 banner 圖片
        if (fileId && typeof IDB_FILES !== 'undefined') {
            IDB_FILES.get(fileId).then(rec => {
                if (rec && rec.url) {
                    const img = document.getElementById('ad-sdk-banner-img');
                    if (img) img.src = rec.url;
                }
            }).catch(() => { });
        }

        // Banner click = 點擊 banner 本體 → 記錄 click + 扣點
        container.querySelector('.ad-sdk-banner')?.addEventListener('click', () => {
            if (campaignId) {
                recordAdEvent(campaignId, 'click', placement);
                chargeSponsor(campaignId, 'banner', 'click');
            }
            if (clickUrl) window.open(clickUrl, '_blank');
        });
    }

    /* ==================================================================
       廣告播放 Overlay（內部函式）
       ================================================================== */

    function _createAdOverlay(opts) {
        const {
            creative, duration, clickUrl, campaignId,
            placement, isFallback, isVip,
            onComplete, onClick, onReport, onCancel
        } = opts;

        // 移除舊 overlay
        const old = document.getElementById('ad-sdk-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ad-sdk-overlay';
        overlay.innerHTML = `
<style>
#ad-sdk-overlay {
    position:fixed;inset:0;z-index:99999;
    background:rgba(0,0,0,0.92);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    animation:adFadeIn 0.3s ease;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
@keyframes adFadeIn { from{opacity:0} to{opacity:1} }
#ad-sdk-overlay .ad-label {
    position:absolute;top:16px;left:20px;
    font-size:0.7rem;color:#888;
    background:rgba(255,255,255,0.08);
    padding:3px 10px;border-radius:6px;
}
#ad-sdk-overlay .ad-timer-bar {
    position:absolute;top:0;left:0;width:100%;height:4px;
    background:rgba(255,255,255,0.1);
}
#ad-sdk-overlay .ad-timer-fill {
    height:100%;width:0%;
    background:linear-gradient(90deg,#9CC98D,#7BB369);
    border-radius:0 2px 2px 0;transition:width 0.1s linear;
}
#ad-sdk-overlay .ad-countdown {
    position:absolute;top:16px;right:20px;
    font-size:0.9rem;font-weight:700;color:#fff;
    background:rgba(255,255,255,0.1);
    padding:6px 14px;border-radius:20px;
    min-width:40px;text-align:center;
}
#ad-sdk-overlay .ad-media {
    max-width:90%;max-height:60vh;border-radius:12px;
    box-shadow:0 8px 32px rgba(0,0,0,0.5);
}
#ad-sdk-overlay .ad-media video {
    max-width:100%;max-height:60vh;border-radius:12px;
}
#ad-sdk-overlay .ad-cta {
    margin-top:1.2rem;display:flex;gap:0.8rem;flex-wrap:wrap;justify-content:center;
}
#ad-sdk-overlay .ad-btn {
    padding:0.6rem 1.6rem;border:none;border-radius:10px;
    font-size:0.85rem;font-weight:600;cursor:pointer;transition:all 0.2s;
}
#ad-sdk-overlay .ad-btn.primary {
    background:linear-gradient(135deg,#9CC98D,#7BB369);color:#000;
}
#ad-sdk-overlay .ad-btn.primary:disabled {
    opacity:0.4;cursor:not-allowed;
}
#ad-sdk-overlay .ad-btn.secondary {
    background:rgba(255,255,255,0.08);color:#aaa;
}
#ad-sdk-overlay .ad-btn.report-btn {
    position:absolute;bottom:20px;right:20px;
    background:none;border:1px solid rgba(255,255,255,0.15);
    color:#888;font-size:0.72rem;padding:0.3rem 0.8rem;
    border-radius:6px;cursor:pointer;
}
#ad-sdk-overlay .ad-btn.click-link {
    background:rgba(255,255,255,0.06);color:#9CC98D;
    font-size:0.78rem;padding:0.4rem 1rem;border-radius:8px;
    text-decoration:none;display:inline-block;
}
#ad-sdk-overlay .ad-close-btn {
    position:absolute;top:14px;right:70px;
    width:32px;height:32px;border-radius:50%;
    background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);
    color:#aaa;font-size:1.1rem;line-height:1;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;transition:all 0.2s;
    z-index:10;
}
#ad-sdk-overlay .ad-close-btn:hover {
    background:rgba(255,255,255,0.2);color:#fff;
}
#ad-sdk-overlay .ad-vip-skip {
    padding:0.55rem 1.8rem;border:none;border-radius:12px;
    font-size:0.85rem;font-weight:700;cursor:pointer;
    background:linear-gradient(135deg,#FFD700,#FFA500,#FF8C00);
    color:#1a1a2e;box-shadow:0 0 18px rgba(255,215,0,0.35),0 4px 12px rgba(0,0,0,0.3);
    transition:all 0.25s ease;position:relative;overflow:hidden;
    letter-spacing:0.5px;
}
#ad-sdk-overlay .ad-vip-skip::before {
    content:'';position:absolute;top:-50%;left:-50%;
    width:200%;height:200%;
    background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,0.3) 50%,transparent 70%);
    animation:adVipShine 2.5s ease-in-out infinite;
}
@keyframes adVipShine {
    0%{transform:translateX(-100%) rotate(45deg)}
    100%{transform:translateX(100%) rotate(45deg)}
}
#ad-sdk-overlay .ad-vip-skip:hover {
    transform:scale(1.05);
    box-shadow:0 0 28px rgba(255,215,0,0.5),0 6px 20px rgba(0,0,0,0.4);
}
#ad-sdk-overlay .ad-sponsor-label {
    font-size:0.72rem;color:#666;margin-top:0.6rem;
}
#ad-sdk-close-confirm {
    position:absolute;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;z-index:100000;
    animation:adFadeIn 0.2s ease;
}
#ad-sdk-close-confirm .confirm-card {
    background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);
    border-radius:20px;padding:2rem 1.5rem;max-width:320px;width:90%;
    text-align:center;color:#fff;
}
#ad-sdk-close-confirm .confirm-card h4 {
    margin:0 0 0.6rem;font-size:1.05rem;
}
#ad-sdk-close-confirm .confirm-card p {
    font-size:0.82rem;color:#aaa;margin:0 0 1.2rem;line-height:1.5;
}
#ad-sdk-close-confirm .confirm-actions {
    display:flex;gap:0.7rem;justify-content:center;
}
#ad-sdk-close-confirm .confirm-actions button {
    padding:0.55rem 1.4rem;border:none;border-radius:10px;
    font-size:0.82rem;font-weight:600;cursor:pointer;transition:all 0.2s;
}
#ad-sdk-close-confirm .btn-continue {
    background:linear-gradient(135deg,#9CC98D,#7BB369);color:#000;
}
#ad-sdk-close-confirm .btn-leave {
    background:rgba(255,255,255,0.08);color:#aaa;
}
#ad-sdk-close-confirm .btn-leave:hover {
    background:rgba(255,255,255,0.15);color:#fff;
}
#ad-sdk-report-modal {
    position:absolute;inset:0;background:rgba(0,0,0,0.8);
    display:flex;align-items:center;justify-content:center;z-index:100000;
}
#ad-sdk-report-modal .report-card {
    background:#1a1a2e;border-radius:16px;padding:1.5rem;
    max-width:320px;width:90%;color:#fff;
}
#ad-sdk-report-modal .report-card h4 {
    margin:0 0 0.8rem;font-size:1rem;
}
#ad-sdk-report-modal .report-option {
    display:block;width:100%;text-align:left;
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
    color:#ccc;padding:0.6rem 1rem;border-radius:10px;margin-bottom:0.5rem;
    cursor:pointer;font-size:0.82rem;transition:all 0.2s;
}
#ad-sdk-report-modal .report-option:hover {
    background:rgba(255,255,255,0.12);color:#fff;
}
</style>

<div class="ad-label">${isFallback ? '🏠 平台推薦' : '📢 AD'}</div>
<div class="ad-timer-bar"><div class="ad-timer-fill" id="ad-sdk-fill"></div></div>
<div class="ad-countdown" id="ad-sdk-countdown">${duration}</div>

<div class="ad-media" id="ad-sdk-media"></div>

<button class="ad-close-btn" id="ad-sdk-close-btn" title="關閉廣告">✕</button>

<div class="ad-cta" id="ad-sdk-cta">
    ${isVip ? `<button class="ad-vip-skip" id="ad-sdk-vip-skip">👑 尊爵略過</button>` : ''}
    <button class="ad-btn primary" id="ad-sdk-complete-btn" disabled>
        ⏳ 觀看中 (${duration}s)
    </button>
</div>

${clickUrl ? `<a class="ad-btn click-link" id="ad-sdk-click-link" href="${clickUrl}" target="_blank" rel="noopener" style="margin-top:0.5rem;">🔗 了解更多</a>` : ''}

${!isFallback ? '<button class="ad-btn report-btn" id="ad-sdk-report-btn">🚩 檢舉</button>' : ''}

<div class="ad-sponsor-label" id="ad-sdk-sponsor-label"></div>
`;

        document.body.appendChild(overlay);

        // ── 渲染素材（支援 IndexedDB fileId 或舊版 data_base64）──
        const mediaContainer = document.getElementById('ad-sdk-media');
        if (creative) {
            const fileId = creative.fileId || creative.file_id;
            if (fileId && typeof IDB_FILES !== 'undefined') {
                // 新版：從 IndexedDB 讀取
                mediaContainer.innerHTML = '<div style="color:#666;font-size:0.8rem;">載入中…</div>';
                IDB_FILES.get(fileId).then(rec => {
                    if (!rec || !rec.url) {
                        mediaContainer.innerHTML = '<div style="width:320px;height:200px;background:#1a1a2e;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#555;">📺</div>';
                        return;
                    }
                    const isVideo = (rec.type || '').startsWith('video') || creative.media_type === 'video';
                    if (isVideo) {
                        mediaContainer.innerHTML = `<video src="${rec.url}" autoplay muted playsinline loop style="max-width:100%;max-height:60vh;border-radius:12px;"></video>`;
                    } else {
                        mediaContainer.innerHTML = `<img src="${rec.url}" alt="Ad" style="max-width:100%;max-height:60vh;border-radius:12px;">`;
                    }
                }).catch(() => {
                    mediaContainer.innerHTML = '<div style="width:320px;height:200px;background:#1a1a2e;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#555;">📺</div>';
                });
            } else if (creative.data_base64) {
                // 舊版相容：直接用 base64
                if (creative.media_type === 'video') {
                    mediaContainer.innerHTML = `<video src="${creative.data_base64}" autoplay muted playsinline loop></video>`;
                } else {
                    mediaContainer.innerHTML = `<img src="${creative.data_base64}" alt="Ad" style="max-width:100%;max-height:60vh;border-radius:12px;">`;
                }
            } else if (creative.html) {
                // House Ad 或 HTML 型素材
                mediaContainer.innerHTML = `<div style="width:320px;height:240px;border-radius:12px;overflow:hidden;">${creative.html}</div>`;
            } else {
                mediaContainer.innerHTML = `
                    <div style="width:320px;height:200px;background:linear-gradient(135deg,#1a1a2e,#16213e);
                        border-radius:12px;display:flex;align-items:center;justify-content:center;
                        font-size:2rem;color:#555;">📺</div>`;
            }
        }

        // ── Sponsor 標記 ──
        if (!isFallback && campaignId) {
            const camp = getCampaigns().find(c => c.id === campaignId);
            if (camp) {
                const profiles = getSponsorProfiles();
                const sp = profiles[camp.sponsor_id];
                const label = document.getElementById('ad-sdk-sponsor-label');
                if (sp && label) {
                    label.textContent = `贊助商：${sp.company_name || camp.sponsor_id}`;
                }
            }
        }

        // ── 倒數計時 ──
        const fill = document.getElementById('ad-sdk-fill');
        const countdown = document.getElementById('ad-sdk-countdown');
        const completeBtn = document.getElementById('ad-sdk-complete-btn');
        let elapsed = 0;
        const tick = 100; // ms

        const timer = setInterval(() => {
            elapsed += tick / 1000;
            const pct = Math.min(100, (elapsed / duration) * 100);
            fill.style.width = pct + '%';
            const remain = Math.ceil(duration - elapsed);
            countdown.textContent = remain > 0 ? remain : '✓';

            if (elapsed < duration) {
                completeBtn.textContent = `⏳ 觀看中 (${remain}s)`;
            }

            if (elapsed >= duration) {
                clearInterval(timer);
                completeBtn.disabled = false;
                completeBtn.textContent = '✅ 領取獎勵';
            }
        }, tick);

        // ── 完成按鈕 ──
        completeBtn.addEventListener('click', () => {
            if (completeBtn.disabled) return;
            overlay.remove();
            if (typeof onComplete === 'function') onComplete();
        });

        // ── 點擊連結 (CPC) ──
        const clickLink = document.getElementById('ad-sdk-click-link');
        if (clickLink) {
            clickLink.addEventListener('click', (e) => {
                if (typeof onClick === 'function') onClick();
            });
        }

        // ── 關閉按鈕（提前關閉 → 不給獎勵、不扣額度）──
        const closeBtn = document.getElementById('ad-sdk-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                // 廣告已結束 → 直接關閉（等同放棄領取）
                if (elapsed >= duration) {
                    clearInterval(timer);
                    overlay.remove();
                    if (typeof onCancel === 'function') onCancel();
                    return;
                }
                // 廣告未結束 → 彈出確認視窗
                _showCloseConfirm(overlay, () => {
                    // 使用者確定離開
                    clearInterval(timer);
                    overlay.remove();
                    if (typeof onCancel === 'function') onCancel();
                }, () => {
                    // 使用者選擇繼續觀看（不做任何事）
                });
            });
        }

        // ── VIP 尊爵略過按鈕 ──
        const vipSkipBtn = document.getElementById('ad-sdk-vip-skip');
        if (vipSkipBtn) {
            vipSkipBtn.addEventListener('click', () => {
                clearInterval(timer);
                overlay.remove();
                if (typeof onComplete === 'function') onComplete();
            });
        }

        // ── 檢舉按鈕 ──
        const reportBtn = document.getElementById('ad-sdk-report-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                _showReportModal(overlay, (reason) => {
                    if (typeof onReport === 'function') onReport(reason);
                });
            });
        }
    }

    /* ==================================================================
       關閉確認 Modal
       ================================================================== */

    function _showCloseConfirm(overlay, onLeave, onStay) {
        const existing = document.getElementById('ad-sdk-close-confirm');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'ad-sdk-close-confirm';
        modal.innerHTML = `
            <div class="confirm-card">
                <h4>🛑 確定要關閉廣告嗎？</h4>
                <p>提前關閉將<strong>不會獲得獎勵</strong>，<br>但也不會扣除今日觀看次數。</p>
                <div class="confirm-actions">
                    <button class="btn-continue">繼續觀看</button>
                    <button class="btn-leave">關閉廣告</button>
                </div>
            </div>`;

        overlay.appendChild(modal);

        modal.querySelector('.btn-continue').addEventListener('click', () => {
            modal.remove();
            if (typeof onStay === 'function') onStay();
        });
        modal.querySelector('.btn-leave').addEventListener('click', () => {
            modal.remove();
            if (typeof onLeave === 'function') onLeave();
        });
    }

    /* ==================================================================
       檢舉 Modal
       ================================================================== */

    function _showReportModal(overlay, onSubmit) {
        const existing = document.getElementById('ad-sdk-report-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'ad-sdk-report-modal';
        modal.innerHTML = `
            <div class="report-card">
                <h4>🚩 檢舉此廣告</h4>
                <button class="report-option" data-reason="不適當內容">🚫 不適當內容</button>
                <button class="report-option" data-reason="誤導或詐騙">⚠️ 誤導或詐騙</button>
                <button class="report-option" data-reason="重複出現太多次">🔁 重複出現太多次</button>
                <button class="report-option" data-reason="其他">💬 其他</button>
                <button class="report-option" data-reason="" style="color:#888;border-color:transparent;">取消</button>
            </div>`;

        overlay.appendChild(modal);

        modal.querySelectorAll('.report-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const reason = btn.dataset.reason;
                modal.remove();
                if (reason && typeof onSubmit === 'function') {
                    onSubmit(reason);
                    _showAdToast('✅', '已送出檢舉，感謝回報');
                }
            });
        });
    }

    /* ==================================================================
       Cap 用完 Toast
       ================================================================== */

    function _showCapExhaustedToast() {
        _showAdToast('⏰', `今日觀看次數已達上限（${REWARDED_DAILY_CAP} 次），明天再來！`);
    }

    function _showAdToast(icon, msg) {
        // 嘗試用頁面的 showToast
        if (typeof window.showToast === 'function') {
            window.showToast(icon, msg);
            return;
        }
        // fallback toast
        const old = document.getElementById('ad-sdk-toast');
        if (old) old.remove();

        const t = document.createElement('div');
        t.id = 'ad-sdk-toast';
        t.style.cssText = `
            position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
            background:#1c2333;color:#f0f0f0;padding:0.8rem 1.5rem;
            border-radius:12px;z-index:99999;font-size:0.85rem;
            box-shadow:0 4px 16px rgba(0,0,0,0.4);
            animation:adFadeIn 0.3s ease;
        `;
        t.textContent = `${icon} ${msg}`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    /* ==================================================================
       Campaign 排程與預算工具
       ================================================================== */

    /** 檢查 campaign 是否在有效排程內 */
    function isCampaignActiveNow(campaign, now) {
        if (!campaign || campaign.status !== 'active') return false;
        const d = now || new Date();
        const today = d.toISOString().slice(0, 10);
        const s = campaign.schedule || {};
        if (s.start_date && today < s.start_date) return false;
        if (s.end_date && today > s.end_date) return false;
        return true;
    }

    /** 日切重置所有 campaign 的 spent_today */
    function normalizeCampaignBudgetsToday() {
        const today = todayStr();
        const camps = getCampaigns();
        let changed = false;
        camps.forEach(c => {
            if (c.budget && c.budget._last_reset !== today) {
                c.budget.spent_today = 0;
                c.budget._last_reset = today;
                changed = true;
            }
        });
        if (changed) saveCampaigns(camps);
    }

    /** 預覽 Rewarded 廣告（不計費不扣 cap） */
    function previewRewarded(campaign) {
        _createAdOverlay({
            creative: campaign.creative,
            campaignId: campaign.id,
            clickUrl: campaign.click_url || '',
            isFallback: false,
            placement: 'preview',
            duration: 5,
            onComplete: () => { },
            onClick: () => { },
            onReport: () => { }
        });
    }

    /** 預覽 Banner 廣告（不計費） */
    function previewBanner(container, campaign) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el || !campaign) return;
        const thumb = campaign.creative?.thumbnail_base64 || campaign.creative?.data_base64;
        const fileId = campaign.creative?.fileId || campaign.creative?.file_id;
        if (thumb) {
            el.innerHTML = `<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                <img src="${thumb}" alt="" style="width:100%;display:block;">
                <div style="padding:0.5rem;background:rgba(0,0,0,0.5);font-size:0.75rem;color:#ccc;text-align:center;">預覽模式</div>
            </div>`;
        } else if (fileId && typeof IDB_FILES !== 'undefined') {
            el.innerHTML = `<div style="padding:2rem;text-align:center;background:rgba(255,255,255,0.05);border-radius:12px;color:#888;">載入中…</div>`;
            IDB_FILES.get(fileId).then(rec => {
                if (rec && rec.url) {
                    const isVideo = (rec.type || '').startsWith('video') || campaign.creative?.media_type === 'video';
                    if (isVideo) {
                        el.innerHTML = `<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                            <video src="${rec.url}" autoplay muted playsinline loop style="width:100%;display:block;"></video>
                            <div style="padding:0.5rem;background:rgba(0,0,0,0.5);font-size:0.75rem;color:#ccc;text-align:center;">預覽模式</div>
                        </div>`;
                    } else {
                        el.innerHTML = `<div style="border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                            <img src="${rec.url}" alt="" style="width:100%;display:block;">
                            <div style="padding:0.5rem;background:rgba(0,0,0,0.5);font-size:0.75rem;color:#ccc;text-align:center;">預覽模式</div>
                        </div>`;
                    }
                } else {
                    el.innerHTML = `<div style="padding:2rem;text-align:center;background:rgba(255,255,255,0.05);border-radius:12px;color:#888;">📷 素材遺失</div>`;
                }
            }).catch(() => {
                el.innerHTML = `<div style="padding:2rem;text-align:center;background:rgba(255,255,255,0.05);border-radius:12px;color:#888;">📷 載入失敗</div>`;
            });
        } else {
            el.innerHTML = `<div style="padding:2rem;text-align:center;background:rgba(255,255,255,0.05);border-radius:12px;color:#888;">
                📷 無素材可預覽
            </div>`;
        }
    }

    /* ==================================================================
       公開 API
       ================================================================== */

    return {
        // 核心
        showRewardedAd,
        showBanner,
        pickAdForUser,
        recordAdEvent,
        chargeSponsor,

        // Cap
        ensureRewardedCapReset,
        getRewardedCapRemaining,
        getRewardedCapInfo,

        // Campaign 工具
        isCampaignActiveNow,
        normalizeCampaignBudgetsToday,
        previewRewarded,
        previewBanner,

        // 資料存取（供 dashboard / admin 頁面使用）
        getCampaigns,
        saveCampaigns,
        getEvents,
        saveEvents,
        getSponsorProfiles,
        saveSponsorProfiles,
        getSponsorWallets,
        saveSponsorWallets,
        getSponsorHistory,
        saveSponsorHistory,
        getFallbacks,
        saveFallbacks,

        // 系統設定（CPC 等）
        getSystemSettings,
        saveSystemSettings,
        getDefaultRates,

        // 常數
        REWARDED_DAILY_CAP,
        REWARDED_DURATION_FREE,
        REWARDED_DURATION_VIP,
        REWARDED_REWARDS,
        HOUSE_AD_CREATIVE,

        // 工具
        todayStr,
        uid
    };
})();

/* ======================================================================
   全域快捷函式（讓各頁面直接呼叫，不用寫 AD_SDK.xxx）
   ====================================================================== */

function showRewardedAd(opts) { return AD_SDK.showRewardedAd(opts); }
function showBanner(id, p) { return AD_SDK.showBanner(id, p); }
