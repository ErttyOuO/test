import re

file_path = "consulting.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Add id="ai-avatar" to the character image
content = content.replace(
    'src="image/agent-default-male-1.png" alt="AI Avatar" class="ai-character-image"',
    'src="image/agent-default-male-1.png" alt="AI Avatar" class="ai-character-image" id="ai-avatar"'
)

# Fix 2: Remove onkeypress="handleKeyPress(event)"
content = content.replace(
    'onkeypress="handleKeyPress(event)">',
    '>'
)

# Fix 3: Safely handle updateAIState
update_ai_old = """        function updateAIState(state) {
            const statusIndicator = document.getElementById('ai-status');
            const statusText = statusIndicator.querySelector('.status-text');
            const soundWaves = document.getElementById('sound-waves');
            const thinkingProgress = document.getElementById('thinking-progress');
            
            // 移除所有狀態類別
            statusIndicator.className = 'ai-status-indicator';
            
            switch (state) {
                case 'IDLE':
                    statusIndicator.classList.add('idle');
                    statusText.textContent = '準備就緒';
                    soundWaves.classList.remove('active');
                    thinkingProgress.classList.remove('active');
                    break;
                    
                case 'LISTENING':
                    statusIndicator.classList.add('listening');
                    statusText.textContent = '正在聆聽...';
                    soundWaves.classList.add('active');
                    thinkingProgress.classList.remove('active');
                    break;
                    
                case 'THINKING':
                    statusIndicator.classList.add('thinking');
                    statusText.textContent = '正在思考...';
                    soundWaves.classList.remove('active');
                    thinkingProgress.classList.add('active');
                    break;
                    
                case 'SPEAKING':
                    statusIndicator.classList.add('speaking');
                    statusText.textContent = '正在說話...';
                    soundWaves.classList.add('active');
                    thinkingProgress.classList.remove('active');
                    break;
            }
        }"""

update_ai_new = """        function updateAIState(state) {
            const statusIndicator = document.getElementById('ai-status');
            const statusText = statusIndicator ? statusIndicator.querySelector('.status-text') : null;
            const soundWaves = document.getElementById('sound-waves');
            const thinkingProgress = document.getElementById('thinking-progress');
            
            // 移除所有狀態類別
            if (statusIndicator) statusIndicator.className = 'ai-status-badge';
            
            switch (state) {
                case 'IDLE':
                    if (statusIndicator) statusIndicator.classList.add('idle');
                    if (statusText) statusText.textContent = '準備就緒';
                    if (soundWaves) soundWaves.classList.remove('active');
                    if (thinkingProgress) thinkingProgress.classList.remove('active');
                    break;
                    
                case 'LISTENING':
                    if (statusIndicator) statusIndicator.classList.add('listening');
                    if (statusText) statusText.textContent = '正在聆聽...';
                    if (soundWaves) soundWaves.classList.add('active');
                    if (thinkingProgress) thinkingProgress.classList.remove('active');
                    break;
                    
                case 'THINKING':
                    if (statusIndicator) statusIndicator.classList.add('thinking');
                    if (statusText) statusText.textContent = '正在思考...';
                    if (soundWaves) soundWaves.classList.remove('active');
                    if (thinkingProgress) thinkingProgress.classList.add('active');
                    break;
                    
                case 'SPEAKING':
                    if (statusIndicator) statusIndicator.classList.add('speaking');
                    if (statusText) statusText.textContent = '正在說話...';
                    if (soundWaves) soundWaves.classList.add('active');
                    if (thinkingProgress) thinkingProgress.classList.remove('active');
                    break;
            }
        }"""
content = content.replace(update_ai_old, update_ai_new)

# Fix 4: Make setAIState safe and preserve ai-status-badge
content = content.replace('statusElement.className = \'ai-status-indicator\';', 'if (statusElement) statusElement.className = \'ai-status-badge\';')
content = content.replace('avatarElement.className = \'ai-avatar-video\';', 'if (avatarElement) avatarElement.className = \'ai-character-image\';')
content = content.replace('soundWaves.className = \'sound-waves\';', 'if (soundWaves) soundWaves.className = \'sound-waves\';')
content = content.replace('thinkingProgress.className = \'thinking-progress\';', 'if (thinkingProgress) thinkingProgress.className = \'thinking-progress\';')

# Safety wrapper for add / textContent
content = re.sub(r'statusElement.classList.add\((.*?)\);', r'if (statusElement) statusElement.classList.add(\1);', content)
content = re.sub(r'statusElement.querySelector\((.*?)\).textContent = (.*?);', r'if (statusElement && statusElement.querySelector(\1)) statusElement.querySelector(\1).textContent = \2;', content)
content = re.sub(r'avatarElement.classList.add\((.*?)\);', r'if (avatarElement) avatarElement.classList.add(\1);', content)
content = re.sub(r'thinkingProgress.classList.add\((.*?)\);', r'if (thinkingProgress) thinkingProgress.classList.add(\1);', content)
content = re.sub(r'thinkingProgress.classList.remove\((.*?)\);', r'if (thinkingProgress) thinkingProgress.classList.remove(\1);', content)
content = re.sub(r'soundWaves.classList.add\((.*?)\);', r'if (soundWaves) soundWaves.classList.add(\1);', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Applied fixes to consulting.html")
