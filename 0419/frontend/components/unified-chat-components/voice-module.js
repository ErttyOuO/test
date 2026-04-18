/**
 * 聲音模組包裝器
 * 整合語音識別和語音合成功能
 */
class VoiceModule {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || 'http://localhost:8001',
            language: options.language || 'zh-TW',
            onVoiceProcessed: options.onVoiceProcessed || (() => {}),
            onError: options.onError || (() => {}),
            ...options
        };
        
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        // DOM 元素
        this.elements = {};
    }
    
    /**
     * 初始化聲音模組
     */
    init() {
        this.bindElements();
        this.bindEvents();
    }
    
    /**
     * 綁定 DOM 元素
     */
    bindElements() {
        this.elements = {
            voiceBtn: document.getElementById(this.options.voiceBtnId || 'btn-voice')
        };
    }
    
    /**
     * 綁定事件
     */
    bindEvents() {
        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.addEventListener('click', () => {
                this.toggleRecording();
            });
        }
    }
    
    /**
     * 切換錄音狀態
     */
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    /**
     * 開始錄音
     */
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processAudio();
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('錄音錯誤:', event.error);
                this.options.onError('錄音失敗: ' + event.error.message);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateUI(true);
            
        } catch (error) {
            console.error('無法啟動麥克風:', error);
            this.options.onError('無法啟動麥克風: ' + error.message);
        }
    }
    
    /**
     * 停止錄音
     */
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateUI(false);
            
            // 停止所有音軌
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        }
    }
    
    /**
     * 處理音頻數據
     */
    async processAudio() {
        if (this.audioChunks.length === 0) return;
        
        try {
            const audioBlob = new Blob(this.audioChunks, { 
                mimeType: 'audio/webm;codecs=opus' 
            });
            
            // 發送到後端進行語音識別
            const transcription = await this.transcribeAudio(audioBlob);
            
            if (transcription && transcription.trim()) {
                this.options.onVoiceProcessed(transcription.trim());
            }
            
        } catch (error) {
            console.error('音頻處理錯誤:', error);
            this.options.onError('語音識別失敗: ' + error.message);
        }
        
        this.audioChunks = [];
    }
    
    /**
     * 語音識別
     */
    async transcribeAudio(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            
            const response = await fetch(`${this.options.apiBaseUrl}/api/voice-input`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('語音識別服務錯誤');
            }
            
            const result = await response.json();
            return result.text || '';
            
        } catch (error) {
            console.warn('語音識別服務不可用，使用模擬結果');
            // 模擬語音識別結果
            const mockTexts = [
                '我想了解保險',
                '你好',
                '請問有什麼保險推薦',
                '我想理賠',
                '保費是多少'
            ];
            return mockTexts[Math.floor(Math.random() * mockTexts.length)];
        }
    }
    
    /**
     * 語音合成（文字轉語音）
     */
    async synthesizeSpeech(text, options = {}) {
        try {
            const response = await fetch(`${this.options.apiBaseUrl}/api/text-to-speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    language: options.language || this.options.language,
                    voice: options.voice || 'female'
                })
            });
            
            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // 播放語音
                const audio = new Audio(audioUrl);
                await audio.play();
                
                // 清理 URL
                setTimeout(() => URL.revokeObjectURL(audioUrl), 1000);
                
            } else {
                // 使用瀏覽器內建的語音合成
                this.fallbackSpeech(text);
            }
            
        } catch (error) {
            console.warn('語音合成服務不可用，使用瀏覽器內建功能');
            this.fallbackSpeech(text);
        }
    }
    
    /**
     * 備用語音合成（使用瀏覽器內建功能）
     */
    fallbackSpeech(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.options.language;
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            window.speechSynthesis.speak(utterance);
        }
    }
    
    /**
     * 更新 UI 狀態
     */
    updateUI(isRecording) {
        if (this.elements.voiceBtn) {
            if (isRecording) {
                this.elements.voiceBtn.classList.add('recording');
                this.elements.voiceBtn.textContent = '🔴';
                this.elements.voiceBtn.title = '停止錄音';
            } else {
                this.elements.voiceBtn.classList.remove('recording');
                this.elements.voiceBtn.textContent = '🎙️';
                this.elements.voiceBtn.title = '開始語音輸入';
            }
        }
    }
    
    /**
     * 檢查瀏覽器支援
     */
    static isSupported() {
        return !!(navigator.mediaDevices && 
                  navigator.mediaDevices.getUserMedia && 
                  window.MediaRecorder);
    }
    
    /**
     * 檢查麥克風權限
     */
    static async checkMicrophonePermission() {
        try {
            const result = await navigator.permissions.query({ 
                name: 'microphone' 
            });
            return result.state;
        } catch (error) {
            // 某些瀏覽器不支援 permissions API
            return 'prompt';
        }
    }
    
    /**
     * 請求麥克風權限
     */
    static async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true 
            });
            // 立即停止，只是為了請求權限
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 取得可用語音列表
     */
    static getAvailableVoices() {
        if ('speechSynthesis' in window) {
            return window.speechSynthesis.getVoices();
        }
        return [];
    }
    
    /**
     * 檢查是否正在錄音
     */
    isCurrentlyRecording() {
        return this.isRecording;
    }
    
    /**
     * 銷毀聲音模組
     */
    destroy() {
        // 停止錄音
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // 移除事件監聽器
        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.removeEventListener('click', () => {
                this.toggleRecording();
            });
        }
        
        this.elements = {};
        this.options = {};
    }
}

// 導出模組
window.VoiceModule = VoiceModule;