import os
import tempfile
import logging
import json
import re

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEBUG_RECOMMENDATION_STUB = str(os.getenv("DEBUG_RECOMMENDATION_STUB", "")).strip().lower() in {"1", "true", "yes", "on"}
GEMINI_CHAT_REQUEST_TIMEOUT_SECONDS = float(os.getenv("GEMINI_CHAT_REQUEST_TIMEOUT_SECONDS", "20"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
gemini_ready = False

model = None
if GENAI_AVAILABLE and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        # 預設使用較穩定快速的模型，避免 preview 版本頻繁 504。
        model = genai.GenerativeModel(GEMINI_MODEL)
        gemini_ready = True
    except Exception as e:
        logger.error(f"Failed to initialize Gemini: {e}")
        gemini_ready = False


def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> dict:
    """
    將使用者傳來的錄音檔轉換成文字 (STT) 以及聲音情緒特徵
    使用 inline_data (base64) 方式傳送，相容所有版本的 google-generativeai
    """
    default_result = {
        "transcript": "（聽不清楚錄音內容）",
        "voice_mood": "neutral",
        "tone": "calm",
        "urgency": 0,
        "confidence": 0.0
    }

    if not gemini_ready or not model:
        default_result["transcript"] = "Gemini 尚未設定，無法辨識語音。"
        return default_result

    try:
        import base64

        mime_type = "audio/mp4" if "mp4" in content_type else content_type
        if "webm" in mime_type:
            mime_type = "audio/webm"

        audio_part = {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(audio_bytes).decode("utf-8")
            }
        }

        prompt = """你是語音語氣分析器。只輸出 JSON，禁止任何解釋文字。
先看聲學線索，再用語意輔助；不可只看語意。
聲學優先順序：1語速 2音量變化 3音高起伏 4停頓密度 5重音/爆發感。
若聲學線索不足或互相矛盾：voice_mood=neutral, tone=calm。
不要因一句抱怨直接判 angry。
frustrated=不耐煩/煩躁/卡住/悶怒（未必爆發）。
angry=明顯強烈、衝擊感高、爆發式語氣。
anxious=緊張、急、猶豫、不安感。
asking 只在明顯詢問語氣使用。
urgent 只在真的急迫時使用，不可和 asking 混用。
若 confidence < 0.55，必須輸出：voice_mood=neutral, tone=calm, urgency=0。
transcript 必須是繁體中文逐字稿，不要摘要、不要時間戳。
若聽不清楚，transcript=「（聽不清楚錄音內容）」。

Few-shot examples：
Example 1
Input: "我想問一下這個保障範圍是什麼？"
Output:
{
    "transcript": "我想問一下這個保障範圍是什麼？",
    "voice_mood": "neutral",
    "tone": "asking",
    "urgency": 0,
    "confidence": 0.72
}

Example 2
Input: "這流程我卡很久了，真的很麻煩。"
Output:
{
    "transcript": "這流程我卡很久了，真的很麻煩。",
    "voice_mood": "frustrated",
    "tone": "complaining",
    "urgency": 1,
    "confidence": 0.78
}

Example 3
Input: "現在立刻幫我處理，我趕時間！"
Output:
{
    "transcript": "現在立刻幫我處理，我趕時間！",
    "voice_mood": "anxious",
    "tone": "urgent",
    "urgency": 2,
    "confidence": 0.84
}

Example 4
Input: "你們到底在拖什麼，馬上給我處理！"
Output:
{
    "transcript": "你們到底在拖什麼，馬上給我處理！",
    "voice_mood": "angry",
    "tone": "urgent",
    "urgency": 2,
    "confidence": 0.87
}

Example 5
Input: "（雜音、斷續，內容不清）"
Output:
{
    "transcript": "（聽不清楚錄音內容）",
    "voice_mood": "neutral",
    "tone": "calm",
    "urgency": 0,
    "confidence": 0.40
}

輸出格式：
{
  "transcript": "...",
  "voice_mood": "neutral|happy|sad|angry|anxious|frustrated",
  "tone": "calm|urgent|hesitant|complaining|asking|excited",
  "urgency": 0|1|2,
  "confidence": 0.0~1.0
}"""

        response_schema = {
            "type": "object",
            "properties": {
                "transcript": {"type": "string"},
                "voice_mood": {
                    "type": "string",
                    "enum": ["neutral", "happy", "sad", "angry", "anxious", "frustrated"]
                },
                "tone": {
                    "type": "string",
                    "enum": ["calm", "urgent", "hesitant", "complaining", "asking", "excited"]
                },
                "urgency": {"type": "integer", "minimum": 0, "maximum": 2},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1}
            },
            "required": ["transcript", "voice_mood", "tone", "urgency", "confidence"]
        }

        # SDK 相容策略：若支援 response_schema 則使用結構化輸出；
        # 若不支援，退回官方相容的 response_mime_type=json，並依賴既有 fallback parsing。
        generation_config = {
            "temperature": 0.1,
            "response_mime_type": "application/json"
        }
        schema_enabled = False
        try:
            from google.generativeai import types as genai_types
            generation_config = genai_types.GenerationConfig(
                temperature=0.1,
                response_mime_type="application/json",
                response_schema=response_schema
            )
            schema_enabled = True
        except Exception as e:
            logger.info(f"response_schema not enabled in current SDK/runtime, fallback to JSON mode: {e}")

        response = model.generate_content(
            [prompt, audio_part],
            generation_config=generation_config
        )
        text = response.text.strip()

        def _safe_json_parse(raw_text: str):
            cleaned = raw_text.strip()
            if not cleaned:
                return None

            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                if lines and lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                cleaned = "\n".join(lines).strip()

            m = re.search(r"\{[\s\S]*\}", cleaned)
            candidate = m.group(0) if m else cleaned
            try:
                return json.loads(candidate)
            except Exception:
                return None

        # 即使 schema_enabled=True，仍保留 fallback 與欄位驗證，避免模型輸出漂移
        parsed = _safe_json_parse(text)
        if not isinstance(parsed, dict):
            default_result["transcript"] = text if len(text) > 0 else "（聽不清楚錄音內容）"
            return default_result

        valid_voice_moods = {"neutral", "happy", "sad", "angry", "anxious", "frustrated"}
        valid_tones = {"calm", "urgent", "hesitant", "complaining", "asking", "excited"}

        result = dict(default_result)
        raw_transcript = str(parsed.get("transcript", "")).strip()
        result["transcript"] = raw_transcript if raw_transcript else default_result["transcript"]

        vm = str(parsed.get("voice_mood", default_result["voice_mood"]))
        result["voice_mood"] = vm if vm in valid_voice_moods else default_result["voice_mood"]

        tone = str(parsed.get("tone", default_result["tone"]))
        result["tone"] = tone if tone in valid_tones else default_result["tone"]

        try:
            urgency = int(parsed.get("urgency", default_result["urgency"]))
        except Exception:
            urgency = default_result["urgency"]
        result["urgency"] = max(0, min(2, urgency))

        # confidence 解析失敗時預設 0.0
        try:
            confidence = float(parsed.get("confidence", 0.0))
        except Exception:
            confidence = 0.0
        result["confidence"] = max(0.0, min(1.0, confidence))

        # transcript 空字串或低信心，一律 fallback 成 neutral/calm/0
        if not raw_transcript or result["confidence"] < 0.55:
            result["voice_mood"] = "neutral"
            result["tone"] = "calm"
            result["urgency"] = 0

        return result

    except Exception as e:
        logger.error(f"Gemini Audio Transcription Error: {e}")
        default_result["transcript"] = f"語音辨識發生錯誤: {str(e)}"
        return default_result


def get_gemini_reply_stream(
    user_text: str,
    mood: str,
    expression_desc: str,
    policy_context: str = "",
    chat_history: list = None,
    voice_analysis: dict = None,
    recommendation_context: str = "",
    recommendation_preview: dict = None,
    allow_recommendations: bool = True,
):
    """
    根據使用者說的話 + 即時表情情緒 + 聲音情緒 + 歷史對話紀錄，使用 streaming 方式產生貼心的回覆。
    """
    def _parse_recommendation_context(ctx: str) -> dict:
        parsed = {}
        for line in str(ctx or "").splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if key and value:
                parsed[key] = value
        return parsed

    def _build_debug_stub_reply() -> str:
        user_question = (user_text or "").strip() or "你剛剛的問題"
        first_sentence = f"先回到你這次的問題：{user_question}，我會先用重點方式幫你釐清。"

        if not recommendation_context:
            return " ".join([
                first_sentence,
                "你可以先看保障範圍、理賠條件與等待期，我再陪你一步步比對差異。"
            ])

        parsed = _parse_recommendation_context(recommendation_context)
        top_title = ""
        top_category = ""
        top_reason = ""

        if isinstance(recommendation_preview, dict):
            top_title = str(recommendation_preview.get("title") or "").strip()
            top_category = str(recommendation_preview.get("category") or "").strip()
            top_reason = str(recommendation_preview.get("recommendation_reason_short") or "").strip()

        if not top_title:
            top_title = parsed.get("top_recommendation_title", "")
        if not top_category:
            top_category = parsed.get("top_recommendation_category", "")
        if not top_reason:
            top_reason = parsed.get("top_recommendation_reason_short", "")

        preferred = top_title or top_category or "目前最接近需求的方案"
        reason_text = top_reason or "它和你現在的需求與保障缺口比較貼近"

        second_sentence = f"我目前會先優先看{preferred}。"
        third_sentence = f"主要是因為{reason_text}。"
        return " ".join([first_sentence, second_sentence, third_sentence])

    def _build_timeout_fallback_reply() -> str:
        focus = re.sub(r"\s+", " ", str(user_text or "")).strip()
        if len(focus) > 20:
            focus = focus[:20] + "..."

        if not allow_recommendations:
            lead = f"我有接住你剛剛這句「{focus}」。" if focus else "我有接住你剛剛這句。"
            followups = [
                "我先直接回應這個問題，不會先跳去保單推薦。",
                "我們先把這句聊清楚；你要回到保險時我再接著幫你整理。",
                "我先照你眼前這個問題回答，等你要談保障再切回保險顧問模式。",
            ]
            seed = focus or "topic"
            idx = sum(ord(ch) for ch in seed) % len(followups)
            return f"{lead}{followups[idx]}"

        top_title = ""
        reason_text = ""
        if isinstance(recommendation_preview, dict):
            top_title = str(recommendation_preview.get("title") or "").strip()
            reason_text = str(recommendation_preview.get("recommendation_reason_short") or "").strip()

        lead = f"你剛剛提到「{focus}」，" if focus else "我先幫你抓重點，"
        followups = [
            "我先整理可執行重點，等一下補完整細節。",
            "我先把下一步怎麼做講清楚，再補上完整比較。",
            "我先給你重點建議，稍後接續完整回覆。",
        ]

        if top_title:
            followups.append(f"我會先從{top_title}開始比對，完整條件馬上補上。")
        if reason_text:
            followups.append(f"我先依「{reason_text}」這個方向整理，接著補完整內容。")

        seed = f"{focus}|{top_title}|{reason_text}"
        idx = (sum(ord(ch) for ch in seed) if seed else 0) % len(followups)
        return f"{lead}{followups[idx]}"

    if DEBUG_RECOMMENDATION_STUB:
        yield _build_debug_stub_reply()
        return

    if not gemini_ready or not model:
        yield "Gemini 尚未設定或 API Key 無效，無法產生回覆。"
        return

    # 組合歷史對話文字
    history_text = ""
    if chat_history and isinstance(chat_history, list):
        history_lines = []
        for msg in chat_history:
            role = "使用者" if msg.get("role") == "user" else "AI助手"
            # --- 新增：相容前端可能送來的 content 欄位 ---
            text = msg.get("text") or msg.get("content", "")
            if text:
                history_lines.append(f"{role}: {text}")
        if history_lines:
            # 為了避免超出上下文限制，最多取最後 10 次往返（約 20 則訊息）
            history_text = "【歷史對話紀錄】\n" + "\n".join(history_lines[-20:]) + "\n\n"

    policy_section = ""
    if policy_context:
        policy_section = f"""
【使用者保單資訊摘要】
以下是系統已讀取的使用者保單摘要，請在回覆時優先參考這份內容：
{policy_context}

"""

    # 處理語音情緒
    voice_context = ""
    if voice_analysis and "voice_mood" in voice_analysis:
        voice_context = f"""
- 聲音情緒 (Voice Mood)：{voice_analysis.get('voice_mood', 'neutral')}
- 說話語氣 (Tone)：{voice_analysis.get('tone', 'calm')}
- 說話急迫度 (Urgency, 0~2)：{voice_analysis.get('urgency', 0)}
"""

    recommendation_section = ""
    if allow_recommendations and recommendation_context:
        recommendation_section = f"""
{recommendation_context}

"""

    # --- 主 prompt 新增規則位置 ---
    prompt = f"""{policy_section}{recommendation_section}{history_text}你是 AI 保險顧問助手。

【輸入】
- user_text: "{user_text}"
- face_mood: {mood}
- face_desc: {expression_desc}{voice_context}

【回答優先順序】
1) 先解決 user_text 的實際問題
2) 若有 policy_context，優先用它補充可執行資訊
3) voice_mood / tone / urgency 只用來調整說話方式，不主導內容
4) face mood 只作為輔助

【推薦整合規則】
1) 先回答 user_text 的核心問題
2) 只有在 recommendation_context 不為空時，才可再補一句「我目前會先優先看...」
3) 再用一句簡短理由說明（以需求/保障缺口/適配度為主因）
4) 不要一次列出 Top3；只自然引用 Top1
5) 情緒只能作為語氣與排序輔助，不可改寫保單事實、不可以情緒直接下結論
6) 若 recommendation_context 為空，完全不要提推薦

【安撫規則】
- 只有在以下任一條件成立才可安撫：
    a) voice_mood in [anxious, frustrated, angry]
    b) urgency = 2
    c) face mood 與 voice mood 都是負向情緒
- 安撫最多一句，且最多 12 個中文字
- 安撫後立刻回答，不可連續兩句同理話術

【衝突規則】
- 若 face mood 與 voice mood 衝突：voice mood 決定語氣，user_text 決定內容，face mood 不主導答案

【任務型問題規則】
- 若屬保單操作型問題（理賠、申請、確認、下一步），先給可執行動作，再補必要說明
- 不要先講大道理

【輸出限制】
- 只輸出最終回答
- 2~4 句
- 繁體中文、口語化、適合 TTS
- 不要條列、不要 markdown、不要前綴、不要 emoji
- 一般詢問直接回答，不要多做情緒鋪墊
"""

    if not allow_recommendations:
        prompt = (
            "【主題守門規則】\n"
            "- 這一輪先直接回應使用者當前問題。\n"
            "- 不要主動把話題拉回保險、保障缺口、保單推薦或投保建議。\n"
            "- 只有當使用者再次明確提到保險、保單、保障、理賠、保費或方案比較時，才重新切回保險顧問模式。\n\n"
            + prompt
        )

    try:
        response = model.generate_content(
            prompt,
            stream=True,
            request_options={"timeout": GEMINI_CHAT_REQUEST_TIMEOUT_SECONDS},
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        import traceback
        err_text = str(e)
        logger.error(f"Gemini Chat Streaming Error: {type(e).__name__}: {err_text}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        err_lower = err_text.lower()

        if "429" in err_lower or "resource exhausted" in err_lower or "quota" in err_lower:
            yield "目前 AI 服務配額暫時用盡，請稍後再試。"
        elif "401" in err_lower or "403" in err_lower or "permission" in err_lower or "unauthorized" in err_lower:
            yield "目前 AI 服務授權有問題，請通知管理員檢查金鑰與權限。"
        elif "timeout" in err_lower or "deadline" in err_lower or "unavailable" in err_lower:
            yield _build_timeout_fallback_reply()
        else:
            yield "不好意思，我現在腦袋有點打結，稍後再聊。"


def read_policy(file_bytes: bytes, mime_type: str = "application/pdf") -> str:
    """
    讀取使用者上傳的保單 PDF，回傳 Gemini 解讀後的摘要文字。
    """
    if not gemini_ready or not model:
        return "Gemini 尚未設定，無法讀取保單。"

    try:
        import base64
        # 用 inline_data 方式傳送 PDF 給 Gemini
        pdf_part = {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(file_bytes).decode("utf-8")
            }
        }
        prompt = """請仔細閱讀這份保單文件，並整理出以下重點，以繁體中文回覆：
1. 保單名稱與保險公司
2. 保障項目與保障金額
3. 保費與繳費方式
4. 重要的免責條款或限制
5. 受益人資訊（如有）

請用條列式整理，讓使用者能快速了解自己的保障內容。"""

        response = model.generate_content([prompt, pdf_part])
        return response.text.strip()
    except Exception as e:
        logger.error(f"Policy read error: {e}")
        return f"保單讀取失敗：{str(e)}"
