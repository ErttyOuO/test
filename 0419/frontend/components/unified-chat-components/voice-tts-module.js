/**
 * TTS (Text-to-Speech) 模組
 * 負責將文字轉為語音播放，並支援不同聲線切換 (Gemini Flash TTS)
 */
const PRESET_GEMINI_TTS_API_KEY = 'AIzaSyC-H0t0ApwVeznWhNix9xWXXcj38-KD0Ac';

class TTSModule {
    constructor(options = {}) {
        const storedTtsKey = localStorage.getItem('gemini_tts_api_key') || '';
        const storedGeminiKey = localStorage.getItem('geminiApiKey') || '';
        const resolvedApiKey = options.apiKey || storedTtsKey || storedGeminiKey || PRESET_GEMINI_TTS_API_KEY;
        const fastStartEnabled = localStorage.getItem('tts_fast_start') !== '0';
        const requestTimeoutFromStorage = Number(localStorage.getItem('tts_request_timeout_ms') || '');
        const maxAttemptsFromStorage = Number(localStorage.getItem('tts_max_attempts') || '');

        this.fastStartEnabled = fastStartEnabled;
        this.ttsRequestTimeoutMs = Number.isFinite(requestTimeoutFromStorage) && requestTimeoutFromStorage > 0
            ? Math.floor(requestTimeoutFromStorage)
            : (fastStartEnabled ? 3200 : 7000);
        this.ttsMaxAttempts = Number.isFinite(maxAttemptsFromStorage) && maxAttemptsFromStorage > 0
            ? Math.max(1, Math.min(3, Math.floor(maxAttemptsFromStorage)))
            : (fastStartEnabled ? 1 : 3);

        this.options = {
            apiKey: resolvedApiKey,
            onSpeakStart: options.onSpeakStart || (() => {}),
            onSpeakEnd: options.onSpeakEnd || (() => {}),
            onError: options.onError || (() => {}),
            defaultVoice: options.defaultVoice || 'Aoede', // 溫柔女聲
            ...options
        };

        try {
            if (!storedTtsKey && resolvedApiKey) {
                localStorage.setItem('gemini_tts_api_key', resolvedApiKey);
            }
        } catch (_) {
            // 忽略 localStorage 例外，維持模組可用。
        }
        
        this.currentAudio = null;
        this.browserVoices = [];
        this.TTS_MODEL = 'gemini-2.5-flash-preview-tts';
        
        // 聲線定義
        this.VOICES = [
            { id: 'Aoede', label: '溫柔女聲', gender: 'female' },
            { id: 'Charon', label: '沉穩男聲', gender: 'male' },
            { id: 'Puck', label: '活潑男聲', gender: 'male' },
            { id: 'Kore', label: '知性女聲', gender: 'female' },
            { id: 'Fenrir', label: '低沉男聲', gender: 'male' },
            { id: 'Zephyr', label: '清亮聲線', gender: 'neutral' }
        ];
    }
    
    init() {
        if (!('speechSynthesis' in window)) {
            return;
        }

        const loadVoices = () => {
            this.browserVoices = window.speechSynthesis.getVoices();
        };

        loadVoices();
        if (typeof window.speechSynthesis.addEventListener === 'function') {
            window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
    }

    setApiKey(key) {
        this.options.apiKey = key;
        localStorage.setItem('gemini_tts_api_key', key);
    }
    
    getVoiceMap() {
        return this.VOICES;
    }

    async speak(text, voiceId = null) {
        if (!text) return;
        const vId = this.normalizeVoiceId(voiceId || this.options.defaultVoice);
        
        try {
            this.options.onSpeakStart();
            
            // 如果提供了 apiKey 才呼叫 Gemini TTS，否則使用內建 SpeechSynthesis 備用
            if (this.options.apiKey) {
                const arrayBuffer = await this.callGeminiTTS(text, vId);
                await this.playAudioBuffer(arrayBuffer);
            } else {
                this.fallbackSpeech(text, vId);
            }
        } catch (error) {
            console.error('語音合成錯誤:', error);
            this.options.onError('語音合成失敗: ' + error.message);
            // 失敗時使用內建備用
            this.fallbackSpeech(text, vId);
        }
    }
    
    stop(options = {}) {
        const silent = Boolean(options && options.silent);
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            if (this.currentAudio.src) {
                URL.revokeObjectURL(this.currentAudio.src);
            }
            this.currentAudio = null;
            if (!silent) {
                this.options.onSpeakEnd();
            }
        }
        window.speechSynthesis.cancel();
    }
    
    async playAudioBuffer(arrayBuffer) {
        return new Promise((resolve, reject) => {
            try {
                if (this.currentAudio) {
                    // 切換到新音訊時靜默停止上一段，避免誤觸發 onSpeakEnd。
                    this.stop({ silent: true });
                }
                
                const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                
                this.currentAudio = new Audio(url);
                this.currentAudio.onended = () => {
                    URL.revokeObjectURL(url);
                    this.currentAudio = null;
                    this.options.onSpeakEnd();
                    resolve();
                };
                this.currentAudio.onerror = (e) => {
                    this.options.onError('音訊播放錯誤');
                    reject(e);
                };
                
                this.currentAudio.play();
            } catch (err) {
                reject(err);
            }
        });
    }

    fallbackSpeech(text, voiceId) {
        if (!('speechSynthesis' in window)) {
            this.options.onSpeakEnd();
            return;
        }
        
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';

        const normalizedVoiceId = this.normalizeVoiceId(voiceId);
        const voices = this.getBrowserVoices();
        const targetVoice = this.pickBrowserVoice(voices, normalizedVoiceId);
        const profile = this.getFallbackVoiceProfile(normalizedVoiceId);

        if (targetVoice) {
            utterance.voice = targetVoice;
        }

        utterance.rate = profile.rate;
        utterance.pitch = profile.pitch;
        utterance.volume = profile.volume;

        utterance.onend = () => {
            this.options.onSpeakEnd();
        };
        utterance.onerror = (e) => {
            console.error('Fallback TTS 錯誤:', e);
            this.options.onSpeakEnd();
        };
        
        window.speechSynthesis.speak(utterance);
    }

    normalizeVoiceId(voiceId) {
        const aliases = {
            Aura: 'Zephyr'
        };

        return aliases[voiceId] || voiceId || this.options.defaultVoice;
    }

    getBrowserVoices() {
        const liveVoices = window.speechSynthesis.getVoices();
        if (liveVoices && liveVoices.length) {
            this.browserVoices = liveVoices;
        }
        return this.browserVoices || [];
    }

    getFallbackVoiceProfile(voiceId) {
        const profiles = {
            Aoede:  { rate: 0.96, pitch: 1.24, volume: 1.0 },
            Charon: { rate: 0.90, pitch: 0.82, volume: 1.0 },
            Puck:   { rate: 1.08, pitch: 1.12, volume: 1.0 },
            Kore:   { rate: 0.92, pitch: 1.08, volume: 1.0 },
            Fenrir: { rate: 0.84, pitch: 0.72, volume: 1.0 },
            Zephyr: { rate: 1.02, pitch: 1.32, volume: 1.0 }
        };

        return profiles[voiceId] || profiles[this.options.defaultVoice] || { rate: 1, pitch: 1, volume: 1 };
    }

    pickBrowserVoice(voices, voiceId) {
        if (!voices || !voices.length) {
            return null;
        }

        const zhVoices = voices.filter((voice) => (voice.lang || '').toLowerCase().includes('zh'));
        const pool = zhVoices.length ? zhVoices : voices;
        const preferredNames = {
            Aoede: ['xiaoxiao', 'hsiaochen', 'mei-jia', 'female', 'woman'],
            Charon: ['yunyang', 'male', 'man', 'junjie'],
            Puck: ['yunjian', 'male', 'man'],
            Kore: ['xiaoyi', 'hsiaoyu', 'female', 'woman'],
            Fenrir: ['yunxi', 'male', 'man'],
            Zephyr: ['xiaomo', 'female', 'woman']
        };
        const desiredTokens = preferredNames[voiceId] || [];

        const matchedVoice = pool.find((voice) => {
            const voiceName = (voice.name || '').toLowerCase();
            return desiredTokens.some((token) => voiceName.includes(token));
        });

        if (matchedVoice) {
            return matchedVoice;
        }

        const indexMap = {
            Aoede: 0,
            Charon: 1,
            Puck: 2,
            Kore: 3,
            Fenrir: 4,
            Zephyr: 5
        };

        const fallbackIndex = indexMap[voiceId] ?? 0;
        return pool[fallbackIndex % pool.length] || pool[0] || null;
    }
    
    async callGeminiTTS(text, voiceId) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.TTS_MODEL}:generateContent?key=${this.options.apiKey}`;

        const transcript = String(text || '').trim();
        const promptVariants = [
            transcript,
            `請只輸出語音，逐字朗讀以下內容，不要改寫、不加前後文：${transcript}`
        ];

        const maxAttempts = this.ttsMaxAttempts;
        let lastError = 'TTS 請求失敗';

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const promptText = promptVariants[Math.min(attempt - 1, promptVariants.length - 1)];
            const body = {
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceId }
                        }
                    }
                }
            };

            try {
                const controller = new AbortController();
                const timeoutHandle = setTimeout(() => controller.abort(), this.ttsRequestTimeoutMs);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                }).finally(() => {
                    clearTimeout(timeoutHandle);
                });

                let data = null;
                let rawText = '';
                try {
                    rawText = await res.text();
                    data = rawText ? JSON.parse(rawText) : null;
                } catch (_) {
                    data = null;
                }

                if (!res.ok) {
                    const apiMessage = data?.error?.message || rawText || `HTTP ${res.status}`;
                    lastError = apiMessage;

                    const shouldRetry = (
                        res.status >= 500
                        || (res.status === 400 && /generate text|only be used for tts/i.test(apiMessage))
                    );

                    if (shouldRetry && attempt < maxAttempts) {
                        await new Promise((resolve) => setTimeout(resolve, attempt * 350));
                        continue;
                    }

                    throw new Error(apiMessage || `HTTP ${res.status}`);
                }

                const part = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
                if (!part?.data) {
                    const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';
                    lastError = `API 回傳資料不含音訊 (finishReason=${finishReason})`;
                    if (attempt < maxAttempts) {
                        await new Promise((resolve) => setTimeout(resolve, attempt * 350));
                        continue;
                    }
                    throw new Error(lastError);
                }

                const pcmBytes = this.base64ToUint8Array(part.data);
                const mimeType = part.mimeType || '';

                if (mimeType.includes('wav')) {
                    return pcmBytes.buffer;
                }
                return this.pcmToWav(pcmBytes, 24000, 1, 16);
            } catch (error) {
                const msg = error && error.message ? error.message : String(error);
                const isAbort = Boolean(error && error.name === 'AbortError');
                lastError = isAbort
                    ? `Gemini TTS 請求逾時（>${this.ttsRequestTimeoutMs}ms）`
                    : (msg || lastError);
                if (attempt >= maxAttempts) {
                    throw new Error(lastError);
                }
                await new Promise((resolve) => setTimeout(resolve, attempt * 350));
            }
        }

        throw new Error(lastError);
    }
    
    base64ToUint8Array(b64) {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
    }
    
    pcmToWav(pcmData, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
        const dataLen = pcmData.length;
        const buf = new ArrayBuffer(44 + dataLen);
        const view = new DataView(buf);

        const write = (off, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
        };

        write(0, 'RIFF');
        view.setUint32(4, 36 + dataLen, true);
        write(8, 'WAVE');
        write(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
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

    destroy() {
        this.stop();
    }
}

// 導出模組
window.TTSModule = TTSModule;