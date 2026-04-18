# 性能監測指南 | Performance Monitoring Guide

## 🔍 實時監測工具設置

### 1. Chrome DevTools Performance 監測

#### 步驟:
```
1. F12 打開 DevTools
2. 進入 Performance 標籤
3. 點擊錄製按鈕 (紅色圓形)
4. 執行用戶操作 (滾動、懸停等)
5. 停止錄製，分析結果
```

#### 重點檢查:
- **FPS Graph** - 應保持在綠色 (55-60 FPS)
- **Main Thread** - 應該有大量空閒
- **Rendering** - 應 < 5ms 每幀
- **Painting** - 應 < 3ms 每幀

---

### 2. Chrome DevTools Rendering

#### 啟用性能監測:
```javascript
// 在瀏覽器控制台執行:
// 1. 打開 Show rendering stats
DevTools > More tools > Rendering
// 2. 啟用以下選項:
☑ Paint flashing
☑ Layer borders
☑ FPS meter
```

#### 檢查項:
- 🟢 綠色幀率 = 60 FPS (最佳)
- 🟡 黃色幀率 = 30-50 FPS (可接受)
- 🔴 紅色幀率 = < 30 FPS (需要優化)

---

### 3. Lighthouse 性能審計

#### 本地運行:
```
1. Chrome DevTools > Lighthouse
2. 選擇 "Performance"
3. 點擊 "Analyze page load"
4. 等待報告生成
```

#### 目標分數:
| 指標 | 優化前 | 目標 | 優化後 |
|------|-------|------|-------|
| **Performance** | 65-75 | 90+ | 88-95 |
| **FCP** | 2.8s | < 1.8s | 1.2-1.5s |
| **LCP** | 4.2s | < 2.5s | 1.8-2.2s |
| **CLS** | 0.15 | < 0.1 | 0.05-0.08 |
| **TTI** | 5.1s | < 3.5s | 2.8-3.2s |

---

### 4. WebPageTest 詳細審計

#### 使用方式:
```
1. 訪問 https://www.webpagetest.org
2. 輸入網址
3. 選擇位置 (如: 台灣, 北京)
4. 選擇瀏覽器 (Chrome)
5. 執行測試
```

#### 重點指標:
```
✅ Start Render: < 1.5s
✅ First Contentful Paint: < 1.8s
✅ Largest Contentful Paint: < 2.5s
✅ Time to Interactive: < 3.5s
✅ Cumulative Layout Shift: < 0.1
```

---

### 5. Google Analytics 實時監測

#### 設置事件追蹤:
```javascript
// 動畫性能事件
gtag('event', 'animation_performance', {
    'fps': fps_value,
    'scroll_smooth': true/false,
    'hover_lag': hover_delay_ms
});

// 交互延遲事件
gtag('event', 'interaction_delay', {
    'element': button_or_card,
    'delay_ms': delay_milliseconds
});
```

#### 在 GA4 中查看:
```
1. GA4 dashboard
2. 進入 Realtime
3. 查看自定義事件
4. 監測性能趨勢
```

---

## 📈 監測儀表板設置

### Grafana 監測面板 (如果有後端)

```json
{
  "dashboard": {
    "title": "Frontend Performance",
    "panels": [
      {
        "title": "Scroll FPS",
        "targets": [{"metric": "animation_fps"}],
        "threshold": 55
      },
      {
        "title": "Hover Lag",
        "targets": [{"metric": "hover_delay"}],
        "threshold": 30
      },
      {
        "title": "Reveal Animation Time",
        "targets": [{"metric": "reveal_duration"}],
        "threshold": 400
      }
    ]
  }
}
```

---

## 🧪 自動化測試腳本

### 性能基準測試 (Benchmark)

```javascript
// performance-benchmark.js
(function() {
    // 1. 測量滾動性能
    function measureScrollPerformance() {
        let frames = 0;
        let lastTime = performance.now();
        let currentFPS = 0;
        
        function countFrame() {
            frames++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
                currentFPS = frames;
                console.log('Current FPS:', currentFPS);
                frames = 0;
                lastTime = now;
            }
            requestAnimationFrame(countFrame);
        }
        
        window.addEventListener('scroll', () => {
            countFrame();
        });
    }
    
    // 2. 測量懸停延遲
    function measureHoverDelay() {
        const cards = document.querySelectorAll('.feature-card-late');
        cards.forEach(card => {
            card.addEventListener('mouseenter', function(e) {
                const enterTime = performance.now();
                requestAnimationFrame(function() {
                    const renderTime = performance.now() - enterTime;
                    console.log('Hover delay:', renderTime.toFixed(2), 'ms');
                });
            });
        });
    }
    
    // 3. 測量 Reveal 動畫時間
    function measureRevealTime() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.classList.contains('is-visible')) {
                    const startTime = parseFloat(mutation.target.dataset.revealStart);
                    const revealTime = performance.now() - startTime;
                    console.log('Reveal animation time:', revealTime.toFixed(2), 'ms');
                }
            });
        });
        
        document.querySelectorAll('[data-reveal]').forEach(el => {
            el.dataset.revealStart = performance.now();
            observer.observe(el, { attributes: true });
        });
    }
    
    // 執行所有測試
    if (window.location.hash === '#benchmark') {
        console.clear();
        console.log('🚀 Starting performance benchmarks...');
        measureScrollPerformance();
        measureHoverDelay();
        measureRevealTime();
    }
})();
```

### 使用方式:
```
1. 在瀏覽器控制台加載腳本
2. 訪問 ?benchmark 或 #benchmark
3. 執行頁面上的交互
4. 查看控制台輸出的性能指標
```

---

## 📊 定期檢查清單

### 週檢查 (Weekly)
- [ ] 運行 Lighthouse 審計
- [ ] 檢查 Chrome 性能關鍵指標
- [ ] 測試滾動流暢度
- [ ] 測試卡片懸停反應

### 月檢查 (Monthly)
- [ ] 完整 WebPageTest 分析
- [ ] 檢查 GA 實時性能數據
- [ ] 移動設備性能測試
- [ ] 對比優化前後數據

### 季檢查 (Quarterly)
- [ ] 完整性能審計報告
- [ ] 瀏覽器相容性測試
- [ ] 低端設備測試
- [ ] 網絡速度模擬測試

---

## 🚨 性能告警設置

### 告警條件:

```javascript
// 設置性能告警
const performanceAlerts = {
    FPS_DROP: {
        threshold: 45,
        message: '⚠️ FPS 下降到 45 以下'
    },
    HOVER_LAG: {
        threshold: 50,
        message: '⚠️ 懸停延遲超過 50ms'
    },
    REVEAL_SLOW: {
        threshold: 600,
        message: '⚠️ Reveal 動畫超過 600ms'
    },
    ANIMATION_STUTTER: {
        threshold: 16.67,  // 1 frame @ 60fps
        message: '⚠️ 發現動畫卡頓'
    }
};
```

---

## 📱 移動設備性能測試

### 使用 Chrome DevTools 模擬:

```
1. F12 開啟 DevTools
2. Ctrl+Shift+M 開啟設備模式
3. 選擇特定設備 (如 iPhone 12)
4. 設置網絡: Slow 3G / 4G
5. 設置 CPU 節流: 4x slowdown
6. 測試性能
```

### 推薦測試設備:
- iPhone 12 / 13 (iOS)
- Pixel 5 / 6 (Android)
- iPad Pro (平板)
- 低端 Android 設備

---

## 🎯 性能目標

### Core Web Vitals (必達)
```
✅ LCP (Largest Contentful Paint): < 2.5s
✅ FID (First Input Delay): < 100ms (已棄用，改用 INP)
✅ CLS (Cumulative Layout Shift): < 0.1
✅ INP (Interaction to Next Paint): < 200ms
```

### 自訂指標 (應達)
```
✅ 滾動 FPS: 55-60
✅ 懸停延遲: < 50ms
✅ Reveal 動畫: 300-500ms (已優化)
✅ Float 動畫: 無卡頓
```

---

## 💾 性能數據記錄

### 建議記錄格式:

```json
{
  "date": "2024-03-27",
  "device": "Desktop Chrome",
  "metrics": {
    "fps": 58,
    "hover_delay_ms": 24,
    "reveal_time_ms": 380,
    "scroll_smooth": true,
    "lighthouse_score": 92,
    "fcp_ms": 1250,
    "lcp_ms": 2100,
    "cls": 0.06,
    "inp_ms": 85
  },
  "issues": [],
  "improvements": []
}
```

---

## 🔧 常見問題排查

### 如果 FPS 下降:
1. ☑️ 檢查是否有新的 CSS 動畫被添加
2. ☑️ 驗證 backdrop-filter 是否被重新引入
3. ☑️ 檢查是否有複雜的 JavaScript 計算
4. ☑️ 檢查網絡速度和資源加載

### 如果懸停有延遲:
1. ☑️ 檢查 transition 時間是否被增加
2. ☑️ 驗證是否有複雜的 transform
3. ☑️ 檢查瀏覽器是否在執行其他任務
4. ☑️ 清除瀏覽器緩存重新測試

### 如果 Reveal 動畫不流暢:
1. ☑️ 驗證 IntersectionObserver 是否正常工作
2. ☑️ 檢查是否有多個觀察器衝突
3. ☑️ 確認 CSS transition 值未被覆蓋
4. ☑️ 檢查是否有 JavaScript 阻塞

---

## 📞 性能支持

如遇到性能問題:
1. 收集當前性能指標
2. 創建 WebPageTest 報告
3. 執行 Lighthouse 審計
4. 提供詳細的环境信息
5. 包含瀏覽器和設備型號

---

## 🎓 進階監測

### Real User Monitoring (RUM)

```javascript
// 使用 web-vitals 庫
import {getCLS, getFID, getFCP, getLCP, getTTFB} from 'web-vitals';

function sendToAnalytics(metric) {
    // 發送到分析服務
    fetch('/api/performance', {
        method: 'POST',
        body: JSON.stringify(metric)
    });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### 性能追蹤持久化

```javascript
// 本地存儲性能歷史
const performanceHistory = {
    save: (metric) => {
        let history = JSON.parse(localStorage.getItem('perf_history') || '[]');
        history.push({
            timestamp: Date.now(),
            ...metric
        });
        // 只保留最近 30 天的數據
        history = history.filter(m => Date.now() - m.timestamp < 30 * 24 * 60 * 60 * 1000);
        localStorage.setItem('perf_history', JSON.stringify(history));
    }
};
```

---

祝監測順利！🚀
