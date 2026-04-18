// ================================================================
// 聲音聲線調整 AI 助手 — app.js
// 使用 Gemini TTS (gemini-2.5-flash-preview-tts) 直接從前端合成語音
// ================================================================

// ================================================================
// 聲線定義：6 種聲線，均支援中文與英文
// ================================================================
const VOICES = [
  {
    id: 'Aoede',
    label: '溫柔女聲',
    gender: 'female',
    emoji: '🎀',
    color: '#e91e8c',
    desc: '音色溫暖細膩，語調自然流暢，適合客服、說明與陪伴場景',
    sample: '您好，很高興為您服務！有什麼我可以幫到您的嗎？Hello, it\'s a pleasure to assist you today!'
  },
  {
    id: 'Charon',
    label: '沉穩男聲',
    gender: 'male',
    emoji: '🎙️',
    color: '#1565c0',
    desc: '聲音沉穩有力，清晰專業，適合正式報告與新聞播報',
    sample: '今日市場分析顯示，整體趨勢保持穩健增長。Today\'s market analysis shows a steady growth trend.'
  },
  {
    id: 'Puck',
    label: '活潑男聲',
    gender: 'male',
    emoji: '✨',
    color: '#2e7d32',
    desc: '語調輕快活潑，充滿活力，適合年輕互動與娛樂內容',
    sample: '嘿！今天有什麼新鮮事？一起來聊聊吧！Hey, what\'s new today? Let\'s chat!'
  },
  {
    id: 'Kore',
    label: '知性女聲',
    gender: 'female',
    emoji: '💎',
    color: '#6a1b9a',
    desc: '語氣知性優雅，表達精準有條理，適合教學、分析與專業諮詢',
    sample: '根據現有資料分析，以下是我的三點建議。Based on the available data, here are my three recommendations.'
  },
  {
    id: 'Fenrir',
    label: '低沉男聲',
    gender: 'male',
    emoji: '🔥',
    color: '#bf360c',
    desc: '嗓音低沉磁性，極具感染力，適合廣告配音與品牌形象塑造',
    sample: '體驗不一樣的聲音世界，感受聲音的力量。Experience a different world of sound — feel the power of voice.'
  },
  {
    id: 'Zephyr',
    label: '清亮聲線',
    gender: 'neutral',
    emoji: '🌬️',
    color: '#00838f',
    desc: '聲音清澈明亮，語調平穩自然，中英文發音皆均衡流暢',
    sample: '讓我們一起探索語音技術的無限可能。Let\'s explore the infinite possibilities of voice technology together.'
  }
];

// TTS 模型（gemini-2.5-flash-preview-tts 支援最佳音質）
const TTS_MODEL   = 'gemini-2.5-flash-preview-tts';
const CHAT_MODEL  = 'gemini-2.0-flash';

// ================================================================
// 狀態
// ================================================================
let selectedVoiceId  = 'Aoede';
let currentAudio     = null;
let samplePlayingId  = null;   // 哪個聲線正在試聽
let toastTimer       = null;

// ================================================================
// 初始化
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  initVoiceGrid();
  bindEvents();
  prefillApiKey();
});

function prefillApiKey() {
  const saved = localStorage.getItem('gemini_tts_api_key') || '';
  if (saved) document.getElementById('api-key-input').value = saved;
}

// ================================================================
// 聲線卡片
// ================================================================
function initVoiceGrid() {
  const grid = document.getElementById('voice-grid');
  grid.innerHTML = VOICES.map(v => `
    <div class="voice-card ${v.id === selectedVoiceId ? 'selected' : ''}"
         data-voice="${v.id}"
         style="--card-accent: ${v.color}">
      <div class="voice-header">
        <span class="voice-emoji">${v.emoji}</span>
        <div class="voice-meta">
          <div class="voice-name">
            ${v.id}
            <span class="voice-tag">${v.label}</span>
          </div>
          <div class="voice-gender">${v.gender === 'female' ? '女聲' : v.gender === 'male' ? '男聲' : '中性'} · 中 / EN</div>
        </div>
        <div class="voice-check ${v.id === selectedVoiceId ? 'visible' : ''}">✓</div>
      </div>
      <p class="voice-desc">${v.desc}</p>
      <button class="btn-sample" data-voice="${v.id}" id="btn-sample-${v.id}">▶ 試聽範例</button>
    </div>
  `).join('');

  // 點擊卡片選擇聲線
  grid.querySelectorAll('.voice-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.classList.contains('btn-sample')) return;
      selectVoice(card.dataset.voice);
    });
  });

  // 試聽按鈕
  grid.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const voice = VOICES.find(v => v.id === btn.dataset.voice);
      if (voice) playSample(voice);
    });
  });
}

function selectVoice(voiceId) {
  selectedVoiceId = voiceId;
  document.querySelectorAll('.voice-card').forEach(card => {
    const active = card.dataset.voice === voiceId;
    card.classList.toggle('selected', active);
    card.querySelector('.voice-check').classList.toggle('visible', active);
  });
}

async function playSample(voice) {
  const btn = document.getElementById(`btn-sample-${voice.id}`);
  if (btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  btn.textContent = '⏳ 載入中...';
  samplePlayingId = voice.id;

  try {
    const audioBuffer = await callGeminiTTS(voice.sample, voice.id);
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    const tmp  = new Audio(url);
    tmp.play();
    tmp.onended = () => URL.revokeObjectURL(url);
  } catch (e) {
    showToast(`試聽失敗：${e.message}`, 'error');
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '▶ 試聽範例';
    samplePlayingId = null;
  }
}

// ================================================================
// 事件綁定
// ================================================================
function bindEvents() {
  // Settings toggle
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('collapsed');
  });

  document.getElementById('btn-save-key').addEventListener('click', saveApiKey);
  document.getElementById('api-key-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveApiKey();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // TTS
  const ttsTextarea = document.getElementById('tts-text');
  ttsTextarea.addEventListener('input', () => {
    document.getElementById('char-count').textContent = ttsTextarea.value.length;
  });
  document.getElementById('btn-speak').addEventListener('click', handleSpeak);

  // Chat
  document.getElementById('btn-chat-send').addEventListener('click', handleChat);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleChat();
  });

  // Audio controls
  document.getElementById('speed-slider').addEventListener('input', e => {
    const v = parseFloat(e.target.value).toFixed(1);
    document.getElementById('speed-val').textContent = v;
    if (currentAudio) currentAudio.playbackRate = parseFloat(v);
  });
  document.getElementById('vol-slider').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    document.getElementById('vol-val').textContent = v;
    if (currentAudio) currentAudio.volume = v / 100;
  });
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { showToast('請輸入 API Key', 'error'); return; }
  localStorage.setItem('gemini_tts_api_key', key);
  showToast('API Key 已儲存', 'success');
  document.getElementById('settings-panel').classList.add('collapsed');
}

function getApiKey() {
  return localStorage.getItem('gemini_tts_api_key') || '';
}

// ================================================================
// TTS 主流程
// ================================================================
async function handleSpeak() {
  const text = document.getElementById('tts-text').value.trim();
  if (!text) { showToast('請輸入要轉換的文字', 'error'); return; }
  if (!getApiKey()) { promptApiKey(); return; }

  showLoading('生成語音中...');
  try {
    const buf = await callGeminiTTS(text, selectedVoiceId);
    showAudioPlayer(buf, selectedVoiceId);
  } catch (e) {
    showToast(`語音生成失敗：${e.message}`, 'error');
  } finally {
    hideLoading();
  }
}

// ================================================================
// AI 對話 + 語音播放
// ================================================================
async function handleChat() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  if (!getApiKey()) { promptApiKey(); return; }

  addChatBubble('user', text);
  input.value = '';
  input.disabled = true;
  document.getElementById('btn-chat-send').disabled = true;

  showLoading('AI 思考中...');

  try {
    // Step 1：取得 AI 文字回覆
    const replyText = await callGeminiChat(text);
    if (!replyText) throw new Error('AI 沒有回傳內容');

    // Step 2：合成語音
    document.getElementById('loading-text').textContent = '合成語音中...';
    const buf = await callGeminiTTS(replyText, selectedVoiceId);

    // Step 3：顯示氣泡 + 播放
    const blob   = new Blob([buf], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(blob);

    addChatBubble('ai', replyText, audioUrl);
    showAudioPlayer(buf, selectedVoiceId);

  } catch (e) {
    addChatBubble('error', `⚠️ ${e.message}`);
    showToast(`錯誤：${e.message}`, 'error');
  } finally {
    hideLoading();
    input.disabled = false;
    document.getElementById('btn-chat-send').disabled = false;
    input.focus();
  }
}

function addChatBubble(type, text, audioUrl = null) {
  const history = document.getElementById('chat-history');

  // 清除空白提示
  const empty = history.querySelector('.chat-empty');
  if (empty) empty.remove();

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;

  if (type === 'user') {
    bubble.innerHTML = `<span class="bubble-label">你</span><span>${escapeHtml(text)}</span>`;
  } else if (type === 'ai') {
    const voice = VOICES.find(v => v.id === selectedVoiceId);
    const playBtn = audioUrl
      ? `<button class="bubble-play-btn" data-url="${audioUrl}">▶ 重新播放</button>`
      : '';
    bubble.innerHTML = `
      <span class="bubble-label">${voice ? voice.emoji + ' ' + voice.label : 'AI'}</span>
      <span>${escapeHtml(text)}</span>
      ${playBtn}
    `;
    if (audioUrl) {
      bubble.querySelector('.bubble-play-btn').addEventListener('click', function () {
        const a = new Audio(this.dataset.url);
        a.play();
      });
    }
  } else {
    bubble.innerHTML = `<span>${escapeHtml(text)}</span>`;
  }

  history.appendChild(bubble);
  history.scrollTop = history.scrollHeight;
}

// ================================================================
// 音訊播放器
// ================================================================
function showAudioPlayer(arrayBuffer, voiceId) {
  const section = document.getElementById('audio-player-section');
  section.style.display = '';

  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
  const url  = URL.createObjectURL(blob);

  const audioEl = document.getElementById('main-audio');
  if (currentAudio) {
    currentAudio.pause();
    if (currentAudio.src) URL.revokeObjectURL(currentAudio.src);
  }

  audioEl.src = url;
  audioEl.playbackRate = parseFloat(document.getElementById('speed-slider').value);
  audioEl.volume = parseInt(document.getElementById('vol-slider').value) / 100;
  audioEl.play();
  currentAudio = audioEl;

  const voice = VOICES.find(v => v.id === voiceId);
  document.getElementById('player-voice-info').textContent =
    voice ? `${voice.emoji}  ${voice.id} — ${voice.label}` : voiceId;

  const statusEl = document.getElementById('player-status');
  statusEl.textContent = '播放中';
  statusEl.className = 'player-status playing';

  audioEl.onended = () => {
    statusEl.textContent = '播放完畢';
    statusEl.className = 'player-status ready';
  };
}

// ================================================================
// Gemini TTS API 呼叫
// 回傳 ArrayBuffer (WAV)
// ================================================================
async function callGeminiTTS(text, voiceId) {
  const key = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`;

  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceId }
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.error?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!part?.data) throw new Error('API 回傳資料不含音訊');

  const pcmBytes   = base64ToUint8Array(part.data);
  const mimeType   = part.mimeType || '';

  // Gemini TTS 通常回傳 audio/L16;rate=24000 (raw PCM) 或 audio/wav
  if (mimeType.includes('wav')) {
    return pcmBytes.buffer;
  }
  // 其他情況視為 16-bit PCM @ 24000Hz
  return pcmToWav(pcmBytes, 24000, 1, 16);
}

// ================================================================
// Gemini Chat API 呼叫（取得文字回覆）
// ================================================================
async function callGeminiChat(userText) {
  const key = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${key}`;

  const body = {
    contents: [{
      parts: [{
        text: `你是一位親切的 AI 語音助手，請用繁體中文回答以下問題（60字以內，簡潔自然，適合用語音播放）：\n${userText}`
      }]
    }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.error?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ================================================================
// PCM → WAV 轉換（加上 WAV 標頭）
// ================================================================
function pcmToWav(pcmData, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const dataLen = pcmData.length;
  const buf     = new ArrayBuffer(44 + dataLen);
  const view    = new DataView(buf);

  const write = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  write(0,  'RIFF');
  view.setUint32(4,  36 + dataLen, true);
  write(8,  'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,  true);                                       // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, 'data');
  view.setUint32(40, dataLen, true);
  new Uint8Array(buf, 44).set(pcmData);

  return buf;
}

function base64ToUint8Array(b64) {
  const bin  = atob(b64);
  const arr  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ================================================================
// UI 輔助
// ================================================================
function promptApiKey() {
  document.getElementById('settings-panel').classList.remove('collapsed');
  document.getElementById('api-key-input').focus();
  showToast('請先輸入並儲存 Gemini API Key', 'error');
}

function showLoading(text = '處理中...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(msg, type = 'info') {
  clearTimeout(toastTimer);
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  // 強制 reflow 再加 show
  void toast.offsetWidth;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
