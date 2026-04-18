from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
import io
from PIL import Image
import json
import random
from typing import Optional, Dict, Any

app = FastAPI(title="百保袋 AI 對話整合系統", version="1.0.0")

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生產環境中應該設定特定域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 模擬的情緒偵測結果
EMOTION_RESPONSES = [
    {"emotion": "happy", "confidence": 0.85},
    {"emotion": "neutral", "confidence": 0.72},
    {"emotion": "focused", "confidence": 0.68},
    {"emotion": "calm", "confidence": 0.79},
    {"emotion": "happy", "confidence": 0.91},
    {"emotion": "neutral", "confidence": 0.65},
]

# 根據情緒生成的回應模板 - 升級版
EMOTION_RESPONSES_TEMPLATES = {
    "happy": {
        "greeting": ["看到你心情這麼好，我也很開心！😊", "你的笑容很有感染力！✨", "心情不錯呢！讓我們繼續保持這份正能量！🌟"],
        "insurance": [
            "心情好的時候規劃保險最適合了！讓我們聊聊如何保障你的美好生活。",
            "你的正面態度很棒！保險就是為了讓我們能一直這樣安心生活。",
            "看到你這麼有活力，我推薦你考慮包含意外險的綜合保障，讓你勇於嘗試各種可能！"
        ],
        "response_style": "語氣活潑、正面、鼓勵性"
    },
    "sad": {
        "greeting": ["我感受到你有些憂慮，別擔心，我在這裡陪著你。🤗", "心情不太好嗎？讓我給你一個溫暖的擁抱。💙", "我能理解你現在的感受，需要聊聊嗎？"],
        "insurance": [
            "有時候適當的保障能讓我們更有安全感面對生活的挑戰。",
            "讓我們聊聊如何透過保險來增加一些安全感，好嗎？",
            "我知道現在可能不是談論保險的最佳時機，但或許一些保障規劃能讓你感覺好一些。"
        ],
        "response_style": "語氣溫柔、安撫、同理心"
    },
    "angry": {
        "greeting": ["我理解你現在可能有些煩躁，讓我們深呼吸，冷靜下來。😌", "看起來你有些困擾，我能幫你什麼嗎？", "我能感受到你的不滿，讓我們一起找出解決方法。"],
        "insurance": [
            "煩躁的時候更需要穩定的保障，讓我們聊聊如何建立你的安全網。",
            "我知道你可能覺得保險很複雜，讓我為你簡單說明，好嗎？",
            "讓我們一步一步來，我會幫你找到最適合、最簡單的保障方案。"
        ],
        "response_style": "語氣冷靜、緩和、避免衝突"
    },
    "neutral": {
        "greeting": ["你好！我是你的百保袋 AI 助手。👋", "很高興為你服務！有什麼可以幫助你的嗎？", "讓我們開始吧！我很樂意協助你。"],
        "insurance": [
            "讓我們聊聊你的保險需求吧！我可以根據你的情況提供適合的建議。",
            "有什麼保險相關的問題想了解嗎？我會詳細為你說明。",
            "保險規劃是很重要的決定，讓我幫你找到最適合的方案。"
        ],
        "response_style": "語氣專業、中性、資訊豐富"
    },
    "focused": {
        "greeting": ["看起來你很專注，這是討論重要議題的好狀態！🎯", "你現在的專注度很高，正是思考未來的最佳時機。", "我感受到你認真的態度，讓我們仔細規劃。"],
        "insurance": [
            "以你現在的專注狀態，我們可以深入探討各種保險方案的細節。",
            "讓我為你提供詳細的保險分析，幫助你做出最明智的決定。",
            "你很認真呢！讓我們一起制定最完善的保障計畫。"
        ],
        "response_style": "語氣認真、深入、資訊詳實"
    },
    "calm": {
        "greeting": ["你現在很平靜，這是做重要決定的好時機。😌", "保持這份平靜的心境，讓我們一起思考。", "你的沉穩讓對話更加順暢。"],
        "insurance": [
            "平靜的心境最適合規劃未來，讓我們聊聊你的保險需求。",
            "讓我們以冷靜理性的態度，為你找到最適合的保障方案。",
            "你的沉著讓我印象深刻，讓我們一起制定穩健的保障計畫。"
        ],
        "response_style": "語氣平穩、理性、令人安心"
    }
}

@app.get("/")
async def root():
    return {"message": "百保袋 AI 對話整合系統 API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "unified-chat-api"}

@app.post("/api/emotion-detect")
async def detect_emotion(request: Dict[str, Any]):
    """
    情緒偵測 API
    接收 base64 編碼的圖片，回傳情緒分析結果
    """
    try:
        image_data = request.get("image")
        if not image_data:
            raise HTTPException(status_code=400, detail="缺少圖片資料")

        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]

        emotion_result = random.choice(EMOTION_RESPONSES)

        return {
            "emotion": emotion_result["emotion"],
            "confidence": emotion_result["confidence"],
            "timestamp": str(random.randint(1000000000, 9999999999))
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"情緒偵測失敗: {str(e)}")

@app.post("/api/chat")
async def chat_with_ai(request: Dict[str, Any]):
    """
    AI 對話 API - 升級版
    接收使用者的訊息和情緒狀態，回傳更智能的 AI 回應
    """
    try:
        message = request.get("message", "")
        emotion = request.get("emotion", "neutral")
        context = request.get("context", [])

        if not message:
            raise HTTPException(status_code=400, detail="缺少訊息內容")

        emotion_template = EMOTION_RESPONSES_TEMPLATES.get(emotion, EMOTION_RESPONSES_TEMPLATES["neutral"])
        is_first_message = len(context) <= 1

        if is_first_message:
            response = random.choice(emotion_template["greeting"])
        elif any(keyword in message.lower() for keyword in ["保險", "保障", "理賠", "保單", "保費"]):
            if "醫療" in message or "健康" in message or "看病" in message:
                response = f"{random.choice(emotion_template['insurance'])} 醫療保險是很重要的保障！我可以幫你分析不同類型的醫療保險，包括實支實付、住院醫療等。你比較關心哪方面的保障呢？"
            elif "意外" in message or "傷害" in message:
                response = f"{random.choice(emotion_template['insurance'])} 意外險提供意外傷害和意外失能的保障，費用相對較低但保障範圍廣。你有特定的職業或運動習慣需要考慮嗎？"
            elif "壽險" in message or "人壽" in message or "身故" in message:
                response = f"{random.choice(emotion_template['insurance'])} 人壽保險是對家人最重要的責任保障。我可以幫你計算適合的保額，讓你在萬一時仍能照顧家人。"
            elif "癌症" in message or "重大疾病" in message or "重疾" in message:
                response = f"{random.choice(emotion_template['insurance'])} 重大疾病險提供一次性給付，讓你有足夠的費用接受治療和休養。現代人壓力大，這份保障很重要哦！"
            elif "儲蓄" in message or "投資" in message or "還本" in message:
                response = f"{random.choice(emotion_template['insurance'])} 儲蓄險結合保障和投資功能，適合長期規劃。讓我幫你分析不同商品的收益率和保障內容。"
            else:
                response = f"{random.choice(emotion_template['insurance'])} 有什麼特定的保險類型想了解嗎？我可以為你詳細說明保障內容和注意事項。"
        elif any(keyword in message.lower() for keyword in ["多少錢", "費用", "價格", "便宜", "貴"]):
            if emotion == "sad":
                response = "我理解你對費用的擔憂。保險其實有很多不同價位的選擇，讓我幫你找到符合預算的保障方案，好嗎？"
            elif emotion == "happy":
                response = "很好的問題！讓我為你介紹一些CP值很高的保障方案，用最少的預算獲得最大的保障！"
            else:
                response = "保險費用會根據年齡、性別、保障內容等因素而定。讓我幫你做個免費的保費試算，好嗎？"
        elif any(keyword in message.lower() for keyword in ["你好", "嗨", "哈囉", "謝謝", "感謝"]):
            response = random.choice(emotion_template["greeting"])
        elif any(keyword in message.lower() for keyword in ["再見", "拜拜", "結束"]):
            if emotion == "sad":
                response = "別擔心，我隨時都在這裡等你。有需要時隨時回來聊聊，好嗎？💙"
            elif emotion == "happy":
                response = "很高興今天能幫到你！記得保持這份好心情，下次見！😊"
            else:
                response = "感謝你的諮詢，有需要時隨時回來。祝你一切順利！👋"
        else:
            if emotion == "happy":
                response = "你的正能量很棒！讓我們把這份好心情轉化為對未來的保障規劃，好嗎？"
            elif emotion == "sad":
                response = "我在這裡陪著你。有時候聊聊實際的保障規劃，反而能讓我們感覺更安心一些。"
            elif emotion == "angry":
                response = "讓我們冷靜下來，一步一步解決問題。有什麼具體的保險問題想了解嗎？"
            else:
                response = random.choice(emotion_template["greeting"]) + " 有什麼我可以幫助你的嗎？"

        import time
        time.sleep(0.5)

        return {
            "response": response,
            "emotion": emotion,
            "confidence": random.uniform(0.75, 0.95),
            "response_style": emotion_template["response_style"],
            "timestamp": str(random.randint(1000000000, 9999999999))
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 對話失敗: {str(e)}")

@app.post("/api/voice-input")
async def process_voice_input(audio: UploadFile = File(...)):
    """
    語音輸入處理 API
    接收音訊檔案，回傳文字轉錄結果
    """
    try:
        if not audio.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="檔案必須是音訊格式")

        await audio.read()

        mock_transcriptions = [
            "我想了解保險的相關資訊",
            "什麼是醫療保險",
            "意外險的保障範圍是什麼",
            "人壽保險有必要買嗎",
            "請幫我推薦適合的保單",
            "保險理賠的流程是什麼"
        ]

        transcribed_text = random.choice(mock_transcriptions)

        return {
            "text": transcribed_text,
            "confidence": random.uniform(0.8, 0.95),
            "language": "zh-TW"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"語音處理失敗: {str(e)}")

@app.post("/api/avatar-response")
async def avatar_response(request: Dict[str, Any]):
    """
    Avatar 回應 API
    根據情緒和回應內容生成 Avatar 的表情和動作
    """
    try:
        emotion = request.get("emotion", "neutral")
        response_text = request.get("response", "")

        avatar_expressions = {
            "happy": "smile",
            "sad": "concerned",
            "angry": "calm",
            "neutral": "neutral",
            "focused": "thinking",
            "calm": "relaxed"
        }

        expression = avatar_expressions.get(emotion, "neutral")

        if len(response_text) > 100:
            animation = "talking_long"
        elif len(response_text) > 50:
            animation = "talking_medium"
        else:
            animation = "talking_short"

        return {
            "expression": expression,
            "animation": animation,
            "duration": len(response_text) * 0.1,
            "timestamp": str(random.randint(1000000000, 9999999999))
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Avatar 回應生成失敗: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
