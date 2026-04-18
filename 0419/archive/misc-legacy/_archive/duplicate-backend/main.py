from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import time
import base64
import logging

from vision_client import analyze_emotion_from_images
from gemini_client import transcribe_audio, get_gemini_reply, gemini_ready

# 設定 logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Emotion Voice Chatbot API")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/config")
def get_config():
    return {
        "gemini_ready": gemini_ready
    }

@app.post("/chat")
async def chat_endpoint(
    audio: UploadFile = File(None, description="使用者錄音檔 (WebM)"),
    text: str = Form(None, description="使用者直接輸入的文字"),
    images: List[str] = Form(default=[], description="對話期間的截圖(Base64編碼)"),
    enable_gemini: bool = Form(True, description="是否啟用 Gemini AI")
):
    """
    接收語音錄音檔與多張截圖：
    1. 語音 -> Gemini -> 文字
    2. 截圖 -> Gemini Vision -> 情緒
    3. 文字 + 情緒 -> Gemini -> AI 回覆
    """
    
    start_time = time.time()
    user_text = ""
    mood = "unknown"
    emotion_desc = "未提供影像"
    confidence = 0.0
    reply = ""
    
    # 1. 處理音訊 (STT) 或 直接使用文字
    if text:
        user_text = text.strip()
        logger.info(f"收到文字輸入: {user_text}")
    elif audio and enable_gemini:
        logger.info(f"收到聲音檔案: {audio.filename}, Content-Type: {audio.content_type}")
        audio_bytes = await audio.read()
        if len(audio_bytes) > 0:
            user_text = transcribe_audio(audio_bytes, audio.content_type)
        else:
            user_text = "（沒有錄到聲音）"
    elif not audio:
        user_text = "（未提供音訊檔案）"
    else:
        user_text = "（AI 分析已關閉）"

    # 2. 處理影像 (Emotion Analysis)
    if images and enable_gemini:
        logger.info(f"收到 {len(images)} 張影像準備分析情緒")
        emotion_result = analyze_emotion_from_images(images)
        mood = emotion_result.get("mood", "unknown")
        emotion_desc = emotion_result.get("description", "")
        confidence = emotion_result.get("confidence", 0.0)
    elif not enable_gemini:
        mood = "disabled"
        emotion_desc = "Gemini 分析已手動關閉"

    # 3. 產生對話回覆 (Chat)
    if enable_gemini and user_text and user_text != "（沒有錄到聲音）" and user_text != "（未提供音訊檔案）":
        logger.info(f"開始產生 AI 回覆...")
        reply = get_gemini_reply(user_text, mood, emotion_desc)
    elif not enable_gemini:
        reply = "Gemini 功能已停用。"
    else:
        reply = "因為沒有清楚聽到你說的話，所以我無法回答喔。"
        
    process_time = time.time() - start_time
    logger.info(f"請求處理完成，花費 {process_time:.2f} 秒")
    
    return {
        "user_text": user_text,
        "emotion": {
            "mood": mood,
            "description": emotion_desc,
            "confidence": confidence
        },
        "gemini_reply": reply,
        "ts": int(time.time() * 1000)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
