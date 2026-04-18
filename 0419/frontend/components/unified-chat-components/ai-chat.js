/**
 * AI 對話模組
 * 負責聊天管理和 API 通信
 */
class AIChat {
    constructor(options = {}) {
        this.options = {
            apiBaseUrl: options.apiBaseUrl || 'http://localhost:8001',
            maxHistoryLength: options.maxHistoryLength || 50,
            ...options
        };
        
        this.chatHistory = [];
        this.isProcessing = false;
        
        // DOM 元素
        this.elements = {};
        
        // 事件回調
        this.callbacks = {
            onMessageReceived: options.onMessageReceived || (() => {}),
            onError: options.onError || (() => {}),
            onTypingStart: options.onTypingStart || (() => {}),
            onTypingStop: options.onTypingStop || (() => {})
        };
    }
    
    /**
     * 初始化 AI 聊天
     */
    init() {
        this.bindElements();
        this.bindEvents();
        this.loadHistory();
    }
    
    /**
     * 綁定 DOM 元素
     */
    bindElements() {
        this.elements = {
            chatContainer: document.getElementById(this.options.chatContainerId || 'chat-history'),
            messageInput: document.getElementById(this.options.messageInputId || 'message-input'),
            sendBtn: document.getElementById(this.options.sendBtnId || 'btn-send'),
            voiceBtn: document.getElementById(this.options.voiceBtnId || 'btn-voice'),
            clearBtn: document.getElementById(this.options.clearBtnId || 'btn-clear-chat'),
            aiSubtitles: document.getElementById(this.options.aiSubtitlesId || 'ai-subtitles')
        };
        
        if (!this.elements.chatContainer) {
            console.warn('AIChat: 聊天容器元素未找到');
        }
    }
    
    /**
     * 綁定事件
     */
    bindEvents() {
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        }
        
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearChat());
        }
    }
    
    /**
     * 發送訊息
     */
    async sendMessage(message = null, emotion = 'neutral') {
        const text = message || this.elements.messageInput?.value?.trim();
        if (!text || this.isProcessing) return;
        
        // 清空輸入框
        if (this.elements.messageInput) {
            this.elements.messageInput.value = '';
        }
        
        // 添加使用者訊息
        this.addMessageToChat('user', text);
        
        // 開始處理
        this.isProcessing = true;
        this.callbacks.onTypingStart();
        this.updateSubtitles('思考中...');
        
        try {
            const response = await this.sendToAI(text, emotion);
            this.addMessageToChat('ai', response.response);
            this.updateSubtitles(response.response.substring(0, 50) + '...');
            this.callbacks.onMessageReceived(response);
        } catch (error) {
            console.error('AI 對話錯誤:', error);
            const fallbackResponse = this.generateFallbackResponse(text, emotion);
            this.addMessageToChat('ai', fallbackResponse);
            this.updateSubtitles(fallbackResponse.substring(0, 50) + '...');
            this.callbacks.onError('AI 對話失敗，使用備用回應');
        } finally {
            this.isProcessing = false;
            this.callbacks.onTypingStop();
        }
    }
    
    /**
     * 發送到 AI 後端
     */
    async sendToAI(message, emotion) {
        const response = await fetch(`${this.options.apiBaseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                emotion: emotion,
                context: this.getChatContext()
            })
        });
        
        if (!response.ok) {
            throw new Error('AI 回應失敗');
        }
        
        return await response.json();
    }
    
    /**
     * 生成備用回應
     */
    generateFallbackResponse(message, emotion) {
        const emotionResponses = {
            'happy': [
                '看到你這麼開心我也很開心！有什麼好消息想分享嗎？',
                '你的心情很好呢！讓我們一起聊聊保險如何保障你的美好生活。'
            ],
            'sad': [
                '我感受到你有些憂慮，別擔心，我在這裡陪著你。',
                '心情不好嗎？或許我們可以聊聊如何透過保險來增加安全感。'
            ],
            'angry': [
                '我理解你現在可能有些煩躁，讓我們冷靜下來好好聊聊。',
                '看起來你有些困擾，我能幫你什麼嗎？'
            ],
            'neutral': [
                '讓我們聊聊你的保險需求吧！',
                '有什麼保險相關的問題想了解嗎？'
            ]
        };
        
        const responses = emotionResponses[emotion] || emotionResponses['neutral'];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    /**
     * 添加訊息到聊天記錄
     */
    addMessageToChat(sender, message) {
        const messageData = {
            sender: sender,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        this.chatHistory.push(messageData);
        
        // 限制歷史記錄長度
        if (this.chatHistory.length > this.options.maxHistoryLength) {
            this.chatHistory = this.chatHistory.slice(-this.options.maxHistoryLength);
        }
        
        // 更新 UI
        this.renderMessage(messageData);
        this.saveHistory();
        
        // 滾動到最新訊息
        if (this.elements.chatContainer) {
            this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
        }
    }
    
    /**
     * 渲染訊息
     */
    renderMessage(messageData) {
        if (!this.elements.chatContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageData.sender}-message`;
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${messageData.sender}-bubble`;
        bubble.textContent = messageData.message;
        
        messageDiv.appendChild(bubble);
        this.elements.chatContainer.appendChild(messageDiv);
    }
    
    /**
     * 取得聊天上下文
     */
    getChatContext() {
        return this.chatHistory.slice(-5); // 只回傳最近 5 則對話
    }
    
    /**
     * 更新字幕
     */
    updateSubtitles(text) {
        if (this.elements.aiSubtitles) {
            this.elements.aiSubtitles.textContent = text;
        }
    }
    
    /**
     * 清除聊天記錄
     */
    clearChat() {
        this.chatHistory = [];
        
        if (this.elements.chatContainer) {
            this.elements.chatContainer.innerHTML = `
                <div class="message">
                    <div class="message-bubble ai-bubble">
                        聊天記錄已清除！有什麼可以幫助你的嗎？
                    </div>
                </div>
            `;
        }
        
        this.updateSubtitles('AI 助手準備就緒');
        this.saveHistory();
    }
    
    /**
     * 語音輸入切換
     */
    async toggleVoiceInput() {
        if (!this.elements.voiceBtn) return;
        
        if (this.elements.voiceBtn.classList.contains('recording')) {
            this.stopVoiceRecording();
        } else {
            await this.startVoiceRecording();
        }
    }
    
    /**
     * 開始語音錄音
     */
    async startVoiceRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.audioRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.audioRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processVoiceInput(audioBlob);
            };
            
            this.audioRecorder.start();
            
            if (this.elements.voiceBtn) {
                this.elements.voiceBtn.classList.add('recording');
                this.elements.voiceBtn.textContent = '🔴';
            }
            
            this.updateSubtitles('語音錄音中...');
        } catch (error) {
            console.error('語音錄音啟動失敗:', error);
            this.callbacks.onError('語音錄音失敗');
        }
    }
    
    /**
     * 停止語音錄音
     */
    stopVoiceRecording() {
        if (this.audioRecorder) {
            this.audioRecorder.stop();
            
            if (this.elements.voiceBtn) {
                this.elements.voiceBtn.classList.remove('recording');
                this.elements.voiceBtn.textContent = '🎙️';
            }
            
            // 停止所有音軌
            this.audioRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }
    
    /**
     * 處理語音輸入
     */
    async processVoiceInput(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob);
            
            const response = await fetch(`${this.options.apiBaseUrl}/api/voice-input`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                const transcribedText = result.text || '';
                
                if (transcribedText) {
                    if (this.elements.messageInput) {
                        this.elements.messageInput.value = transcribedText;
                    }
                    this.updateSubtitles(`語音識別: ${transcribedText}`);
                    // 自動發送訊息
                    setTimeout(() => this.sendMessage(transcribedText), 500);
                }
            }
        } catch (error) {
            console.error('語音處理錯誤:', error);
            this.callbacks.onError('語音識別失敗');
        }
    }
    
    /**
     * 儲存聊天歷史
     */
    saveHistory() {
        try {
            localStorage.setItem('ai_chat_history', JSON.stringify(this.chatHistory));
        } catch (error) {
            console.warn('無法儲存聊天歷史:', error);
        }
    }
    
    /**
     * 載入聊天歷史
     */
    loadHistory() {
        try {
            const saved = localStorage.getItem('ai_chat_history');
            if (saved) {
                this.chatHistory = JSON.parse(saved);
                this.renderAllMessages();
            }
        } catch (error) {
            console.warn('無法載入聊天歷史:', error);
        }
    }
    
    /**
     * 渲染所有訊息
     */
    renderAllMessages() {
        if (!this.elements.chatContainer) return;
        
        this.elements.chatContainer.innerHTML = '';
        
        if (this.chatHistory.length === 0) {
            this.addMessageToChat('ai', '嗨！我是你的百保袋 AI 助手，我可以偵測你的情緒並提供貼心的保險諮詢服務。有什麼可以幫助你的嗎？');
        } else {
            this.chatHistory.forEach(message => this.renderMessage(message));
        }
    }
    
    /**
     * 取得聊天歷史
     */
    getHistory() {
        return [...this.chatHistory];
    }
    
    /**
     * 檢查是否正在處理
     */
    isProcessingMessage() {
        return this.isProcessing;
    }
    
    /**
     * 銷毀 AI 聊天
     */
    destroy() {
        // 停止錄音
        if (this.audioRecorder) {
            this.stopVoiceRecording();
        }
        
        // 移除事件監聽器
        if (this.elements.sendBtn) {
            this.elements.sendBtn.removeEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.removeEventListener('click', () => this.toggleVoiceInput());
        }
        
        if (this.elements.clearBtn) {
            this.elements.clearBtn.removeEventListener('click', () => this.clearChat());
        }
        
        this.elements = {};
        this.callbacks = {};
    }
}

// 導出模組
window.AIChat = AIChat;