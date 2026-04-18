/**
 * AI 對話整合系統管理器
 * 統一管理情緒偵測、AI 對話和 Avatar 系統
 */
class UnifiedChatManager {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || 'http://localhost:8001',
            position: options.position || 'bottom-right',
            defaultOpen: options.defaultOpen || false,
            enableEmotionDetection: options.enableEmotionDetection !== false,
            enableVoiceInput: options.enableVoiceInput !== false,
            enableAvatar: options.enableAvatar !== false,
            ...options
        };
        
        this.isOpen = false;
        this.currentEmotion = 'neutral';
        
        // 子系統實例
        this.emotionDetector = null;
        this.aiChat = null;
        this.avatarSystem = null;
        
        // DOM 元素
        this.elements = {};
        
        this.init();
    }
    
    /**
     * 初始化整合管理器
     */
    init() {
        this.createUI();
        this.bindElements();
        this.bindEvents();
        this.initSubSystems();
        
        // 預設開啟狀態
        if (this.options.defaultOpen) {
            this.open();
        }
    }
    
    /**
     * 創建 UI 結構
     */
    createUI() {
        // 檢查是否已存在
        if (document.getElementById('ai-assistant-container')) {
            return;
        }
        
        // 在 consulting.html 頁面也要創建浮動按鈕（但隱藏浮動視窗）
        // const isConsultingPage = window.location.pathname.includes('consulting.html');
        // if (isConsultingPage) {
        //     console.log('AI 視訊諮詢頁面 - 創建美化版浮動按鈕');
        // }
        
        const container = document.createElement('div');
        container.id = 'ai-assistant-container';
        container.innerHTML = `
            <!-- 浮動助手按鈕 -->
            <button id="ai-assistant-toggle" class="ai-assistant-toggle">
                🤖
            </button>
            
            <!-- AI 對話整合系統 -->
            <script src="unified-chat-components/emotion-detector.js"></script>
            <script src="unified-chat-components/ai-chat.js"></script>
            <script src="unified-chat-components/avatar-system.js"></script>
            <script src="unified-chat-components/voice-module.js"></script>
            <script src="unified-chat-components/voice-tts-module.js"></script>
            <script src="unified-chat-manager.js"></script>
            
            <!-- 對話視窗 -->
            <div id="ai-chat-modal" class="ai-chat-modal hidden">
                <div class="ai-chat-header">
                    <h3>🤖 百保袋 AI 助手</h3>
                    <button id="close-ai-chat" class="close-btn">×</button>
                </div>
                <div class="ai-chat-content">
                    <!-- 情緒偵測面板 -->
                    <div class="emotion-detection-panel">
                        <div class="emotion-header">
                            <div class="emotion-title">📹 情緒偵測</div>
                            <div class="emotion-status">
                                <div class="emotion-indicator"></div>
                                <span id="emotion-text">偵測中...</span>
                            </div>
                        </div>
                        <div class="camera-view-mini">
                            <video id="webcam" autoplay playsinline muted></video>
                            <canvas id="canvas" style="display:none;"></canvas>
                        </div>
                        <div class="camera-controls-mini">
                            <button id="btn-start-camera" class="send-button-mini">啟動</button>
                            <button id="btn-stop-camera" class="voice-button-mini hidden">停止</button>
                        </div>
                    </div>
                    
                    <!-- Avatar 區域 -->
                    <div class="avatar-section-mini">
                        <div class="ai-avatar-mini">
                            <img id="ai-avatar-img" src="./image/agent-default-male-1.png" alt="百保袋 AI 人像">
                            <div class="ai-status-indicator-mini">●</div>
                        </div>
                        <div id="ai-subtitles" class="ai-subtitles-mini">
                            AI 助手準備就緒
                        </div>
                        
                        <!-- 聲線選擇器 -->
                        <div class="voice-selector-mini">
                            <select id="voice-select" class="voice-select-mini">
                                <option value="Charon">🎙️ 沉穩男聲</option>
                                <option value="Aoede">🎀 溫柔女聲</option>
                                <option value="Puck">✨ 活潑男聲</option>
                                <option value="Kore">💎 知性女聲</option>
                                <option value="Fenrir">🔥 低沉男聲</option>
                                <option value="Zephyr">🌟 清亮女聲</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- 聊天區域 -->
                    <div class="chat-section-mini">
                        <div class="chat-container-mini" id="chat-history">
                            <div class="message-mini">
                                <div class="message-bubble-mini ai-bubble-mini">
                                    嗨！我是你的百保袋 AI 助手，我可以偵測你的情緒並提供貼心的保險諮詢服務。有什麼可以幫助你的嗎？
                                </div>
                            </div>
                        </div>
                        <div class="input-section-mini">
                            <input type="text" id="message-input" class="message-input-mini" placeholder="輸入訊息...">
                            <button id="btn-voice" class="voice-button-mini">🎙️</button>
                            <button id="btn-send" class="send-button-mini">📤</button>
                            <button id="btn-clear-chat" class="clear-button-mini">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
    }
    
    /**
     * 綁定 DOM 元素
     */
    bindElements() {
        // 在 consulting.html 頁面也要綁定浮動按鈕元素（但不綁定浮動視窗）
        // const isConsultingPage = window.location.pathname.includes('consulting.html');
        // if (isConsultingPage) {
        //     console.log('AI 視訊諮詢頁面 - 只綁定浮動按鈕');
        //     this.elements = { 
        //         toggleBtn: document.getElementById('ai-assistant-toggle'), 
        //         modal: null, 
        //         closeBtn: null 
        //     };
        //     return;
        // }
        
        this.elements = {
            toggleBtn: document.getElementById('ai-assistant-toggle'),
            modal: document.getElementById('ai-chat-modal'),
            closeBtn: document.getElementById('close-ai-chat')
        };
    }
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 在 consulting.html 頁面也要綁定浮動按鈕事件（但不處理浮動視窗）
        // const isConsultingPage = window.location.pathname.includes('consulting.html');
        // if (isConsultingPage) {
        //     console.log('AI 視訊諮詢頁面 - 只綁定浮動按鈕事件');
        //     if (this.elements.toggleBtn) {
        //         this.elements.toggleBtn.addEventListener('click', () => {
        //             // 在視訊頁面可以添加自定義行為
        //             console.log('浮動客服按鈕被點擊 - 視訊頁面');
        //         });
        //     }
        //     return;
        // }
        
        if (this.elements.toggleBtn) {
            this.elements.toggleBtn.addEventListener('click', () => this.toggle());
        }
        
        if (this.elements.closeBtn) {
            this.elements.closeBtn.addEventListener('click', () => this.close());
        }
        
        // 點擊外部關閉
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.elements.modal.contains(e.target) && 
                !this.elements.toggleBtn.contains(e.target)) {
                this.close();
            }
        });
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    /**
     * 初始化子系統
     */
    initSubSystems() {
        // 初始化情緒偵測器
        if (this.options.enableEmotionDetection) {
            this.emotionDetector = new EmotionDetector({
                apiBaseUrl: this.options.apiBaseUrl,
                onEmotionChange: (emotion, confidence) => {
                    this.currentEmotion = emotion;
                    this.onEmotionChange(emotion, confidence);
                },
                onError: (error) => {
                    console.error('情緒偵測錯誤:', error);
                }
            });
            this.emotionDetector.init();
        }
        
        // 初始化 AI 聊天
        this.aiChat = new AIChat({
            apiBaseUrl: this.options.apiBaseUrl,
            onMessageReceived: (response) => {
                this.onMessageReceived(response);
            },
            onError: (error) => {
                console.error('AI 聊天錯誤:', error);
            },
            onTypingStart: () => {
                this.onTypingStart();
            },
            onTypingStop: () => {
                this.onTypingStop();
            }
        });
        this.aiChat.init();
        
        // 初始化 Avatar 系統
        if (this.options.enableAvatar) {
            // 等待 DOM 準備好
            setTimeout(() => {
                if (window.AvatarSystem) {
                    this.avatarSystem = new AvatarSystem();
                }
            }, 100);
        }
        
        // 初始化聲音模組
        if (this.options.enableVoiceInput && window.VoiceModule) {
            setTimeout(() => {
                this.voiceModule = new VoiceModule({
                    onVoiceProcessed: (text) => {
                        this.onVoiceProcessed(text);
                    },
                    onError: (error) => {
                        console.error('聲音處理錯誤:', error);
                    }
                });
                this.voiceModule.init();
            }, 200);
        }
        
        // 初始化 TTS 模組
        if (this.options.enableVoiceInput && window.TTSModule) {
            setTimeout(() => {
                this.ttsModule = new TTSModule({
                    onError: (error) => {
                        console.error('TTS 錯誤:', error);
                    }
                });
                this.ttsModule.init();
            }, 300);
        }
    }
    
    /**
     * 情緒變化回調
     */
    onEmotionChange(emotion, confidence) {
        // 更新 Avatar 表情
        if (this.avatarSystem) {
            this.avatarSystem.setEmotion(emotion);
        }
        
        // 觸發自定義事件
        this.dispatchEvent('emotionChange', { emotion, confidence });
    }
    
    /**
     * 訊息接收回調
     */
    onMessageReceived(response) {
        // 觸發 Avatar 特殊動畫
        if (this.avatarSystem) {
            this.triggerAvatarAnimation(response.response || '');
        }
        
        // 播放 TTS 語音
        if (this.ttsModule && response.response) {
            // 根據情緒選擇合適的聲線
            const voiceId = this.getVoiceForEmotion(this.currentEmotion);
            this.ttsModule.speak(response.response, voiceId);
        }
        
        // 觸發自定義事件
        this.dispatchEvent('messageReceived', response);
    }
    
    /**
     * 根據情緒選擇聲線
     */
    getVoiceForEmotion(emotion) {
        const emotionVoiceMap = {
            'happy': 'Aoede',      // 溫柔女聲
            'sad': 'Kore',         // 知性女聲
            'angry': 'Fenrir',     // 低沉男聲
            'neutral': 'Charon',   // 沉穩男聲
            'focused': 'Kore',     // 知性女聲
            'calm': 'Aoede'        // 溫柔女聲
        };
        return emotionVoiceMap[emotion] || 'Charon';
    }
    
    /**
     * 開始輸入回調
     */
    onTypingStart() {
        this.updateSubtitles('AI 正在思考...');
        this.dispatchEvent('typingStart');
    }
    
    /**
     * 停止輸入回調
     */
    onTypingStop() {
        this.dispatchEvent('typingStop');
    }
    
    /**
     * 聲音處理回調
     */
    onVoiceProcessed(text) {
        if (text && this.aiChat) {
            // 自動發送語音識別的訊息
            this.aiChat.sendMessage(text, this.currentEmotion);
        }
        this.dispatchEvent('voiceProcessed', { text });
    }
    
    /**
     * 觸發 Avatar 動畫
     */
    triggerAvatarAnimation(message) {
        if (!this.avatarSystem) return;
        
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('你好') || lowerMessage.includes('嗨') || lowerMessage.includes('哈囉')) {
            this.avatarSystem.triggerSpecialAnimation('greeting');
        } else if (lowerMessage.includes('再見') || lowerMessage.includes('拜拜') || lowerMessage.includes('結束')) {
            this.avatarSystem.triggerSpecialAnimation('goodbye');
        } else if (lowerMessage.includes('想') || lowerMessage.includes('考慮') || lowerMessage.includes('思考')) {
            this.avatarSystem.triggerSpecialAnimation('thinking');
        } else if (lowerMessage.includes('了解') || lowerMessage.includes('明白') || lowerMessage.includes('懂')) {
            this.avatarSystem.triggerSpecialAnimation('understanding');
        } else if (lowerMessage.includes('開心') || lowerMessage.includes('高興') || lowerMessage.includes('興奮')) {
            this.avatarSystem.triggerSpecialAnimation('excitement');
        }
    }
    
    /**
     * 更新字幕
     */
    updateSubtitles(text) {
        const subtitles = document.getElementById('ai-subtitles');
        if (subtitles) {
            subtitles.textContent = text;
        }
    }
    
    /**
     * 開啟對話視窗
     */
    open() {
        if (this.isOpen) return;
        
        // 檢查當前頁面是否是 consulting.html（AI 視訊諮詢頁）
        if (window.location.pathname.includes('consulting.html')) {
            console.log('AI 視訊諮詢頁面 - 跳過開啟浮動視窗');
            return;
        }
        
        this.isOpen = true;
        
        // 顯示模態框
        if (this.elements.modal) {
            this.elements.modal.classList.remove('hidden');
        }
        
        // 更新按鈕文字
        if (this.elements.toggleBtn) {
            this.elements.toggleBtn.textContent = '💬';
        }
        
        this.dispatchEvent('open');
    }
    
    /**
     * 關閉對話視窗
     */
    close() {
        if (!this.isOpen) return;
        
        // 檢查當前頁面是否是 consulting.html（AI 視訊諮詢頁）
        if (window.location.pathname.includes('consulting.html')) {
            console.log('AI 視訊諮詢頁面 - 跳過關閉浮動視窗');
            return;
        }
        
        this.isOpen = false;
        
        // 隱藏模態框
        if (this.elements.modal) {
            this.elements.modal.classList.add('hidden');
        }
        
        // 更新按鈕文字
        if (this.elements.toggleBtn) {
            this.elements.toggleBtn.textContent = '🤖';
        }
        
        this.dispatchEvent('close');
    }
    
    /**
     * 切換開關狀態
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * 發送訊息
     */
    sendMessage(message, emotion = null) {
        if (this.aiChat) {
            this.aiChat.sendMessage(message, emotion || this.currentEmotion);
        }
    }
    
    /**
     * 取得當前情緒
     */
    getCurrentEmotion() {
        return this.currentEmotion;
    }
    
    /**
     * 檢查是否開啟
     */
    isOpened() {
        return this.isOpen;
    }
    
    /**
     * 設定位置
     */
    setPosition(position) {
        // 檢查當前頁面是否是 consulting.html（AI 視訊諮詢頁）
        if (window.location.pathname.includes('consulting.html')) {
            console.log('AI 視訊諮詢頁面 - 跳過設定浮動按鈕位置');
            return;
        }
        
        this.options.position = position;
        
        if (this.elements.modal) {
            // 移除現有位置類別
            this.elements.modal.classList.remove('position-bottom-right', 'position-bottom-left');
            
            // 添加新位置類別
            this.elements.modal.classList.add(`position-${position}`);
        }
        
        if (this.elements.toggleBtn) {
            // 移除現有位置類別
            this.elements.toggleBtn.classList.remove('position-bottom-right', 'position-bottom-left');
            
            // 添加新位置類別
            this.elements.toggleBtn.classList.add(`position-${position}`);
        }
    }
    
    /**
     * 觸發自定義事件
     */
    dispatchEvent(eventName, data = {}) {
        const event = new CustomEvent(`unifiedChat:${eventName}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }
    
    /**
     * 監聽事件
     */
    on(eventName, callback) {
        document.addEventListener(`unifiedChat:${eventName}`, callback);
    }
    
    /**
     * 移除事件監聽
     */
    off(eventName, callback) {
        document.removeEventListener(`unifiedChat:${eventName}`, callback);
    }
    
    /**
     * 銷毀管理器
     */
    destroy() {
        // 銷毀子系統
        if (this.emotionDetector) {
            this.emotionDetector.destroy();
        }
        
        if (this.aiChat) {
            this.aiChat.destroy();
        }
        
        // 移除 DOM 元素
        const container = document.getElementById('ai-assistant-container');
        if (container) {
            container.remove();
        }
        
        // 移除事件監聽器
        document.removeEventListener('click', this.closeHandler);
        document.removeEventListener('keydown', this.escapeHandler);
        
        this.elements = {};
    }
}

// 導出模組
window.UnifiedChatManager = UnifiedChatManager;