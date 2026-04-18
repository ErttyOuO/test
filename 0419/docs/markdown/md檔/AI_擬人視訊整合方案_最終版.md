# AI 擬人視訊整合方案（最終版）

## 🎯 專案目標
建立一個：
👉 可視訊 + 可語音 + 可打字 + 有情緒反應 + 擬人化 Avatar 的 AI 虛擬主播系統

---

## 🧠 核心整合策略

### ❗ 不做拼接，只做單一主流程
所有系統（視訊 / 情緒 / 語音 / 聊天 / Avatar）必須整合成：

使用者 → 輸入 → AI → 回應 → Avatar → UI

---

## 🧩 一、主頁統一

### ✅ 唯一入口
- consulting.html = 最終 AI 視訊頁
- 不再跳轉其他頁（例如面容情緒偵測頁）

---

## 😊 二、情緒系統（融合）

### 來源融合
- 面容情緒偵測/frontend → webcam + canvas + 情緒流程
- unified-chat-components → UI + 管理

### 統一輸出格式
```js
{
  emotion: "happy",
  confidence: 0.82,
  source: "camera",
  updatedAt: Date.now()
}
```

👉 所有系統只吃這一份

---

## 💬 三、對話系統（統一）

所有輸入：
- 語音
- 打字

全部進：

```js
messages[]
```

```js
addMessage("user", text)
addMessage("assistant", reply)
```

AI 回應同時觸發：
1. UI 顯示
2. 語音播放
3. Avatar 動作

---

## 🎥 四、UI 結構

### 視訊主畫面
- AI Avatar（主畫面）
- 使用者 webcam（右下角）

### 下方
- 聊天紀錄（必須存在）
- 輸入框（語音 + 打字）

---

## 🎭 五、Avatar（虛擬主播）

### 目標
👉 像虛擬主播（不是普通3D人）

### 必備能力
- 嘴型同步
- 表情切換
- 狀態變化
- 微動作

---

## 🔄 六、狀態機（核心）

```js
state = "idle" | "listening" | "thinking" | "speaking"
```

### 對應行為

- idle：待機（呼吸感）
- listening：聆聽（微動）
- thinking：思考（停頓）
- speaking：說話（嘴型 + 表情）

---

## 🔊 七、語音策略

👉 先用目前專案最新版本

優先：
- 流程打通
- 同步 UI + Avatar

之後再升級聲線

---

## 🧠 八、後端統一

### 主後端
👉 face_backend

### start_all.ps1
- 保留（開發用）
- 但只啟動必要服務

---

## 🚀 九、整合步驟

### STEP 1
統一主頁（consulting.html）

### STEP 2
搬 webcam + emotion

### STEP 3
統一 message flow

### STEP 4
整合聊天紀錄 + UI

### STEP 5
建立 Avatar 狀態機

### STEP 6
升級虛擬主播效果

---

## 🧠 十、最重要原則

❌ 不再新增新系統  
❌ 不再複製頁面  
❌ 不再多後端  

✅ 單一流程  
✅ 單一來源  
✅ 單一 Avatar  

---

## 🎯 最終成果

👉 一個像虛擬主播的 AI 顧問

可以：
- 面對面視訊
- 語音對話
- 打字互動
- 有聊天紀錄
- 有情緒反應
- 有表情與嘴型

