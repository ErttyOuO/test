from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import urllib.request
import urllib.error
import subprocess
import shutil
import re

app = Flask(__name__)
CORS(app) # 讓網頁可以順利連線到這個 Python 程式


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"ok": True}), 200

# 設定你的專案 ID：可由環境變數覆蓋
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "boreal-logic-489707-i3")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "asia-east1")
VERTEX_LOCATIONS = [
    loc.strip() for loc in os.getenv(
        "VERTEX_LOCATIONS",
        f"{VERTEX_LOCATION},us-central1"
    ).split(",") if loc.strip()
]
VERTEX_MODELS = [
    m.strip() for m in os.getenv(
        "VERTEX_MODELS",
        "gemini-2.0-flash-001,gemini-2.5-flash,gemini-1.5-flash-002,gemini-1.5-flash-001"
    ).split(",") if m.strip()
]
VERTEX_ACCESS_TOKEN = os.getenv("VERTEX_ACCESS_TOKEN", "").strip()
DEFAULT_RESPONSE_MODE = os.getenv("AI_RESPONSE_MODE", "short").strip().lower()


def normalize_response_mode(mode: str) -> str:
    value = (mode or "").strip().lower()
    if value in ("short", "brief", "test"):
        return "short"
    if value in ("full", "long", "unlimited", "detail", "detailed"):
        return "full"
    return "auto"


def sanitize_plain_text_reply(text: str) -> str:
    """Normalize model output to plain text without markdown/html markers."""
    cleaned = str(text or "")

    # Convert common HTML line breaks to plain newlines.
    cleaned = re.sub(r"<\s*br\s*/?\s*>", "\n", cleaned, flags=re.IGNORECASE)

    # Strip markdown emphasis and heading/list markers.
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"^[\t ]*#{1,6}[\t ]*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^[\t ]*[-*][\t ]+", "", cleaned, flags=re.MULTILINE)

    # Remove remaining html tags and normalize blank lines.
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()


def get_vertex_access_token() -> str:
    """Use env token first; otherwise obtain short-lived token from gcloud."""
    if VERTEX_ACCESS_TOKEN:
        return VERTEX_ACCESS_TOKEN

    gcloud_candidates = [
        os.getenv("GCLOUD_BIN", "").strip(),
        shutil.which("gcloud"),
        shutil.which("gcloud.cmd"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"),
        os.path.expandvars(r"%ProgramFiles%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"),
    ]
    gcloud_cmd = next((c for c in gcloud_candidates if c and os.path.exists(c)), None)

    if not gcloud_cmd:
        raise RuntimeError(
            "找不到 gcloud 指令，請先用 start_vertex_backend.ps1 啟動後端，"
            "或安裝並登入 Google Cloud SDK。"
        )

    try:
        token = subprocess.check_output(
            [gcloud_cmd, "auth", "print-access-token"],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=10,
        ).strip()
        if token:
            return token
    except Exception as e:
        raise RuntimeError(f"無法取得 Vertex Access Token：{e}")

    raise RuntimeError("找不到可用的 Vertex Access Token")


def is_professional_consultation_query(user_message: str) -> bool:
    raw_text = (user_message or "")
    text = raw_text.strip().lower()
    if len(text) >= 28:
        return True

    keywords = [
        "條款", "費率", "保額", "保費", "核保", "理賠", "等待期", "除外", "豁免",
        "既往症", "副本理賠", "實支", "癌症", "失能", "壽險", "受益人", "試算",
        "規劃", "家庭", "年齡", "職業", "預算", "比較", "建議", "方案"
    ]
    return any(k in raw_text for k in keywords)


def ask_vertex_with_fallback(user_message: str, response_mode: str = "auto") -> str:
    """Try Vertex publisher models in order and return first successful response."""
    token = get_vertex_access_token()
    mode = normalize_response_mode(response_mode)
    is_pro = is_professional_consultation_query(user_message)

    if mode == "short":
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "請先給主結論，再條列 2-3 點重點；"
            "整體盡量控制在 90-160 字，避免冗長。"
            "請只輸出純文字，不要使用 Markdown 或 HTML；"
            "不要出現 **、*、`、<br>、BR 這類符號。"
        )
        max_output_tokens = 280
    elif mode == "full":
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "請完整回答，不需要刻意縮短字數；"
            "建議先給結論，再條列重點與注意事項。"
            "請只輸出純文字，不要使用 Markdown 或 HTML；"
            "不要出現 **、*、`、<br>、BR 這類符號。"
        )
        max_output_tokens = 3072
    elif is_pro:
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "這題屬於專業諮詢，請先給結論，再條列 4-8 點可執行重點；"
            "若有不確定處要明確說明，避免空泛與贅述。"
            "請只輸出純文字，不要使用 Markdown 或 HTML；"
            "不要出現 **、*、`、<br>、BR 這類符號。"
        )
        max_output_tokens = 1400
    else:
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "一般問題請保持精簡：1-2 句主結論 + 最多 3 點重點，"
            "總長度盡量控制在 120-180 字內。"
            "請只輸出純文字，不要使用 Markdown 或 HTML；"
            "不要出現 **、*、`、<br>、BR 這類符號。"
        )
        max_output_tokens = 520

    last_err = None
    for location in VERTEX_LOCATIONS:
        for model_name in VERTEX_MODELS:
            try:
                generation_config = {
                    "temperature": 0.6,
                    "topP": 0.9,
                    "maxOutputTokens": max_output_tokens,
                }

                # Gemini 2.5 may consume most output budget on thinking tokens.
                # Disable thinking budget to avoid short/incomplete answers.
                if model_name.startswith("gemini-2.5"):
                    generation_config["thinkingConfig"] = {"thinkingBudget": 0}

                payload = {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": f"{system_prompt}\n\n使用者問題：{user_message}"}],
                        }
                    ],
                    "generationConfig": generation_config,
                }

                url = (
                    f"https://{location}-aiplatform.googleapis.com/v1/"
                    f"projects/{PROJECT_ID}/locations/{location}/"
                    f"publishers/google/models/{model_name}:generateContent"
                )

                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}",
                    },
                    method="POST",
                )

                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                text = "".join([p.get("text", "") for p in parts]).strip()
                if not text:
                    raise RuntimeError(f"Vertex 回覆為空 ({location}/{model_name})")

                return sanitize_plain_text_reply(text)
            except Exception as e:
                last_err = e
                continue

    raise RuntimeError(f"Vertex AI 不可用：{last_err}")


# =========================================================
# Gemini API Key Fallback (when Vertex AI is unavailable)
# =========================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

# Try loading from face_backend .env if not set
if not GEMINI_API_KEY:
    _env_path = os.path.join(os.path.dirname(__file__), "face_backend", ".env")
    if os.path.exists(_env_path):
        with open(_env_path, "r") as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    GEMINI_API_KEY = line.split("=", 1)[1].strip()
                    break

_gemini_model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash")
    except Exception as e:
        print(f"Gemini API Key init warning: {e}")


def ask_gemini_with_api_key(user_message: str, response_mode: str = "auto") -> str:
    """Fallback: use Gemini API Key when Vertex AI is not available."""
    if not _gemini_model:
        raise RuntimeError("Gemini API Key 未設定或無效")

    mode = normalize_response_mode(response_mode)
    is_pro = is_professional_consultation_query(user_message)

    if mode == "short":
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "請先給主結論，再條列 2-3 點重點；"
            "整體盡量控制在 90-160 字，避免冗長。"
            "請只輸出純文字，不要使用 Markdown 或 HTML。"
        )
    elif mode == "full":
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "請完整回答，不需要刻意縮短字數；"
            "建議先給結論，再條列重點與注意事項。"
            "請只輸出純文字，不要使用 Markdown 或 HTML。"
        )
    elif is_pro:
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "這題屬於專業諮詢，請先給結論，再條列 4-8 點可執行重點。"
            "請只輸出純文字，不要使用 Markdown 或 HTML。"
        )
    else:
        system_prompt = (
            "你是親切且專業的保險諮詢顧問，請用繁體中文回答。"
            "一般問題請保持精簡：1-2 句主結論 + 最多 3 點重點。"
            "請只輸出純文字，不要使用 Markdown 或 HTML。"
        )

    full_prompt = f"{system_prompt}\n\n使用者問題：{user_message}"
    response = _gemini_model.generate_content(full_prompt)
    return sanitize_plain_text_reply(response.text)


@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        user_message = (data.get("message") or "").strip()
        request_mode = normalize_response_mode(data.get("responseMode") or DEFAULT_RESPONSE_MODE)
        if not user_message:
            return jsonify({"reply": "請先輸入問題。"}), 400

        # Try Vertex AI first, fallback to Gemini API Key
        try:
            reply_text = ask_vertex_with_fallback(user_message, request_mode)
        except Exception:
            reply_text = ask_gemini_with_api_key(user_message, request_mode)

        return jsonify({"reply": reply_text, "responseMode": request_mode})
    except Exception as e:
        return jsonify({"reply": f"後端發生錯誤：{str(e)}"}), 500

if __name__ == '__main__':
    print(f"AI 保險員後端已啟動！連線位址：http://127.0.0.1:5000")
    print(f"Vertex 設定：project={PROJECT_ID}, locations={VERTEX_LOCATIONS}, models={VERTEX_MODELS}")
    if GEMINI_API_KEY:
        print(f"Gemini API Key fallback: ENABLED")
    else:
        print(f"Gemini API Key fallback: DISABLED (no key found)")
    app.run(port=5000)