# Coins（平台幣）在你的專案裡是怎麼存、怎麼讀、怎麼加減的？

> 你這份專案的「Coins」核心來源 **是 `auth.js` 的使用者資料（user_data）**。  
> 多數頁面都用 `getUserData()` 讀取、用 `saveUserData()` 寫回；然後�� `addHistory()` 記錄交易。

---

## 1) Coins 的「資料來源」是哪一段程式碼？

在你貼的多個頁面中，**直接讀取 Coins 的方式幾乎都長這樣：**

- `const data = getUserData();`
- `data.coins` 就是使用者 Coins

例如：

### (A) `wallet.html`：顯示餘額（讀取 coins）
在 `renderAll()` 裡：

- 讀：`const data = getUserData();`
- 顯示：`document.getElementById('balance-num').textContent = data.coins;`

也就是：**UI 顯示的 coins = `getUserData().coins`**

---

### (B) `sticker-shop.html`：讀取 coins（含 fallback）
在 `getCoins()`：

- 優先：`getUserData().coins`
- fallback：`localStorage.getItem('user_coins')`

所以貼圖商城這頁目前的 coins 來源邏輯是：
1. 有 `auth.js`（有 `getUserData()`）→ 用 `data.coins`
2. 沒有 `auth.js` → 才用 `user_coins`（獨立 key）

> 建議：若你的專案已全面使用 `auth.js`，就可以慢慢把 fallback 的 `user_coins` 淘汰，避免雙系統造成不同步。

---

### (C) `ai-consult.html`：買額度會扣 coins（減少 coins）
在 `buyWithCoins()`：

- 減少 coins：`data.coins -= 10;`
- 存回：`saveUserData(data);`
- 記錄：`addHistory('spend', '解鎖 AI 諮詢 +10 次', -10);`

這裡非常清楚：**扣款就是改 `data.coins` 後 `saveUserData()`**

---

## 2) 如果我開發新的網頁，要怎麼「抓取使用者 coins 數量」？

### 最推薦（標準做法）
1. 先引入 `auth.js`
2. 然後：

```js
const data = getUserData();
const coins = data.coins || 0;
```

> 這樣你拿到的 coins 會跟 wallet / ai-consult / subscription / profile 等頁一致。

### UI 顯示範例
```js
function renderCoins() {
  const coins = (getUserData().coins || 0);
  document.getElementById('my-coins').textContent = coins;
}
```

並且（你專案裡有跨頁同步設計）可以監聽：
```js
window.addEventListener('userDataSync', renderCoins);
```

---

## 3) 如果要增加或減少 coins，應該改哪裡？

你的專案目前「加減 coins」的共通模式是：

1. `let data = getUserData();`
2. 修改 `data.coins`
3. `saveUserData(data);`
4. （建議）`addHistory(...)` 記帳
5. 更新畫面（render）
6. （若 auth.js 內部有 dispatch sync）其他頁就會跟著更新；若沒有，就需要自己觸發同步事件

### (A) 增加 coins（例：給獎勵）
以 `wallet.html` 看廣告獎勵為例（`watchAd()` 的 `onReward`）：

- `data.coins += rewards.coins;`
- `saveUserData(data);`
- `addHistory('earn', rewards.label, rewards.coins);`

你新頁面要加 coins，可以照抄這個模式：

```js
function addCoins(amount, label) {
  const data = getUserData();
  data.coins = (data.coins || 0) + amount;
  saveUserData(data);

  if (typeof addHistory === 'function') {
    addHistory('earn', label || '獲得 Coins', amount);
  }
}
```

### (B) 減少 coins（例：購買 / 解鎖）
以 `ai-consult.html` 為例：

- `data.coins -= 10;`
- `saveUserData(data);`
- `addHistory('spend', ..., -10);`

同理你可以做：

```js
function spendCoins(amount, label) {
  const data = getUserData();
  if ((data.coins || 0) < amount) return false;

  data.coins = (data.coins || 0) - amount;
  saveUserData(data);

  if (typeof addHistory === 'function') {
    addHistory('spend', label || '花費 Coins', -amount);
  }
  return true;
}
```

---

## 4) 你目前 coins 相關程式散落在哪些頁面？（快速索引）

- `wallet.html`
  - 顯示 coins：`renderAll()`
  - 簽到加 coins：`doCheckin()`
  - 看廣告加 coins：`watchAd()`
  - 購買套餐加 coins：`buyPackage()`

- `ai-consult.html`
  - 額度用完購買：`buyWithCoins()`（扣 coins）

- `sticker-shop.html`
  - `getCoins()` / `spendCoins()`（扣 coins，且有 fallback key）
  - 解鎖貼圖：`unlockWithCoins()` → `spendCoins(5)`

- `subscription.html`
  - 顯示 coins：`renderPage()` 裡 `document.getElementById('status-coins').textContent = data.coins;`

- `profile.html`
  - 顯示 coins：`renderProfile()` 裡 `document.getElementById('dc-coins').textContent = data.coins || 0;`

---

## 5) 建議你之後「集中管理 coins」的方向（避免每頁各寫各的）

你現在很多頁面都直接改 `data.coins`，短期 OK，但長期容易：
- 忘記記帳（history）
- 忘記做同步（userDataSync）
- 有的頁面還在用 fallback key（例如 `sticker-shop.html` 的 `user_coins`）

比較乾淨的做法是：把「加減 coins」做成 `auth.js` 的共用函式，例如：
- `addCoins(amount, label)`
- `spendCoins(amount, label)`

這樣新頁面只要呼叫函式，不用重複寫流程。

---

## 你接下來如果要我更精準「指出 coins 在 auth.js 的哪個 key / 哪些函式」  
請把 `auth.js` 也貼上來（或至少貼出 `getUserData()`、`saveUserData()`、`addHistory()` 那段），我就能用同一份 md 檔把 coins 的真正儲存 key、同步機制、以及最推薦的共用封裝寫完整。