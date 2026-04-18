from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import time
import json
import base64
import logging
import asyncio
import threading
import os
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from vision_client import analyze_emotion_from_images
from gemini_client import transcribe_audio, get_gemini_reply_stream, read_policy, gemini_ready

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

# 儲存全局保單文字（简單现執行紙存儲）
policy_summary_store = {"text": ""}

# --- 新增：平台保單快取與 user 摘要來源設定 ---
NODE_SERVER_POLICY_SUMMARY_API = os.getenv(
    "NODE_SERVER_POLICY_SUMMARY_API",
    "http://localhost:3000/api/policies/summary"
)
PLATFORM_POLICY_JSON_PATH = Path(__file__).resolve().parents[3] / "data" / "policy" / "policy_data.json"
platform_policy_cache: List[dict] = []

@app.get("/health")
def health_check():
    return {"status": "ok"}

# 簡易的全域冷卻，防止背景輪詢衝擊 Gemini Vision API
_last_emotion_check = 0.0
_EMOTION_CHECK_COOLDOWN = 2.5  # 秒
_CONSULTATION_SIGNAL_MAPPING = {
    "worried": {
        "label": "較擔心",
        "recommendation_bias": "reassure",
    },
    "doubtful": {
        "label": "較疑惑",
        "recommendation_bias": "simplify",
    },
    "stable": {
        "label": "平穩",
        "recommendation_bias": "normal",
    },
    "uncertain": {
        "label": "偵測中",
        "recommendation_bias": "normal",
    },
}

# --- 新增：規則版需求/類型關鍵字映射（MVP，不新增模型請求） ---
_NEED_KEYWORD_MAP = {
    "medical": ["住院", "開刀", "手術", "醫療", "實支", "病房", "醫藥費", "門診"],
    "accident": ["意外", "骨折", "車禍", "燒燙傷", "失能", "職災"],
    "critical": ["癌症", "重大疾病", "重疾", "腫瘤", "化療", "標靶"],
    "travel": ["出國", "旅遊", "海外", "旅平", "班機", "海外醫療"],
}

_EMOTION_BIAS_KEYWORDS = {
    "reassure": ["醫療", "住院", "理賠", "保障", "補強", "風險"],
    "simplify": ["簡單", "易懂", "白話", "條款", "直白", "清楚"],
}


_INSURANCE_TOPIC_KEYWORDS = [
    "保險", "保單", "保障", "保費", "理賠", "投保", "續保", "核保", "條款",
    "保額", "險種", "醫療險", "壽險", "意外險", "癌症險", "失能", "實支",
    "住院", "開刀", "手術", "醫療", "車禍", "旅平", "海外醫療", "顧問", "規劃"
]

_INSURANCE_FOLLOW_UP_PHRASES = [
    "那我呢", "那怎麼辦", "那要怎麼選", "哪個比較好", "所以呢",
    "接下來呢", "那費用呢", "那保障呢", "那理賠呢", "那我需要嗎",
    "那要買嗎", "那一個比較適合", "這樣夠嗎", "這樣可以嗎"
]

def _normalize_consultation_state(signal: str) -> dict:
    normalized_signal = signal if signal in _CONSULTATION_SIGNAL_MAPPING else "uncertain"
    mapped = _CONSULTATION_SIGNAL_MAPPING[normalized_signal]
    return {
        "consultation_signal": normalized_signal,
        "recommendation_bias": mapped["recommendation_bias"],
        "reason_short": "偵測中" if normalized_signal == "uncertain" else "",
    }


# --- 新增：保單 context 建構工具函式 ---
def _strip_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", str(text))


def _short_text(text: str, limit: int = 220) -> str:
    cleaned = re.sub(r"\s+", " ", _strip_html(text)).strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit] + "..."


def _extract_keywords(text: str) -> List[str]:
    if not text:
        return []
    # 中英文混合：抓中文詞段與英數詞，避免整句比對
    tokens = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]{2,}", text)
    seen = set()
    result = []
    for token in tokens:
        key = token.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(token)
    return result[:30]


def _score_insurance_topic(text: str) -> int:
    normalized = str(text or "").strip().lower()
    if not normalized:
        return 0
    return sum(1 for keyword in _INSURANCE_TOPIC_KEYWORDS if keyword.lower() in normalized)


def _looks_like_insurance_follow_up(text: str) -> bool:
    normalized = str(text or "").strip()
    if not normalized:
        return False
    if len(normalized) > 18:
        return False
    return any(phrase in normalized for phrase in _INSURANCE_FOLLOW_UP_PHRASES)


def _recent_history_has_insurance_context(chat_history: list, limit: int = 4) -> bool:
    if not isinstance(chat_history, list):
        return False
    recent_messages = chat_history[-limit:]
    return any(_score_insurance_topic(msg.get("text", "")) > 0 for msg in recent_messages if isinstance(msg, dict))


def _should_generate_recommendations(user_text: str, chat_history: list) -> bool:
    direct_topic_score = _score_insurance_topic(user_text)
    if direct_topic_score > 0:
        return True
    if _looks_like_insurance_follow_up(user_text) and _recent_history_has_insurance_context(chat_history):
        return True
    return False


def _build_stream_timeout_reply(
    user_text: str,
    recommendation_preview: Optional[dict],
    recommendation_meta: Optional[dict],
) -> str:
    focus = _short_text(user_text, 20)
    recommendation_allowed = True
    top_title = ""
    if isinstance(recommendation_preview, dict):
        top_title = _short_text(str(recommendation_preview.get("title") or ""), 16)

    dominant_need = ""
    if isinstance(recommendation_meta, dict):
        dominant_need = str(recommendation_meta.get("dominant_need") or "").strip()
        recommendation_allowed = recommendation_meta.get("recommendation_allowed", True) is not False

    need_label = {
        "medical": "醫療保障",
        "accident": "意外保障",
        "critical": "重大疾病保障",
        "travel": "旅平／海外醫療",
        "general": "一般保障規劃",
    }.get(dominant_need, "一般保障規劃")

    if not recommendation_allowed:
        lead = f"我有接住你剛剛這句「{focus}」。" if focus else "我有接住你剛剛這句。"
        followups = [
            "我先直接回應這個問題，如果你想再拉回保險規劃，我再接著幫你整理。",
            "我們先把眼前這句聊清楚；如果你等一下要回到保單或保障，我再幫你接上。",
            "我先照你這句話回答，不會先跳去保單推薦；你要談保障時再叫我就好。",
        ]
        seed = focus or "topic"
        index = sum(ord(ch) for ch in seed) % len(followups)
        return f"{lead}{followups[index]}"

    lead = f"我有接住你剛剛提到的「{focus}」。" if focus else "我有接住你剛剛的問題。"
    followups = [
        "我先把重點整理給你，接著再補你下一步最值得先看的地方。",
        f"我會先從 {need_label} 這條線幫你看，避免資訊太散。",
        "我先順著你這句話回答，再把真正需要補強的地方接起來。",
    ]

    if top_title:
        followups.append(f"如果你要，我也可以接著把 {top_title} 這類方案的差異講清楚。")

    seed = f"{focus}|{top_title}|{need_label}"
    index = (sum(ord(ch) for ch in seed) if seed else int(time.time())) % len(followups)
    return f"{lead}{followups[index]}"


def _score_by_keywords(text: str, keywords: List[str]) -> int:
    if not text or not keywords:
        return 0
    hay = text.lower()
    score = 0
    for kw in keywords:
        k = kw.lower()
        if k and k in hay:
            score += 1
    return score


def _detect_dominant_need(user_text: str, chat_history: list) -> str:
    # --- 新增：推薦排序函式 - 判斷主需求 dominant_need ---
    merged = f"{user_text or ''} " + " ".join([str(m.get("text") or "") for m in (chat_history or [])[-8:]])
    scores: dict[str, int] = {}
    for need, kws in _NEED_KEYWORD_MAP.items():
        scores[need] = _score_by_keywords(merged, kws)
    best_need = max(scores, key=lambda need: scores.get(need, 0)) if scores else "general"
    return best_need if scores.get(best_need, 0) > 0 else "general"


def _category_to_need_tag(text: str) -> str:
    lower_text = str(text or "").lower()
    for need, kws in _NEED_KEYWORD_MAP.items():
        if any(kw.lower() in lower_text for kw in kws):
            return need
    return "general"


def _build_user_coverage_profile(user_items: List[dict]) -> dict:
    profile = {"medical": 0, "accident": 0, "critical": 0, "travel": 0, "general": 0}
    for item in user_items:
        text = " ".join([
            str(item.get("title") or ""),
            str(item.get("category") or ""),
            str(item.get("summary") or ""),
            str(item.get("extractedTextShort") or ""),
        ])
        tag = _category_to_need_tag(text)
        profile[tag] = profile.get(tag, 0) + 1
    return profile


def score_user_gap(candidate_need_tag: str, dominant_need: str, coverage_profile: dict) -> int:
    # --- 新增：推薦排序函式 - coverage_gap_score（主因） ---
    if dominant_need == "general":
        return 0
    has_count = int(coverage_profile.get(dominant_need, 0))
    if candidate_need_tag == dominant_need and has_count == 0:
        return 3
    if candidate_need_tag == dominant_need and has_count <= 1:
        return 2
    return 0


def apply_emotion_bias(consultation_signal: str, recommendation_bias: str, candidate_text: str, candidate_need_tag: str) -> int:
    # --- 新增：情緒加權位置 - emotion_adjustment_score（輔因，權重小於主因） ---
    if consultation_signal in {"stable", "uncertain"}:
        return 0

    score = 0
    text = str(candidate_text or "")
    if recommendation_bias == "reassure":
        score += min(2, _score_by_keywords(text, _EMOTION_BIAS_KEYWORDS["reassure"]))
        if candidate_need_tag in {"medical", "accident", "critical"}:
            score += 1
    elif recommendation_bias == "simplify":
        score += min(2, _score_by_keywords(text, _EMOTION_BIAS_KEYWORDS["simplify"]))
        if "條款" in text or "摘要" in text:
            score += 1

    return min(score, 2)


def build_recommendation_meta(dominant_need: str, coverage_profile: dict, consultation_signal: str) -> dict:
    # --- 新增：推薦 meta 組裝 ---
    need_label = {
        "medical": "醫療保障",
        "accident": "意外保障",
        "critical": "重大疾病",
        "travel": "旅平/海外醫療",
        "general": "一般保障規劃",
    }.get(dominant_need, "一般保障規劃")

    gap_hint = "目前先以需求匹配優先"
    if dominant_need != "general":
        count = int(coverage_profile.get(dominant_need, 0))
        if count == 0:
            gap_hint = f"現有{need_label}覆蓋偏弱，建議優先補強"
        elif count <= 1:
            gap_hint = f"現有{need_label}覆蓋有限，可考慮補強"
        else:
            gap_hint = f"現有{need_label}已有基礎，採精準匹配"

    strategy = "need_match + coverage_gap + platform_fit"
    if consultation_signal in {"worried", "doubtful"}:
        strategy += " + emotion_adjustment"

    return {
        "dominant_need": need_label,
        "coverage_gap_hint": gap_hint,
        "emotion_signal_used": consultation_signal,
        "ranking_strategy": strategy,
    }


def _build_recommendation_reason_short(dominant_need: str, gap_score: int, consultation_signal: str, recommendation_bias: str) -> str:
    # --- 新增：recommendation_reason_short 產生位置 ---
    need_phrase = {
        "medical": "住院醫療",
        "accident": "意外風險",
        "critical": "重大疾病",
        "travel": "旅遊保障",
        "general": "保障規劃",
    }.get(dominant_need, "保障規劃")

    if gap_score >= 2:
        base = f"你現有{need_phrase}較弱，先補缺口"
    elif dominant_need != "general":
        base = f"你提到{need_phrase}需求，先排匹配方案"
    else:
        base = "先依需求匹配度排序"

    if consultation_signal == "worried" and recommendation_bias == "reassure":
        return "較擔心突發風險，先補保障缺口"
    if consultation_signal == "doubtful" and recommendation_bias == "simplify":
        return "你目前較疑惑，先用較易懂方案"
    return base[:20]


def score_platform_policies(
    user_text: str,
    chat_history: list,
    platform_items: List[dict],
    user_items: List[dict],
    consultation_signal: str,
    recommendation_bias: str,
) -> dict:
    # --- 新增：推薦排序函式 - 規則版打分與 top3 組裝 ---
    history_text = " ".join([msg.get("text", "") for msg in (chat_history or [])[-6:]])
    keywords = _extract_keywords(f"{user_text or ''} {history_text}")
    dominant_need = _detect_dominant_need(user_text, chat_history)
    coverage_profile = _build_user_coverage_profile(user_items)

    candidates = []

    def _append_candidate(item: dict, source: str):
        title = str(item.get("title") or "未命名保單")
        category = str(item.get("category") or "未分類")
        summary = _short_text(item.get("summary") or item.get("extractedTextShort") or "", 120)
        candidate_text = " ".join([title, category, summary])
        candidate_need_tag = _category_to_need_tag(candidate_text)

        need_match_score = 0
        if dominant_need != "general" and candidate_need_tag == dominant_need:
            need_match_score += 4
        need_match_score += min(3, _score_by_keywords(candidate_text, keywords))

        coverage_gap_score = score_user_gap(candidate_need_tag, dominant_need, coverage_profile)
        platform_fit_score = min(3, _score_by_keywords(candidate_text, keywords))
        emotion_adjustment_score = apply_emotion_bias(
            consultation_signal,
            recommendation_bias,
            candidate_text,
            candidate_need_tag,
        )

        base_score = need_match_score + coverage_gap_score + platform_fit_score
        final_score = base_score + emotion_adjustment_score
        reason_short = _build_recommendation_reason_short(
            dominant_need,
            coverage_gap_score,
            consultation_signal,
            recommendation_bias,
        )

        candidates.append({
            "policy_id": str(item.get("policyId") or item.get("id") or ""),
            "title": title,
            "category": category,
            "short_summary": summary,
            "base_score": base_score,
            "emotion_adjustment": emotion_adjustment_score,
            "final_score": final_score,
            "recommendation_reason_short": reason_short,
            "_source": source,
        })

    for p in platform_items:
        _append_candidate(p, "platform")
    for u in user_items:
        _append_candidate(u, "user")

    candidates.sort(key=lambda x: x.get("final_score", 0), reverse=True)

    # 依 policy_id 去重，保留分數最高的一筆（排序後先遇到即最高）
    deduped_candidates = []
    seen_policy_ids = set()
    for candidate in candidates:
        policy_id = str(candidate.get("policy_id") or "").strip()
        dedupe_key = policy_id or f"{candidate.get('title', '')}|{candidate.get('category', '')}"
        if dedupe_key in seen_policy_ids:
            continue
        seen_policy_ids.add(dedupe_key)
        deduped_candidates.append(candidate)

    max_final_score = max((int(item.get("final_score", 0)) for item in deduped_candidates), default=0)
    # 需求訊號不足時不強行推薦，避免每次都固定顯示同一組 Top3。
    if dominant_need == "general" and (not keywords or max_final_score <= 0):
        meta = build_recommendation_meta(dominant_need, coverage_profile, consultation_signal)
        meta["coverage_gap_hint"] = "先釐清需求後再推薦保單"
        meta["ranking_strategy"] = "need-clarification"
        return {
            "ranked_policy_candidates": [],
            "recommendation_meta": meta,
        }

    top_candidates = deduped_candidates[:3]
    meta = build_recommendation_meta(dominant_need, coverage_profile, consultation_signal)
    return {
        "ranked_policy_candidates": top_candidates,
        "recommendation_meta": meta,
    }


def _normalize_chat_history_for_model(raw_history: list) -> list:
    normalized = []
    if not isinstance(raw_history, list):
        return normalized

    for msg in raw_history:
        if not isinstance(msg, dict):
            continue
        text_value = msg.get("text")
        if not text_value:
            text_value = msg.get("content", "")
        text_value = str(text_value or "").strip()
        if not text_value:
            continue
        role = "user" if msg.get("role") == "user" else "assistant"
        normalized.append({"role": role, "text": text_value})
    return normalized


def _load_platform_policy_cache() -> None:
    global platform_policy_cache
    try:
        if not PLATFORM_POLICY_JSON_PATH.exists():
            logger.warning(f"平台保單檔不存在: {PLATFORM_POLICY_JSON_PATH}")
            platform_policy_cache = []
            return

        raw = json.loads(PLATFORM_POLICY_JSON_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            platform_policy_cache = []
            return

        cooked = []
        for item in raw:
            if not isinstance(item, dict):
                continue

            name = str(item.get("name") or "").strip()
            category = str(item.get("category") or "").strip()
            source = str(item.get("source") or "").strip()
            tags = item.get("tags") or []
            if not isinstance(tags, list):
                tags = []
            tags_text = " ".join([str(t) for t in tags])

            summary = _short_text(
                item.get("summary")
                or item.get("dm_markdown")
                or item.get("terms_text_content")
                or "",
                limit=220,
            )
            searchable_text = " ".join([
                name,
                category,
                source,
                tags_text,
                summary,
            ])

            cooked.append({
                "policyId": str(item.get("id") or ""),
                "title": name or "未命名平台保單",
                "category": category or source or "未分類",
                "summary": summary,
                "searchable": searchable_text,
            })

        platform_policy_cache = cooked
        logger.info(f"平台保單快取載入完成，共 {len(platform_policy_cache)} 筆")
    except Exception as e:
        logger.error(f"平台保單快取載入失敗: {e}")
        platform_policy_cache = []


def _fetch_user_policy_summaries(user_id: str) -> List[dict]:
    if not user_id:
        return []

    query = urlencode({"userId": user_id})
    url = f"{NODE_SERVER_POLICY_SUMMARY_API}?{query}"
    try:
        with urlopen(url, timeout=1.8) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            if isinstance(payload, dict):
                policies = payload.get("policies")
                if isinstance(policies, list):
                    return [item for item in policies if isinstance(item, dict)]
            if isinstance(payload, list):
                return [item for item in payload if isinstance(item, dict)]
            return []
    except Exception as e:
        logger.warning(f"_fetch_user_policy_summaries 失敗，改用平台候選: {e}")
        return []


def _recall_policy_candidates(user_id: str, user_text: str, chat_history: list) -> dict:
    # --- 新增：共用候選召回（供 context 與推薦排序共用） ---
    history_text = " ".join([msg.get("text", "") for msg in (chat_history or [])[-6:]])
    keywords = _extract_keywords(f"{user_text or ''} {history_text}")

    platform_ranked = []
    for item in platform_policy_cache:
        score = _score_by_keywords(item.get("searchable", ""), keywords)
        platform_ranked.append((score, item))
    platform_ranked.sort(key=lambda x: x[0], reverse=True)
    platform_top = [item for _, item in platform_ranked[:3]]

    user_items = _fetch_user_policy_summaries(user_id) if user_id else []
    user_ranked = []
    for item in user_items:
        if not isinstance(item, dict):
            continue
        searchable = " ".join([
            str(item.get("title") or ""),
            str(item.get("category") or ""),
            str(item.get("summary") or ""),
            str(item.get("extractedTextShort") or ""),
        ])
        score = _score_by_keywords(searchable, keywords)
        user_ranked.append((score, item))
    user_ranked.sort(key=lambda x: x[0], reverse=True)
    user_top = [item for _, item in user_ranked[:2]]

    return {
        "keywords": keywords,
        "platform_top": platform_top,
        "user_top": user_top,
    }


def _compose_policy_context_from_candidates(user_top: List[dict], platform_top: List[dict]) -> str:
    lines = []
    if user_top:
        lines.append("【使用者保單摘要候選】")
        for idx, item in enumerate(user_top[:2], start=1):
            lines.append(
                f"{idx}. {item.get('title', '未命名')} | 類別:{item.get('category', '未分類')} | 摘要:{_short_text(item.get('summary', ''), 180)}"
            )

    if platform_top:
        lines.append("【平台保單摘要候選】")
        for idx, item in enumerate(platform_top[:3], start=1):
            lines.append(
                f"{idx}. {item.get('title', '未命名')} | 類別:{item.get('category', '未分類')} | 摘要:{_short_text(item.get('summary', ''), 180)}"
            )
    return "\n".join(lines) if lines else ""


def build_policy_context(user_id: str, user_text: str, chat_history: list) -> str:
    """
    --- 新增：整合平台保單 + 使用者保單摘要，產生短 policy_context ---
    失敗時回傳空字串，確保不影響 SSE。
    """
    try:
        recalled = _recall_policy_candidates(user_id, user_text, chat_history)
        platform_top = recalled.get("platform_top", [])
        user_top = recalled.get("user_top", [])
        return _compose_policy_context_from_candidates(user_top, platform_top)
    except Exception as e:
        logger.warning(f"build_policy_context 失敗，改用空 context: {e}")
        return ""


def build_policy_recommendation_package(
    user_id: str,
    user_text: str,
    chat_history: list,
    consultation_signal: str,
    recommendation_bias: str,
) -> dict:
    """
    --- 新增：推薦排序組裝（相鄰於 build_policy_context） ---
    回傳：policy_context + ranked_policy_candidates + recommendation_meta
    任一步驟失敗都 fallback，且不可中斷 SSE。
    """
    try:
        recommendation_allowed = _should_generate_recommendations(user_text, chat_history)
        if not recommendation_allowed:
            meta = build_recommendation_meta("general", {}, consultation_signal)
            meta["coverage_gap_hint"] = "本輪先回應你的當前問題，暫不主動推薦保單"
            meta["ranking_strategy"] = "topic-offscope"
            meta["recommendation_allowed"] = False
            return {
                "policy_context": "",
                "ranked_policy_candidates": [],
                "recommendation_meta": meta,
            }

        recalled = _recall_policy_candidates(user_id, user_text, chat_history)
        platform_items = recalled.get("platform_top", [])
        user_items = recalled.get("user_top", [])
        context = _compose_policy_context_from_candidates(user_items, platform_items)

        # 這裡使用既有候選資料做規則排序，不新增模型請求
        ranking = score_platform_policies(
            user_text=user_text,
            chat_history=chat_history,
            platform_items=platform_items,
            user_items=user_items,
            consultation_signal=consultation_signal,
            recommendation_bias=recommendation_bias,
        )

        ranked = ranking.get("ranked_policy_candidates", [])[:3]
        meta = ranking.get("recommendation_meta", {})
        if isinstance(meta, dict):
            meta["recommendation_allowed"] = bool(ranked)

        # 補充到 policy_context，讓回答可引用「為什麼排前面」
        reason_lines = []
        if ranked:
            reason_lines.append("【推薦排序理由】")
            for idx, item in enumerate(ranked, start=1):
                reason_lines.append(
                    f"{idx}. {item.get('title', '未命名')}：{item.get('recommendation_reason_short', '')}"
                )
        enriched_context = context
        if reason_lines:
            enriched_context = (context + "\n\n" if context else "") + "\n".join(reason_lines)

        return {
            "policy_context": enriched_context,
            "ranked_policy_candidates": ranked,
            "recommendation_meta": meta,
        }
    except Exception as e:
        logger.warning(f"build_policy_recommendation_package 失敗，改用平台 fallback: {e}")
        fallback_platform = platform_policy_cache[:3]
        fallback_ranked = []
        for item in fallback_platform:
            fallback_ranked.append({
                "policy_id": str(item.get("policyId") or item.get("id") or ""),
                "title": str(item.get("title") or "未命名平台保單"),
                "category": str(item.get("category") or "未分類"),
                "short_summary": _short_text(item.get("summary") or "", 120),
                "base_score": 0,
                "emotion_adjustment": 0,
                "final_score": 0,
                "recommendation_reason_short": "摘要來源暫不可用，先提供平台候選",
                "_source": "platform",
            })

        return {
            "policy_context": "",
            "ranked_policy_candidates": [],
            "recommendation_meta": {
                "dominant_need": "一般保障規劃",
                "coverage_gap_hint": "使用者摘要暫時不可用，已回退平台候選",
                "emotion_signal_used": consultation_signal or "uncertain",
                "ranking_strategy": "fallback-platform-only",
                "recommendation_allowed": False,
            },
        }


def _build_recommendation_context_for_model(ranked_policy_candidates: List[dict], recommendation_meta: dict) -> str:
    # --- recommendation_context 組裝位置 ---
    if not ranked_policy_candidates:
        return ""

    top1 = ranked_policy_candidates[0] if isinstance(ranked_policy_candidates[0], dict) else {}
    if not top1:
        return ""

    top_title = str(top1.get("title") or "")
    top_category = str(top1.get("category") or "")
    top_reason_short = str(top1.get("recommendation_reason_short") or "")
    ranking_strategy = str((recommendation_meta or {}).get("ranking_strategy") or "")
    dominant_need = str((recommendation_meta or {}).get("dominant_need") or "")

    if not any([top_title, top_category, top_reason_short, ranking_strategy, dominant_need]):
        return ""

    lines = ["【推薦摘要】"]
    if top_title:
        lines.append(f"top_recommendation_title: {top_title}")
    if top_category:
        lines.append(f"top_recommendation_category: {top_category}")
    if top_reason_short:
        lines.append(f"top_recommendation_reason_short: {top_reason_short}")
    if dominant_need:
        lines.append(f"dominant_need: {dominant_need}")
    if ranking_strategy:
        lines.append(f"ranking_strategy: {ranking_strategy}")
    return "\n".join(lines)


# 啟動即預載平台保單到記憶體
_load_platform_policy_cache()

@app.post("/emotion-check")
async def emotion_check(
    image: str = Form(..., description="Base64 截圖，用於背景情緒偵測"),
):
    """
    輕量背景情緒偵測通道。
    前端每隔數秒悄悄送一張照片，偵測到明顯情緒變化時
    更新前端快取，不影響主對話速度。
    """
    global _last_emotion_check
    now = time.time()
    if now - _last_emotion_check < _EMOTION_CHECK_COOLDOWN:
        return {
            "mood": "cooldown",
            "description": "rate limited",
            "confidence": 0.0,
            "consultation_signal": "uncertain",
            "recommendation_bias": "normal",
            "reason_short": "偵測中",
        }
    _last_emotion_check = now

    result = await asyncio.to_thread(analyze_emotion_from_images, [image])
    return result

@app.get("/config")
def get_config():
    return {
        "gemini_ready": gemini_ready,
        "has_policy": bool(platform_policy_cache) or bool(policy_summary_store["text"])
    }

@app.post("/policy")
async def upload_policy(
    file: UploadFile = File(..., description="保單 PDF 檔案")
):
    """
    接收使用者上傳的保單 PDF，讓 Gemini 先行讀取并儲存摘要。
    """
    logger.info(f"收到保單上傳: {file.filename}, type={file.content_type}")
    file_bytes = await file.read()

    summary = await asyncio.to_thread(read_policy, file_bytes, file.content_type or "application/pdf")
    policy_summary_store["text"] = summary

    logger.info(f"保單讀取完成，摘要長度: {len(summary)} 字")
    return {"status": "ok", "summary_preview": summary[:200] + "..." if len(summary) > 200 else summary}

@app.post("/chat")
async def chat_endpoint(
    audio: UploadFile = File(None, description="使用者錄音檔 (WebM/MP4)"),
    text: str = Form(None, description="使用者直接輸入的文字"),
    userId: str = Form("", description="目前登入使用者 ID"),
    images: List[str] = Form(default=[], description="對話期間的截圖(Base64編碼)"),
    enable_gemini: bool = Form(True, description="是否啟用 Gemini AI"),
    skip_vision: bool = Form(False, description="跳過影像情緒分析，使用快取情緒"),
    cached_mood: str = Form("neutral", description="前端快取的情緒值 (skip_vision=True 時使用)"),
    cached_custom_mood: str = Form("", description="前端快取的自訂情緒文字"),
    cached_consultation_signal: str = Form("uncertain", description="前端快取的諮詢輔助訊號"),
    cached_recommendation_bias: str = Form("normal", description="前端快取的建議偏向"),
    chat_history: str = Form("[]", description=" JSON 格式的歷史對話紀錄")
):
    """
    接收語音錄音檔與多張截圖：
    1. 語音 -> Gemini -> 文字
    2. 截圖 -> Gemini Vision -> 情緒
    3. 文字 + 情緒 + 歷史紀錄 -> Gemini -> AI 回覆
    """
    
    start_time = time.time()
    
    # 嘗試解析歷史紀錄
    try:
        history_list = json.loads(chat_history)
        if not isinstance(history_list, list):
            history_list = []
    except Exception:
        history_list = []

    # --- 新增：統一相容 text/content，避免歷史上下文失效 ---
    history_list = _normalize_chat_history_for_model(history_list)
    
    # 輔助非同步函式：處理音訊
    async def process_audio(audio_file, text_input, enable):
        default_res = {
            "transcript": "（未提供音訊檔案）",
            "voice_mood": "neutral",
            "tone": "calm",
            "urgency": 0,
            "confidence": 0.0
        }
        if text_input:
            t = text_input.strip()
            logger.info(f"收到文字輸入: {t}")
            default_res["transcript"] = t
            return default_res
        elif audio_file and enable:
            logger.info(f"收到聲音檔案: {audio_file.filename}, Content-Type: {audio_file.content_type}")
            audio_bytes = await audio_file.read()
            if len(audio_bytes) > 0:
                return await asyncio.to_thread(transcribe_audio, audio_bytes, audio_file.content_type)
            default_res["transcript"] = "（沒有錄到聲音）"
            return default_res
        elif not audio_file:
            return default_res
            
        default_res["transcript"] = "（AI 分析已關閉）"
        return default_res

    # 輔助非同步函式：處理影像
    async def process_images(image_list, enable):
        # skip_vision=True 時直接用前端快取情緒，跳過 Vision API 節省 ~2.5s
        if skip_vision:
            normalized_consultation = _normalize_consultation_state(cached_consultation_signal)
            logger.info(f"skip_vision=True，使用快取情緒: {cached_mood}, 自訂文字: {cached_custom_mood}")
            # 如果有自訂文字，則無論畫面辨識為何，都綜合回報給 AI
            if cached_custom_mood:
                face_desc = "透過背景隨時更新" if cached_mood != "custom" else ""
                combined_desc = f"使用者特別說明目前心情：「{cached_custom_mood}」"
                if face_desc:
                    combined_desc += f" (臉部表情偵測為：{cached_mood})"
                return {
                    "mood": "custom",
                    "description": combined_desc,
                    "confidence": 1.0,
                    "consultation_signal": normalized_consultation["consultation_signal"],
                    "recommendation_bias": normalized_consultation["recommendation_bias"],
                    "reason_short": normalized_consultation["reason_short"] or "偵測中",
                }
            else:
                return {
                    "mood": cached_mood,
                    "description": "透過背景隨時更新",
                    "confidence": 1.0,
                    "consultation_signal": normalized_consultation["consultation_signal"],
                    "recommendation_bias": normalized_consultation["recommendation_bias"],
                    "reason_short": normalized_consultation["reason_short"] or "偵測中",
                }
        if image_list and enable:
            logger.info(f"收到 {len(image_list)} 張影像準備分析情緒")
            return await asyncio.to_thread(analyze_emotion_from_images, image_list)
        elif not enable:
            return {
                "mood": "disabled",
                "description": "Gemini 分析已手動關閉",
                "confidence": 0.0,
                "consultation_signal": "uncertain",
                "recommendation_bias": "normal",
                "reason_short": "偵測中",
            }
        return {
            "mood": "unknown",
            "description": "未提供影像",
            "confidence": 0.0,
            "consultation_signal": "uncertain",
            "recommendation_bias": "normal",
            "reason_short": "偵測中",
        }

    # 1 & 2. 併發處理音訊 (STT) 與影像 (Emotion Analysis)
    audio_task = asyncio.create_task(process_audio(audio, text, enable_gemini))
    image_task = asyncio.create_task(process_images(images, enable_gemini))

    audio_result, emotion_result = await asyncio.gather(audio_task, image_task)
    user_text = audio_result["transcript"]

    # 語音分析採用門檻（最小改動版）
    raw_voice = dict(audio_result)
    try:
        raw_confidence = float(raw_voice.get("confidence", 0.0))
    except Exception:
        raw_confidence = 0.0
    raw_confidence = max(0.0, min(1.0, raw_confidence))

    try:
        raw_urgency = int(raw_voice.get("urgency", 0))
    except Exception:
        raw_urgency = 0
    raw_urgency = max(0, min(2, raw_urgency))

    # 主回答用：信心達標，且符合負向語氣/語調/急迫其一才採用 voice analysis
    reply_voice = dict(raw_voice)
    raw_voice_mood = str(raw_voice.get("voice_mood", "neutral"))
    raw_tone = str(raw_voice.get("tone", "calm"))
    adopt_voice_for_reply = (
        raw_confidence >= 0.55 and (
            raw_voice_mood in {"anxious", "frustrated", "angry"}
            or raw_tone in {"urgent", "complaining", "hesitant"}
            or raw_urgency >= 1
        )
    )
    if not adopt_voice_for_reply:
        reply_voice["voice_mood"] = "neutral"
        reply_voice["tone"] = "calm"
        reply_voice["urgency"] = 0

    # 前端顯示用：只有高信心(>=0.7)才讓 voice_mood 可優先
    ui_voice = dict(raw_voice)
    adopt_voice_for_ui = (raw_confidence >= 0.7)
    if not adopt_voice_for_ui:
        ui_voice["voice_mood"] = "neutral"

    # 保留 raw 值給前端 debug
    ui_voice["raw_voice_mood"] = raw_voice.get("voice_mood", "neutral")
    ui_voice["raw_tone"] = raw_voice.get("tone", "calm")
    ui_voice["raw_urgency"] = raw_urgency
    ui_voice["raw_confidence"] = raw_confidence
    ui_voice["adopt_for_reply"] = adopt_voice_for_reply
    ui_voice["adopt_for_ui"] = adopt_voice_for_ui

    mood = emotion_result.get("mood", "neutral")
    emotion_desc = emotion_result.get("description", "")
    confidence = emotion_result.get("confidence", 0.0)
    normalized_consultation = _normalize_consultation_state(
        str(emotion_result.get("consultation_signal", "uncertain"))
    )
    consultation_signal = normalized_consultation["consultation_signal"]
    recommendation_bias = normalized_consultation["recommendation_bias"]
    reason_short = emotion_result.get("reason_short") or normalized_consultation["reason_short"] or "偵測中"
    reply = ""

    # --- 新增：每次回答前建構推薦排序與 policy_context（失敗時 fallback，不中斷 SSE） ---
    recommendation_package = await asyncio.to_thread(
        build_policy_recommendation_package,
        userId,
        user_text,
        history_list,
        consultation_signal,
        recommendation_bias,
    )
    raw_policy_context = recommendation_package.get("policy_context", "")
    policy_context = str(raw_policy_context or "")

    raw_ranked_policy_candidates = recommendation_package.get("ranked_policy_candidates", [])
    ranked_policy_candidates: List[dict] = (
        [item for item in raw_ranked_policy_candidates if isinstance(item, dict)]
        if isinstance(raw_ranked_policy_candidates, list)
        else []
    )

    raw_recommendation_meta = recommendation_package.get("recommendation_meta", {})
    recommendation_meta: dict = raw_recommendation_meta if isinstance(raw_recommendation_meta, dict) else {}
    allow_recommendations = recommendation_meta.get("recommendation_allowed", bool(ranked_policy_candidates)) is not False

    recommendation_context = _build_recommendation_context_for_model(
        ranked_policy_candidates,
        recommendation_meta,
    )

    top_recommendation_preview: dict = ranked_policy_candidates[0] if ranked_policy_candidates else {}

    # 3. 準備回傳的初始資料 (使用者文字 & 情緒)
    # 如果是 custom，為了不要讓前端氣泡太長，我們簡化顯現，但保留詳細資訊給 Gemini
    frontend_desc = emotion_desc
    if mood == "custom" and "使用者特別說明目前心情" in emotion_desc:
        frontend_desc = "依使用者指定心情為基準"

    initial_data = {
        "user_text": user_text,
        "emotion": {
            "mood": mood,
            "description": frontend_desc,
            "confidence": confidence,
            "consultation_signal": consultation_signal,
            "recommendation_bias": recommendation_bias,
            "reason_short": reason_short,
        },
        "voice": ui_voice,
        # --- 新增：推薦預覽（不改 SSE init/chunk/done 結構） ---
        "recommendation": {
            "ranked_policy_candidates": ranked_policy_candidates,
            "recommendation_meta": recommendation_meta,
        },
        "ts": int(time.time() * 1000)
    }

    async def event_generator():
        # 首先回傳初始資料，以便前端可以即刻更新 UI STT 與表情
        yield f"data: {json.dumps({'type': 'init', 'data': initial_data})}\n\n"
        await asyncio.sleep(0)  # 确保 flush 到客戶端

        # 接著呈現 AI 出字機心情
        if enable_gemini and user_text and user_text not in ["（沒有錄到聲音）", "（未提供音訊檔案）"]:
            logger.info(f"開始串流產生 AI 回覆...")

            # 真正逐段串流：背景執行 Gemini，同步 chunk 透過 asyncio queue 回送前端。
            queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
            loop = asyncio.get_running_loop()

            def stream_gemini_chunks_to_queue() -> None:
                try:
                    for t in get_gemini_reply_stream(
                        user_text,
                        mood,
                        emotion_desc,
                        policy_context,
                        history_list,
                        reply_voice,
                        recommendation_context,
                        top_recommendation_preview,
                        allow_recommendations,
                    ):
                        asyncio.run_coroutine_threadsafe(queue.put(t), loop)
                except Exception as e:
                    logger.error(f"Gemini stream worker error: {e}")
                    asyncio.run_coroutine_threadsafe(
                        queue.put("目前 AI 服務繁忙，請稍後再試。"),
                        loop,
                    )
                finally:
                    asyncio.run_coroutine_threadsafe(queue.put(None), loop)

            threading.Thread(target=stream_gemini_chunks_to_queue, daemon=True).start()

            first_chunk_timeout_sec = float(os.getenv("CHAT_FIRST_CHUNK_HINT_SECONDS", "1.8"))
            max_wait_before_real_chunk_sec = float(
                os.getenv("CHAT_MAX_WAIT_BEFORE_REAL_CHUNK_SECONDS", "8")
            )
            wait_started_at = time.monotonic()
            first_chunk_received = False
            hint_sent = False

            while True:
                try:
                    if first_chunk_received:
                        chunk_text = await queue.get()
                    else:
                        elapsed = time.monotonic() - wait_started_at
                        remain = max_wait_before_real_chunk_sec - elapsed
                        if remain <= 0:
                            timeout_reply = _build_stream_timeout_reply(
                                user_text,
                                top_recommendation_preview,
                                recommendation_meta,
                            )
                            logger.warning(f"Gemini 首段回覆等待逾時，改回補提示: {timeout_reply}")
                            yield f"data: {json.dumps({'type': 'chunk', 'text': timeout_reply})}\n\n"
                            await asyncio.sleep(0)
                            break
                        chunk_text = await asyncio.wait_for(
                            queue.get(),
                            timeout=min(first_chunk_timeout_sec, remain),
                        )
                except asyncio.TimeoutError:
                    if not hint_sent:
                        hint_sent = True
                        yield f"data: {json.dumps({'type': 'chunk', 'text': '我正在整理你的需求，請再給我幾秒。'})}\n\n"
                        await asyncio.sleep(0)
                    continue

                if chunk_text is None:
                    break

                first_chunk_received = True
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk_text})}\n\n"
                await asyncio.sleep(0)
        elif not enable_gemini:
            yield f"data: {json.dumps({'type': 'chunk', 'text': 'Gemini 功能已停用。'})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'chunk', 'text': '因為沒有清楚聽到你說的話，所以我無法回答喔。'})}\n\n"

        process_time = time.time() - start_time
        logger.info(f"請求處理完成，花費 {process_time:.2f} 秒")
        yield f"data: {json.dumps({'type': 'done', 'process_time': round(process_time, 2)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
