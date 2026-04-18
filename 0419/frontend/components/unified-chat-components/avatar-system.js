/**
 * Shared avatar controller for the redesigned AI chat experiences.
 * It keeps the existing public API while making emotion handling
 * more tolerant for the face-emotion module.
 */
class AvatarSystem {
    constructor(options = {}) {
        this.options = {
            avatarElementId: options.avatarElementId || 'ai-avatar',
            avatarImageId: options.avatarImageId || 'ai-avatar-img',
            subtitlesId: options.subtitlesId || 'ai-subtitles',
            statusIndicatorSelector: options.statusIndicatorSelector || '.ai-status-indicator',
            syncSubtitlesOnEmotionChange: options.syncSubtitlesOnEmotionChange !== false,
            ...options
        };

        this.currentEmotion = 'neutral';
        this.currentExpression = 'neutral';
        this.isAnimating = false;
        this.avatarElement = null;
        this.avatarImage = null;

        this.expressions = {
            happy: {
                images: [
                    './image/agent-happy-1.png',
                    './image/agent-happy-2.png',
                    './image/agent-smile.png'
                ],
                animations: ['bounce', 'pulse', 'wiggle'],
                colors: ['#59d68f', '#6fe3a6', '#46d4ce'],
                description: '開心回應'
            },
            sad: {
                images: [
                    './image/agent-concerned-1.png',
                    './image/agent-concerned-2.png',
                    './image/agent-worried.png'
                ],
                animations: ['gentle-sway', 'soft-pulse'],
                colors: ['#ffb86c', '#ffa500', '#ff8c00'],
                description: '溫柔安撫'
            },
            angry: {
                images: [
                    './image/agent-calm-1.png',
                    './image/agent-calm-2.png',
                    './image/agent-serious.png'
                ],
                animations: ['steady', 'calm-breathing'],
                colors: ['#ff6b6b', '#ff5252', '#ff4444'],
                description: '冷靜穩定'
            },
            neutral: {
                images: [
                    './image/agent-default-male-1.png',
                    './image/agent-default-male-2.png',
                    './image/agent-default-female-1.png'
                ],
                animations: ['gentle-bob', 'subtle-pulse'],
                colors: ['#9eb7c5', '#a6c6d5', '#b8c8d8'],
                description: '平穩待命'
            },
            focused: {
                images: [
                    './image/agent-thinking-1.png',
                    './image/agent-thinking-2.png',
                    './image/agent-analyzing.png'
                ],
                animations: ['nod', 'thinking-tap', 'focus-pulse'],
                colors: ['#46d4ce', '#4dd0e1', '#26c6da'],
                description: '專注分析'
            },
            calm: {
                images: [
                    './image/agent-relaxed-1.png',
                    './image/agent-relaxed-2.png',
                    './image/agent-peaceful.png'
                ],
                animations: ['gentle-breathing', 'soft-sway'],
                colors: ['#6fe3a6', '#81c784', '#66bb6a'],
                description: '放鬆陪伴'
            }
        };

        this.animations = {
            bounce: {
                keyframes: [
                    { transform: 'translateY(0px) scale(1)' },
                    { transform: 'translateY(-10px) scale(1.05)' },
                    { transform: 'translateY(0px) scale(1)' }
                ],
                duration: 1000,
                easing: 'ease-in-out'
            },
            pulse: {
                keyframes: [
                    { transform: 'scale(1)', opacity: 1 },
                    { transform: 'scale(1.1)', opacity: 0.8 },
                    { transform: 'scale(1)', opacity: 1 }
                ],
                duration: 1500,
                easing: 'ease-in-out'
            },
            wiggle: {
                keyframes: [
                    { transform: 'rotate(0deg)' },
                    { transform: 'rotate(5deg)' },
                    { transform: 'rotate(-5deg)' },
                    { transform: 'rotate(0deg)' }
                ],
                duration: 800,
                easing: 'ease-in-out'
            },
            'gentle-sway': {
                keyframes: [
                    { transform: 'translateX(0px)' },
                    { transform: 'translateX(5px)' },
                    { transform: 'translateX(0px)' },
                    { transform: 'translateX(-5px)' },
                    { transform: 'translateX(0px)' }
                ],
                duration: 2000,
                easing: 'ease-in-out'
            },
            'soft-pulse': {
                keyframes: [
                    { opacity: 1 },
                    { opacity: 0.7 },
                    { opacity: 1 }
                ],
                duration: 2000,
                easing: 'ease-in-out'
            },
            steady: {
                keyframes: [{ transform: 'scale(1)' }],
                duration: 1000,
                easing: 'linear'
            },
            'calm-breathing': {
                keyframes: [
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.02)' },
                    { transform: 'scale(1)' }
                ],
                duration: 3000,
                easing: 'ease-in-out'
            },
            'gentle-bob': {
                keyframes: [
                    { transform: 'translateY(0px)' },
                    { transform: 'translateY(-3px)' },
                    { transform: 'translateY(0px)' }
                ],
                duration: 1500,
                easing: 'ease-in-out'
            },
            'subtle-pulse': {
                keyframes: [
                    { opacity: 1 },
                    { opacity: 0.9 },
                    { opacity: 1 }
                ],
                duration: 2500,
                easing: 'ease-in-out'
            },
            nod: {
                keyframes: [
                    { transform: 'rotate(0deg)' },
                    { transform: 'rotate(10deg)' },
                    { transform: 'rotate(0deg)' }
                ],
                duration: 800,
                easing: 'ease-in-out'
            },
            'thinking-tap': {
                keyframes: [
                    { transform: 'translateY(0px)' },
                    { transform: 'translateY(2px)' },
                    { transform: 'translateY(0px)' }
                ],
                duration: 600,
                easing: 'ease-in-out'
            },
            'focus-pulse': {
                keyframes: [
                    { transform: 'scale(1)', filter: 'brightness(1)' },
                    { transform: 'scale(1.05)', filter: 'brightness(1.2)' },
                    { transform: 'scale(1)', filter: 'brightness(1)' }
                ],
                duration: 1200,
                easing: 'ease-in-out'
            },
            'gentle-breathing': {
                keyframes: [
                    { transform: 'scale(1)' },
                    { transform: 'scale(1.03)' },
                    { transform: 'scale(1)' }
                ],
                duration: 4000,
                easing: 'ease-in-out'
            }
        };

        this.init();
    }

    init() {
        this.avatarElement = document.getElementById(this.options.avatarElementId);
        this.avatarImage = document.getElementById(this.options.avatarImageId);

        if (!this.avatarElement || !this.avatarImage) {
            console.warn('AvatarSystem: required DOM elements not found');
            return;
        }

        this.setEmotion('neutral');
        this.startBackgroundAnimation();
    }

    normalizeEmotion(emotion) {
        const emotionMap = {
            worried: 'sad',
            nervous: 'sad',
            confused: 'focused',
            curious: 'focused',
            unknown: 'neutral'
        };

        return emotionMap[emotion] || emotion || 'neutral';
    }

    setEmotion(emotion) {
        const normalizedEmotion = this.normalizeEmotion(emotion);
        if (this.currentEmotion === normalizedEmotion) {
            return;
        }

        this.currentEmotion = normalizedEmotion;
        const expression = this.expressions[normalizedEmotion];

        if (!expression) {
            console.warn(`AvatarSystem: unsupported emotion ${normalizedEmotion}`);
            return;
        }

        this.updateImage(expression);
        this.updateColor(expression);
        this.playAnimation(expression);
        this.updateStatusIndicator(expression.description);
    }

    updateImage(expression) {
        const randomImage = expression.images[Math.floor(Math.random() * expression.images.length)];
        this.avatarImage.style.opacity = '0';

        setTimeout(() => {
            this.avatarImage.src = randomImage;
            this.avatarImage.onerror = () => {
                this.avatarImage.src = './image/agent-default-male-1.png';
            };
            this.avatarImage.style.opacity = '1';
        }, 300);
    }

    updateColor(expression) {
        const randomColor = expression.colors[Math.floor(Math.random() * expression.colors.length)];
        this.avatarElement.style.background = `linear-gradient(145deg, ${randomColor}, ${this.adjustBrightness(randomColor, -20)})`;
        this.avatarElement.style.boxShadow = `0 8px 24px ${randomColor}40`;
    }

    playAnimation(expression) {
        if (this.isAnimating) {
            return;
        }

        const randomAnimation = expression.animations[Math.floor(Math.random() * expression.animations.length)];
        const animation = this.animations[randomAnimation];
        if (!animation) {
            return;
        }

        this.isAnimating = true;
        this.avatarElement.style.animation = 'none';

        setTimeout(() => {
            this.avatarElement.style.animation = `${randomAnimation} ${animation.duration}ms ${animation.easing}`;
            setTimeout(() => {
                this.isAnimating = false;
            }, animation.duration);
        }, 50);
    }

    startBackgroundAnimation() {
        setInterval(() => {
            if (!this.isAnimating) {
                this.playSubtleAnimation();
            }
        }, 5000);
    }

    playSubtleAnimation() {
        const subtleAnimations = ['gentle-bob', 'subtle-pulse'];
        const randomAnimation = subtleAnimations[Math.floor(Math.random() * subtleAnimations.length)];
        const animation = this.animations[randomAnimation];
        if (!animation || !this.avatarElement) {
            return;
        }

        this.avatarElement.style.animation = `${randomAnimation} ${animation.duration}ms ${animation.easing}`;
    }

    updateStatusIndicator(description) {
        const statusIndicator = document.querySelector(this.options.statusIndicatorSelector);
        if (statusIndicator) {
            statusIndicator.textContent = description;
        }

        if (this.options.syncSubtitlesOnEmotionChange) {
            const subtitles = document.getElementById(this.options.subtitlesId);
            if (subtitles) {
                subtitles.textContent = `情緒: ${description}`;
            }
        }
    }

    triggerSpecialAnimation(messageType) {
        const specialAnimations = {
            greeting: 'bounce',
            goodbye: 'gentle-sway',
            thinking: 'thinking-tap',
            understanding: 'nod',
            excitement: 'wiggle'
        };

        const animation = specialAnimations[messageType];
        if (animation && this.animations[animation]) {
            this.playAnimation({
                animations: [animation]
            });
        }
    }

    adjustBrightness(color, amount) {
        const num = parseInt(color.replace('#', ''), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
        const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    getCurrentEmotion() {
        return this.currentEmotion;
    }

    getEmotionDescription(emotion) {
        const expression = this.expressions[this.normalizeEmotion(emotion)];
        return expression ? expression.description : '未知情緒';
    }
}

window.AvatarSystem = AvatarSystem;