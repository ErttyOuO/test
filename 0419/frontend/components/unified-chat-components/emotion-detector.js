/**
 * Emotion detector shared by the redesigned AI chat pages.
 * It can either manage its own camera lifecycle or attach to an
 * existing webcam stream provided by the host page.
 */
const CONSULTATION_SIGNAL_MAPPING = Object.freeze({
    worried: Object.freeze({
        label: '較擔心',
        recommendationBias: 'reassure',
        recommendationLabel: '先補安心感'
    }),
    doubtful: Object.freeze({
        label: '較疑惑',
        recommendationBias: 'simplify',
        recommendationLabel: '先簡化說明'
    }),
    stable: Object.freeze({
        label: '平穩',
        recommendationBias: 'normal',
        recommendationLabel: '一般模式'
    }),
    uncertain: Object.freeze({
        label: '偵測中',
        recommendationBias: 'normal',
        recommendationLabel: '一般模式'
    })
});

function normalizeConsultationSignalState(signal) {
    const normalizedSignal = typeof signal === 'string' && CONSULTATION_SIGNAL_MAPPING[signal]
        ? signal
        : 'uncertain';
    const mapped = CONSULTATION_SIGNAL_MAPPING[normalizedSignal];
    return {
        signal: normalizedSignal,
        label: mapped.label,
        recommendationBias: mapped.recommendationBias,
        recommendationLabel: mapped.recommendationLabel,
        reasonFallback: '偵測中'
    };
}

if (!window.CONSULTATION_SIGNAL_MAPPING) {
    window.CONSULTATION_SIGNAL_MAPPING = CONSULTATION_SIGNAL_MAPPING;
}
if (!window.normalizeConsultationSignalState) {
    window.normalizeConsultationSignalState = normalizeConsultationSignalState;
}

class EmotionDetector {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || 'http://localhost:8001',
            emotionApiBaseUrl: options.emotionApiBaseUrl || options.apiBaseUrl || 'http://localhost:8001',
            emotionApiEndpoint: options.emotionApiEndpoint || '/api/emotion-detect',
            emotionApiFormat: options.emotionApiFormat || 'json',
            emotionStripDataUrl: options.emotionStripDataUrl || false,
            emotionFieldName: options.emotionFieldName || 'emotion',
            confidenceFieldName: options.confidenceFieldName || 'confidence',
            descriptionFieldName: options.descriptionFieldName || 'description',
            requestImageFieldName: options.requestImageFieldName || 'image',
            fallbackEmotionApiBaseUrl: options.fallbackEmotionApiBaseUrl || '',
            fallbackEmotionApiEndpoint: options.fallbackEmotionApiEndpoint || '/api/emotion-detect',
            fallbackEmotionApiFormat: options.fallbackEmotionApiFormat || 'json',
            fallbackEmotionStripDataUrl: options.fallbackEmotionStripDataUrl || false,
            fallbackEmotionFieldName: options.fallbackEmotionFieldName || 'emotion',
            fallbackConfidenceFieldName: options.fallbackConfidenceFieldName || 'confidence',
            fallbackDescriptionFieldName: options.fallbackDescriptionFieldName || 'description',
            consultationSignalFieldName: options.consultationSignalFieldName || 'consultation_signal',
            recommendationBiasFieldName: options.recommendationBiasFieldName || 'recommendation_bias',
            reasonShortFieldName: options.reasonShortFieldName || 'reason_short',
            fallbackConsultationSignalFieldName: options.fallbackConsultationSignalFieldName || 'consultation_signal',
            fallbackRecommendationBiasFieldName: options.fallbackRecommendationBiasFieldName || 'recommendation_bias',
            fallbackReasonShortFieldName: options.fallbackReasonShortFieldName || 'reason_short',
            fallbackRequestImageFieldName: options.fallbackRequestImageFieldName || 'image',
            autoBindControls: options.autoBindControls !== false,
            detectionInterval: options.detectionInterval || 3000,
            smoothingWindowSize: Math.max(3, Math.min(5, options.smoothingWindowSize || 5)),
            ...options
        };

        this.mediaStream = null;
        this.detectionInterval = null;
        this.currentEmotion = 'neutral';
        this.currentEmotionDescription = '';
        this.stableMood = 'neutral';
        this.stableConsultationSignal = 'uncertain';
        this.stableRecommendationBias = 'normal';
        this.stableReasonShort = '偵測中';
        this.recentEmotionSamples = [];
        this.isDetecting = false;
        this.elements = {};
        this.boundHandlers = {};

        this.callbacks = {
            onEmotionChange: options.onEmotionChange || (() => {}),
            onError: options.onError || (() => {})
        };
    }

    init() {
        this.bindElements();
        this.bindEvents();
    }

    bindElements() {
        this.elements = {
            webcam: document.getElementById(this.options.webcamId || 'webcam'),
            canvas: document.getElementById(this.options.canvasId || 'canvas'),
            emotionText: document.getElementById(this.options.emotionTextId || 'emotion-text'),
            startBtn: document.getElementById(this.options.startBtnId || 'btn-start-camera'),
            stopBtn: document.getElementById(this.options.stopBtnId || 'btn-stop-camera'),
            emotionIndicator: this.options.emotionIndicatorSelector
                ? document.querySelector(this.options.emotionIndicatorSelector)
                : document.querySelector('.emotion-indicator')
        };

        if (!this.elements.webcam) {
            console.warn('EmotionDetector: webcam element not found');
        }
    }

    bindEvents() {
        if (!this.options.autoBindControls) {
            return;
        }

        this.boundHandlers.start = () => this.startDetection();
        this.boundHandlers.stop = () => this.stopDetection();

        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', this.boundHandlers.start);
        }

        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', this.boundHandlers.stop);
        }
    }

    async startDetection() {
        try {
            await this.startCamera();
            this.startEmotionAnalysis();
            this.updateUI(true);
            this.isDetecting = true;
        } catch (error) {
            this.callbacks.onError('情緒偵測啟動失敗: ' + error.message);
        }
    }

    stopDetection() {
        this.stopCamera();
        this.stopEmotionAnalysis();
        this.updateUI(false);
        this.isDetecting = false;
        this.currentEmotion = 'neutral';
        this.currentEmotionDescription = '';
        this.stableMood = 'neutral';
        this.stableConsultationSignal = 'uncertain';
        this.stableRecommendationBias = 'normal';
        this.stableReasonShort = '偵測中';
        this.recentEmotionSamples = [];
        this.updateEmotionDisplay('neutral', 0, '');
    }

    async startCamera() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });

            if (this.elements.webcam) {
                this.elements.webcam.srcObject = this.mediaStream;
            }
        } catch (error) {
            throw new Error('無法啟動攝影機: ' + error.message);
        }
    }

    stopCamera() {
        if (!this.mediaStream) {
            return;
        }

        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;

        if (this.elements.webcam) {
            this.elements.webcam.srcObject = null;
        }
    }

    attachMediaStream(stream) {
        this.mediaStream = stream || null;
        if (this.elements.webcam) {
            this.elements.webcam.srcObject = stream || null;
        }
    }

    detachMediaStream() {
        this.mediaStream = null;
        if (this.elements.webcam) {
            this.elements.webcam.srcObject = null;
        }
    }

    startEmotionAnalysis() {
        this.stopEmotionAnalysis();

        if (!this.mediaStream) {
            return;
        }

        this.isDetecting = true;
        this.detectionInterval = setInterval(async () => {
            if (this.mediaStream && this.mediaStream.active) {
                await this.detectEmotion();
            }
        }, this.options.detectionInterval);

        this.detectEmotion().catch((error) => {
            console.warn('EmotionDetector initial detect failed:', error);
        });
    }

    stopEmotionAnalysis() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        this.isDetecting = false;
    }

    async detectEmotion() {
        try {
            if (!this.elements.canvas || !this.elements.webcam) {
                return;
            }

            const webcam = this.elements.webcam;
            if (!webcam.videoWidth || !webcam.videoHeight) {
                return;
            }

            const canvas = this.elements.canvas;
            const ctx = canvas.getContext('2d');
            canvas.width = webcam.videoWidth;
            canvas.height = webcam.videoHeight;
            ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);

            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            const rawResult = await this.requestEmotionDetection(imageData);
            const result = this._smoothEmotionPayload(rawResult);

            this.currentEmotion = result.emotion || 'neutral';
            this.currentEmotionDescription = result.description || '';
            this.stableMood = result.emotion || 'neutral';
            this.stableConsultationSignal = result.consultation_signal || 'uncertain';
            this.stableRecommendationBias = result.recommendation_bias || 'normal';
            this.stableReasonShort = result.reason_short || '偵測中';
            this.updateEmotionDisplay(this.stableMood, result.confidence || 0, this.currentEmotionDescription);
            this.callbacks.onEmotionChange(this.stableMood, result.confidence || 0, result);
        } catch (error) {
            console.warn('Emotion detection failed:', error);
            this.currentEmotion = 'unknown';
            this.currentEmotionDescription = '情緒偵測暫時不可用';
            this.stableMood = 'unknown';
            this.stableConsultationSignal = 'uncertain';
            this.stableRecommendationBias = 'normal';
            this.stableReasonShort = '偵測中';
            this.updateEmotionDisplay('unknown', 0, this.currentEmotionDescription);
            this.callbacks.onEmotionChange('unknown', 0, {
                emotion: 'unknown',
                confidence: 0,
                description: this.currentEmotionDescription,
                consultation_signal: 'uncertain',
                recommendation_bias: 'normal',
                reason_short: '偵測中',
                raw: null,
                source: 'error'
            });
        }
    }

    async requestEmotionDetection(imageData) {
        const providers = [
            {
                baseUrl: this.options.emotionApiBaseUrl,
                endpoint: this.options.emotionApiEndpoint,
                format: this.options.emotionApiFormat,
                stripDataUrl: this.options.emotionStripDataUrl,
                emotionField: this.options.emotionFieldName,
                confidenceField: this.options.confidenceFieldName,
                descriptionField: this.options.descriptionFieldName,
                consultationSignalField: this.options.consultationSignalFieldName,
                recommendationBiasField: this.options.recommendationBiasFieldName,
                reasonShortField: this.options.reasonShortFieldName,
                requestImageField: this.options.requestImageFieldName,
                source: 'camera'
            }
        ];

        if (this.options.fallbackEmotionApiBaseUrl) {
            providers.push({
                baseUrl: this.options.fallbackEmotionApiBaseUrl,
                endpoint: this.options.fallbackEmotionApiEndpoint,
                format: this.options.fallbackEmotionApiFormat,
                stripDataUrl: this.options.fallbackEmotionStripDataUrl,
                emotionField: this.options.fallbackEmotionFieldName,
                confidenceField: this.options.fallbackConfidenceFieldName,
                descriptionField: this.options.fallbackDescriptionFieldName,
                consultationSignalField: this.options.fallbackConsultationSignalFieldName,
                recommendationBiasField: this.options.fallbackRecommendationBiasFieldName,
                reasonShortField: this.options.fallbackReasonShortFieldName,
                requestImageField: this.options.fallbackRequestImageFieldName,
                source: 'camera-fallback'
            });
        }

        let lastError = null;

        for (const provider of providers) {
            try {
                return await this.callEmotionApi(provider, imageData);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('emotion detection request failed');
    }

    async callEmotionApi(provider, imageData) {
        const payload = provider.stripDataUrl ? imageData.split(',')[1] : imageData;
        const url = `${provider.baseUrl}${provider.endpoint}`;
        const requestOptions = { method: 'POST' };

        if (provider.format === 'form-data') {
            const formData = new FormData();
            formData.append(provider.requestImageField, payload);
            requestOptions.body = formData;
        } else {
            requestOptions.headers = {
                'Content-Type': 'application/json'
            };
            requestOptions.body = JSON.stringify({
                [provider.requestImageField]: payload
            });
        }

        const response = await fetch(url, requestOptions);
        if (!response.ok) {
            throw new Error(`emotion api error ${response.status}`);
        }

        const raw = await response.json();
        const emotion = raw[provider.emotionField] || 'neutral';
        const confidence = Number(raw[provider.confidenceField] || 0);
        const description = raw[provider.descriptionField] || '';
        const normalizedConsultation = normalizeConsultationSignalState(raw[provider.consultationSignalField]);
        const consultationSignal = normalizedConsultation.signal;
        const recommendationBias = normalizedConsultation.recommendationBias;
        const reasonShort = raw[provider.reasonShortField] || normalizedConsultation.reasonFallback;

        return {
            emotion,
            confidence,
            description,
            consultation_signal: consultationSignal,
            recommendation_bias: recommendationBias,
            reason_short: reasonShort,
            raw,
            source: provider.source
        };
    }

    _smoothEmotionPayload(rawResult) {
        const sample = {
            emotion: rawResult.emotion || 'neutral',
            confidence: Number(rawResult.confidence || 0),
            description: rawResult.description || '',
            consultation_signal: normalizeConsultationSignalState(rawResult.consultation_signal).signal,
            recommendation_bias: normalizeConsultationSignalState(rawResult.consultation_signal).recommendationBias,
            reason_short: rawResult.reason_short || '偵測中',
            source: rawResult.source || 'camera',
            raw: rawResult.raw || null,
        };

        this.recentEmotionSamples.push(sample);
        const windowSize = this.options.smoothingWindowSize;
        if (this.recentEmotionSamples.length > windowSize) {
            this.recentEmotionSamples = this.recentEmotionSamples.slice(-windowSize);
        }

        const counts = {
            mood: new Map(),
            signal: new Map(),
        };

        let confidenceSum = 0;
        for (const item of this.recentEmotionSamples) {
            const weight = Math.max(0.1, Number(item.confidence || 0));
            confidenceSum += Number(item.confidence || 0);
            counts.mood.set(item.emotion, (counts.mood.get(item.emotion) || 0) + weight);
            counts.signal.set(item.consultation_signal, (counts.signal.get(item.consultation_signal) || 0) + weight);
        }

        const pickTop = (map, fallback) => {
            let bestKey = fallback;
            let bestScore = -1;
            for (const [key, score] of map.entries()) {
                if (score > bestScore) {
                    bestKey = key;
                    bestScore = score;
                }
            }
            return bestKey;
        };

        const stableMood = pickTop(counts.mood, sample.emotion);
        const stableSignal = pickTop(counts.signal, sample.consultation_signal);
        const stableSignalState = normalizeConsultationSignalState(stableSignal);
        const avgConfidence = this.recentEmotionSamples.length > 0
            ? confidenceSum / this.recentEmotionSamples.length
            : Number(sample.confidence || 0);

        const latest = this.recentEmotionSamples[this.recentEmotionSamples.length - 1] || sample;
        const stableReason = latest.reason_short || '偵測中';
        const stableDescription = latest.description || '';

        if (avgConfidence < 0.6) {
            return {
                emotion: stableMood,
                confidence: avgConfidence,
                description: stableDescription,
                consultation_signal: 'uncertain',
                recommendation_bias: 'normal',
                reason_short: '偵測中',
                raw: latest.raw,
                source: `${latest.source || 'camera'}-smoothed`,
            };
        }

        return {
            emotion: stableMood,
            confidence: avgConfidence,
            description: stableDescription,
            consultation_signal: stableSignalState.signal,
            recommendation_bias: stableSignalState.recommendationBias,
            reason_short: stableReason,
            raw: latest.raw,
            source: `${latest.source || 'camera'}-smoothed`,
        };
    }

    simulateEmotionDetection() {
        const mockEmotions = ['happy', 'neutral', 'focused', 'calm'];
        const emotion = mockEmotions[Math.floor(Math.random() * mockEmotions.length)];
        const confidence = 0.7 + Math.random() * 0.3;

        this.currentEmotion = emotion;
        this.currentEmotionDescription = '';
        this.updateEmotionDisplay(emotion, confidence, '');
        this.callbacks.onEmotionChange(emotion, confidence, {
            emotion,
            confidence,
            description: '',
            consultation_signal: 'stable',
            recommendation_bias: 'normal',
            reason_short: '模擬測試',
            raw: null,
            source: 'simulated'
        });
    }

    updateEmotionDisplay(emotion, confidence, description = '') {
        if (this.elements.emotionText) {
            const confidenceValue = Number(confidence || 0);
            const confidenceThreshold = 0.7;
            const emotionMap = {
                happy: '開心',
                sad: '低落',
                angry: '生氣',
                neutral: '平穩',
                focused: '專注',
                calm: '放鬆',
                curious: '好奇',
                confused: '困惑',
                worried: '擔心',
                nervous: '緊張',
                unknown: '未知'
            };

            if (confidenceValue < confidenceThreshold || emotion === 'unknown') {
                this.elements.emotionText.textContent = '偵測中';
            } else {
                this.elements.emotionText.textContent = `${emotionMap[emotion] || emotion} (${Math.round(confidenceValue * 100)}%)`;
            }
            this.elements.emotionText.title = description || '';
        }

        if (this.elements.emotionIndicator) {
            const colorMap = {
                happy: '#59d68f',
                sad: '#ffb86c',
                angry: '#ff6b6b',
                neutral: '#9eb7c5',
                focused: '#46d4ce',
                calm: '#6fe3a6',
                curious: '#7dd3fc',
                confused: '#facc15',
                worried: '#f59e0b',
                nervous: '#fb7185',
                unknown: '#94a3b8'
            };

            this.elements.emotionIndicator.style.background = colorMap[emotion] || '#9eb7c5';
        }
    }

    updateUI(isDetecting) {
        if (!this.elements.startBtn || !this.elements.stopBtn) {
            return;
        }

        if (isDetecting) {
            this.elements.startBtn.classList.add('hidden');
            this.elements.stopBtn.classList.remove('hidden');
        } else {
            this.elements.startBtn.classList.remove('hidden');
            this.elements.stopBtn.classList.add('hidden');
        }
    }

    getCurrentEmotion() {
        return this.currentEmotion;
    }

    getCurrentEmotionDescription() {
        return this.currentEmotionDescription;
    }

    isDetectingEmotion() {
        return this.isDetecting;
    }

    destroy() {
        this.stopDetection();

        if (this.elements.startBtn && this.boundHandlers.start) {
            this.elements.startBtn.removeEventListener('click', this.boundHandlers.start);
        }

        if (this.elements.stopBtn && this.boundHandlers.stop) {
            this.elements.stopBtn.removeEventListener('click', this.boundHandlers.stop);
        }

        this.elements = {};
        this.callbacks = {};
        this.boundHandlers = {};
    }
}

window.EmotionDetector = EmotionDetector;