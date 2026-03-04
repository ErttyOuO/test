# AI 圖片生成功能優化指南

> **文件目的**：記錄目前 AI 圖片生成與外觀客製化功能的現狀、已知限制，以及日後可使用的 Prompt 來要求 AI 助手進行優化。

---

## 一、目前功能現狀

### 1. AI 保險員外觀客製化流程
- **觸發時機**：選擇 AI 保險員後，跳出確認彈窗詢問「是否要自訂外觀？」
- **流程**：使用者輸入描述 → Gemini API 翻譯為英文繪圖 Prompt → 嘗試本機 Stable Diffusion 生成 → 若失敗則顯示 SVG 保底圖
- **外觀套用**：生成的圖片會套用為 AI 保險員的頭像 & 聊天室背景

### 2. AI 圖片生成 Modal
- **觸發時機**：聊天室中點擊「🖼️ 生成圖片」按鈕
- **支援後端**：AUTOMATIC1111 (port 7860)、ComfyUI (port 8188)、保底 SVG 圖
- **Prompt 增強**：透過 Gemini API 將中文描述改寫為專業英文繪圖 Prompt

### 3. 已知限制
- ⚠️ 無本機 Stable Diffusion 時只能顯示 SVG 保底圖（不是真正的 AI 生成圖）
- ⚠️ Gemini API Key 是硬編碼，未來需改為環境變數或後端代理
- ⚠️ 聊天中的「圖片生成」與「外觀客製化」共用同一個 Modal，流程可能混淆
- ⚠️ 生成圖片無法直接插入聊天訊息中
- ⚠️ ComfyUI 的 workflow 只使用基本節點，未支援 ControlNet 等進階功能

---

## 二、日後優化 Prompt（可直接拿來使用）

### Prompt 1：加入雲端 AI 圖片生成 API
```
請幫我修改 AI 圖片生成功能，增加雲端 API 的支援。目前只支援本機的 AUTOMATIC1111 和 ComfyUI，
我想要增加以下雲端服務作為 fallback：
1. Stability AI (stability.ai) 的 REST API
2. 或 Replicate.com 的 SDXL 模型 API

請在 generateImage() 函式中加入新的 fallback 鏈：
本機 A1111 → 本機 ComfyUI → 雲端 API → SVG 保底圖

API Key 請使用環境變數或從設定頁面讀取，不要硬編碼。
```

### Prompt 2：將生成圖片插入聊天訊息
```
請修改 AI 圖片生成功能，讓生成完成後，圖片可以直接插入到聊天訊息中。
具體需求：
1. Modal 生成完畢後，新增一個「發送到聊天」按鈕
2. 點擊後以 <img> 標籤將圖片嵌入聊天訊息區域
3. 訊息類型標記為 "user-image"，需要有適當的 CSS 樣式
4. AI 可以「看到」這張圖片（在下次 Gemini API 呼叫時帶入圖片描述）
```

### Prompt 3：優化外觀客製化流程的 UX
```
請優化 AI 保險員的外觀客製化流程：
1. 將「確認是否客製化」和「圖片生成」合併為一個更流暢的多步驟 Modal
2. 提供 3-5 個預設外觀模板（如：專業男性、親切女性、可愛卡通...），
   讓使用者可以一鍵選擇，不需要自己輸入描述
3. 加入預覽動畫，讓外觀切換時有過渡效果
4. 記住使用者上次選擇的外觀（存入 localStorage）
```

### Prompt 4：將 API Key 移至後端
```
目前 Gemini API Key 是直接硬編碼在前端 JavaScript 中（搜尋 GEMINI_API_KEY），
這有安全風險。請幫我：
1. 在 server/ 資料夾中新增一個 /api/gemini 的代理路由
2. 前端改為呼叫自己的後端 /api/gemini，由後端轉發到 Google API
3. API Key 用 .env 檔案管理
4. 加入速率限制，避免被濫用
```

### Prompt 5：加入 ControlNet / IP-Adapter 支援
```
目前 ComfyUI 的 workflow 非常基本（只有 KSampler + CLIP + VAE）。
請幫我升級 ComfyUI workflow，支援以下進階功能：
1. IP-Adapter：讓使用者可以上傳一張參考圖片，生成相似風格的保險員
2. ControlNet pose：讓保險員擺出特定姿勢
3. Face detail restoration（如 ReActorNode 或 FaceDetailer）
請在 tryGenerateWithComfyUI() 函式中加入新的 workflow 選項。
```

---

## 三、相關檔案位置

| 檔案 | 說明 |
|------|------|
| `consulting.html` | 包含 customization-confirm-modal 和 image-gen-modal 的 HTML |
| `script.js` | 末尾包含所有 AI 客製化 & 圖片生成相關 JS 函式 |
| `style.css` | 基礎樣式 (Modal 的內嵌樣式在 consulting.html 的 `<style>` 中) |
