# AI 語音情緒陪伴助手 - 後端

這是一個基於 FastAPI 的後端伺服器，負責接收前端傳來的錄音檔與連續影像截圖，並使用 **Google Gemini API** 來進行：
1. 語音轉文字 (STT)
2. 透過影像判讀使用者情緒 (Gemini Vision)
3. 產生貼心對話回覆

這裡 **完全移除了過往笨重的 DeepFace、Tensorflow** 等本機機器學習模型。所有的運算都透過呼叫超輕量級的 API 完成，您的電腦不需要下載幾 GB 的模型檔，也不會有任何效能負擔。

---

## 快速啟動指南 (本機執行)

### 第一步：安裝 Python 套件

請打開終端機 (Terminal 或 PowerShell)，並確認目前路徑在 `backend` 資料夾下，然後執行：

```bash
pip install -r requirements.txt
```

> **注意**：新的架構超級輕量，現在只需要安裝 `fastapi`, `uvicorn`, `python-multipart`, 與 `google-generativeai` 即可。不會再有麻煩的環境相容性問題！

### 第二步：設定環境變數

在 `backend` 目錄下建立一個 `.env` 檔案（如果已經有就不需要重建），內容如下：

```env
# 填入您自己的 Google Gemini API 授權金鑰
GEMINI_API_KEY=your_gemini_api_key_here
```

### 第三步：啟動伺服器

執行以下指令啟動 FastAPI 後端：

```bash
uvicorn main:app --reload --port 8000
```

啟動成功後，您應該會看到 `Uvicorn running on http://0.0.0.0:8000` 的訊息。

### 第四步：測試是否成功

您可以開啟瀏覽器，輸入 `http://localhost:8000/config`，如果看到以下畫面，代表設定大成功！

```json
{"gemini_ready":true}
```

---

## 串接說明

前端只要將 WebM 錄音檔與 Base64 截圖打包成 `multipart/form-data`，對 `http://localhost:8000/chat` 發送 POST 請求，即可處理互動並獲得回傳 JSON。
