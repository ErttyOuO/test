import google.generativeai as genai
import os
import base64
import tempfile
import logging
import json

logger = logging.getLogger(__name__)

_VALID_MOODS = ["neutral", "happy", "nervous", "confused", "worried", "curious", "sad"]
_VALID_SIGNALS = ["worried", "doubtful", "stable", "uncertain"]
_CONSULTATION_SIGNAL_MAPPING = {
    "worried": {
        "label": "較擔心",
        "recommendation_bias": "reassure",
        "reason_default": "表情偏緊張",
    },
    "doubtful": {
        "label": "較疑惑",
        "recommendation_bias": "simplify",
        "reason_default": "疑惑表情偏多",
    },
    "stable": {
        "label": "平穩",
        "recommendation_bias": "normal",
        "reason_default": "表情相對平穩",
    },
    "uncertain": {
        "label": "偵測中",
        "recommendation_bias": "normal",
        "reason_default": "偵測中",
    },
}


def _normalize_consultation_signal(signal: str) -> str:
    normalized = str(signal or "").strip()
    return normalized if normalized in _CONSULTATION_SIGNAL_MAPPING else "uncertain"


def _derive_consultation_fields(
    mood: str,
    confidence: float,
    model_signal: str,
    model_reason: str,
) -> dict:
    # 低信心時一律保守輸出，避免誤導前端。
    if confidence < 0.6:
        return {
            "consultation_signal": "uncertain",
            "recommendation_bias": "normal",
            "reason_short": "偵測中",
        }

    model_signal_normalized = _normalize_consultation_signal(model_signal)

    # 只要 model_signal 非法/未知，一律保守輸出 uncertain，禁止再由 mood 推導成 stable。
    if model_signal_normalized == "uncertain":
        return {
            "consultation_signal": "uncertain",
            "recommendation_bias": "normal",
            "reason_short": "偵測中",
        }

    consultation_signal = model_signal_normalized

    # recommendation_bias 固定由 consultation_signal 映射，避免舊值殘留。
    recommendation_bias = _CONSULTATION_SIGNAL_MAPPING[consultation_signal]["recommendation_bias"]

    reason_short = str(model_reason or "").strip()
    if not reason_short:
        reason_short = _CONSULTATION_SIGNAL_MAPPING[consultation_signal]["reason_default"]

    return {
        "consultation_signal": consultation_signal,
        "recommendation_bias": recommendation_bias,
        "reason_short": reason_short[:24],
    }

def analyze_emotion_from_images(base64_images: list[str]) -> dict:
    """
    接收一個包含多個 base64 編碼圖片的列表（使用者說話期間的截圖）。
    將它們傳送給 Gemini Pro Vision 來綜合判斷使用者的心情。
    """
    try:
        # 使用支援圖片與文字的 2.0-flash 或 1.5-pro/flash
        model = genai.GenerativeModel('gemini-3.1-flash-lite-preview')
        
        prompt = """
        我會提供你使用者在講話期間的臉部截圖。
        請綜合觀察這些圖片中的面部表情、眼神、嘴角等微表情特徵。
        
        請以純 JSON 格式回覆，包含以下欄位：
        1. "mood": 只能是以下其中之一：
           - "happy"    → 明顯微笑、放鬆、開心
           - "neutral"  → 表情平靜、無明顯情緒
           - "curious"  → 眉毛微微上揚，帶有疑問神情
           - "confused" → 眉頭緊皺、困惑彷徨
           - "worried"  → 有些焦慮或擔心，眼神憂慮
           - "nervous"  → 明顯緊張、不安，臉部繃緊
           - "sad"      → 嘴角下垂，有些沮喪或失落
        2. "description": 用一句簡短的繁體中文描述你觀察到的表情特徵。
        3. "confidence": 你對這個判斷的信心程度（0.0 到 1.0 的浮點數）。
          4. "consultation_signal": 只能是以下其中之一：
              - "worried"  → 偏擔心
              - "doubtful" → 偏疑惑
              - "stable"   → 表情穩定
              - "uncertain"→ 無法穩定判定
          5. "recommendation_bias": 只能是以下其中之一：
              - "reassure" → 先補安心感
              - "simplify" → 先簡化說明
              - "normal"   → 一般模式
          6. "reason_short": 8~20 字的繁體中文短句，簡述判斷依據。

          若 confidence 低於 0.6，請保守輸出：
          - consultation_signal = "uncertain"
          - recommendation_bias = "normal"
          - reason_short = "偵測中"
        
        不要輸出任何 markdown 標記（如 ```json），直接輸出 JSON 字串即可。
        """
        
        contents: list[object] = [prompt]
        
        # 準備圖片資料
        for i, b64_str in enumerate(base64_images):
            # 移除可能存在的 data URI 前綴
            if ',' in b64_str:
                b64_str = b64_str.split(',')[1]
                
            image_data = base64.b64decode(b64_str)
            image_parts = {
                "mime_type": "image/jpeg",
                "data": image_data
            }
            contents.append(image_parts)
            
        # 呼叫 Gemini
        response = model.generate_content(contents)
        text = response.text.strip()
        
        # 清理可能包含的 markdown 標記
        if "```json" in text:
            text = text.split("```json")[1]
        if "```" in text:
            text = text.split("```")[0]
            
        text = text.strip()
        
        result = json.loads(text)
        
        # 確保情緒欄位格式正確
        mood = result.get("mood", "neutral")
        if mood not in _VALID_MOODS:
            mood = "neutral"

        try:
            confidence = float(result.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        confidence = max(0.0, min(1.0, confidence))

        consultation_fields = _derive_consultation_fields(
            mood=mood,
            confidence=confidence,
            model_signal=str(result.get("consultation_signal", "")).strip(),
            model_reason=str(result.get("reason_short", "")).strip(),
        )
            
        return {
            "mood": mood,
            "description": result.get("description", "無法具體描述表情"),
            "confidence": confidence,
            "consultation_signal": consultation_fields["consultation_signal"],
            "recommendation_bias": consultation_fields["recommendation_bias"],
            "reason_short": consultation_fields["reason_short"],
        }
        
    except Exception as e:
        logger.error(f"Gemini Vision Error: {e}")
        return {
            "mood": "unknown", 
            "description": f"分析失敗: {str(e)}", 
            "confidence": 0.0,
            "consultation_signal": "uncertain",
            "recommendation_bias": "normal",
            "reason_short": "偵測中",
        }
