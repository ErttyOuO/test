import './dns-fix.js';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import User from './models/User.js';
import Post from './models/post.js';
import Policy from './models/Policy.js';
import PortfolioAdvice from './models/PortfolioAdvice.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// ---------------------------------------------------------
// 1. 環境變數與路徑設定
// ---------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 專案路徑（node-server -> services -> backend -> project root）
const PROJECT_DIR = path.resolve(path.join(__dirname, '..', '..', '..'));
const PUBLIC_DIR = PROJECT_DIR;
const PY_BACKEND_APP = path.join(PROJECT_DIR, 'backend', 'services', 'flask-app', 'app.py');
const PORT = 3000;
const BACKEND_PORT = 5000;
const MONGODB_URI = "mongodb+srv://p11246707375_db_user:OfAOeD5wliBvumHM@cluster0.1f1dc13.mongodb.net/insurance_db?appName=Cluster0&retryWrites=true&w=majority";
const AVATAR_MODELS_DIR = path.join(PROJECT_DIR, 'frontend', 'assets', 'models');
const AVATAR_META_FILE = path.join(AVATAR_MODELS_DIR, 'avatars.meta.json');

function toAvatarLabel(fileName) {
    const base = String(fileName || '').replace(/\.vrm$/i, '');
    const normalized = base.replace(/[_-]+/g, ' ').trim();
    return normalized || '未命名角色';
}

function normalizeAvatarMeta(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }

    if (Array.isArray(raw)) {
        return raw.reduce((acc, item) => {
            if (!item || typeof item !== 'object') {
                return acc;
            }

            const fileName = String(item.fileName || '').trim();
            if (!fileName) {
                return acc;
            }

            acc[fileName] = item;
            return acc;
        }, {});
    }

    if (Array.isArray(raw.avatars)) {
        return raw.avatars.reduce((acc, item) => {
            if (!item || typeof item !== 'object') {
                return acc;
            }

            const fileName = String(item.fileName || '').trim();
            if (!fileName) {
                return acc;
            }

            acc[fileName] = item;
            return acc;
        }, {});
    }

    return raw;
}

function getAvatarMetaByFile(metaMap, fileName) {
    const direct = metaMap[fileName];
    if (direct && typeof direct === 'object') {
        return direct;
    }

    const lowerKey = Object.keys(metaMap).find((k) => k.toLowerCase() === String(fileName || '').toLowerCase());
    if (lowerKey && metaMap[lowerKey] && typeof metaMap[lowerKey] === 'object') {
        return metaMap[lowerKey];
    }

    return {};
}

console.log('------------------------------------------------');
console.log('🚀 AI 自動啟動引擎就緒');
console.log('📂 偵測到專案目錄:', PUBLIC_DIR);
console.log('🐍 連結目標:', PY_BACKEND_APP);
console.log('------------------------------------------------');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(PUBLIC_DIR));

// ---------------------------------------------------------
// 2. AI 後端 (app.py) 自動啟動邏輯
// ---------------------------------------------------------
let backendProcess = null;

function checkBackendAlive() {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => { req.destroy(); resolve(false); });
    });
}

function resolvePython() {
    const candidates = [
        path.join(PUBLIC_DIR, '.venv', 'Scripts', 'python.exe'),
        path.join(PUBLIC_DIR, '..', '.venv', 'Scripts', 'python.exe'),
        path.join(PUBLIC_DIR, '.venv', 'bin', 'python'),
        path.join(PUBLIC_DIR, '..', '.venv', 'bin', 'python'),
        'python',
        'python3',
    ];
    for (const c of candidates) {
        try {
            if (c === 'python' || c === 'python3') {
                execSync(`${c} --version`, { stdio: 'pipe' });
                return c;
            }
            if (fs.existsSync(c)) return c;
        } catch (_) {}
    }
    return 'python';
}

async function startBackend() {
    if (backendProcess && !backendProcess.killed) return;
    
    const pyCmd = resolvePython();
    const appPath = PY_BACKEND_APP;
    const logPath = path.join(PUBLIC_DIR, 'backend_log.txt');
    
    console.log(`[AI] 啟動中... 使用指令: ${pyCmd}, 日誌位於: ${logPath}`);
    
    try {
        // 確保關鍵依賴存在
        execSync(`${pyCmd} -m pip install flask-cors`, { stdio: 'ignore', cwd: PUBLIC_DIR });
    } catch (e) {}

    if (!fs.existsSync(appPath)) {
        console.error(`[AI] 找不到後端檔案: ${appPath}`);
        return;
    }

    const out = fs.openSync(logPath, 'a');
    backendProcess = spawn(pyCmd, [appPath], {
        cwd: path.dirname(appPath),
        stdio: ['ignore', out, out],
        detached: false,
    });
    
    backendProcess.on('exit', (code) => {
        console.log(`[AI] 已結束 (代碼: ${code})`);
        backendProcess = null;
    });
}

// ---------------------------------------------------------
// 3. API 路由
// ---------------------------------------------------------
app.get('/api/ensure-backend', async (req, res) => {
    const alive = await checkBackendAlive();
    if (alive) return res.json({ status: 'ok', alreadyRunning: true });
    
    console.log('[API] 收到啟動請求...');
    startBackend();
    
    // 循環檢查直到就緒或超時 (加快頻率：0.5s * 10 = 5s)
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await checkBackendAlive()) {
            return res.json({ status: 'ok', started: true });
        }
    }
    return res.json({ status: 'fail', started: true, message: '啟動超時' });
});

app.get('/api/avatar-models', async (req, res) => {
    try {
        const dirStat = await fs.promises.stat(AVATAR_MODELS_DIR).catch(() => null);
        if (!dirStat || !dirStat.isDirectory()) {
            return res.status(404).json({
                message: '找不到模型資料夾',
                models: [],
                metaFile: 'frontend/assets/models/avatars.meta.json'
            });
        }

        const dirEntries = await fs.promises.readdir(AVATAR_MODELS_DIR, { withFileTypes: true });
        const modelFiles = dirEntries
            .filter((entry) => entry.isFile() && /\.vrm$/i.test(entry.name))
            .map((entry) => entry.name)
            .sort((a, b) => {
                const aIsDefault = a.toLowerCase() === 'avatar.vrm';
                const bIsDefault = b.toLowerCase() === 'avatar.vrm';
                if (aIsDefault && !bIsDefault) return -1;
                if (!aIsDefault && bIsDefault) return 1;
                return a.localeCompare(b, 'zh-Hant');
            });

        let metaMap = {};
        if (fs.existsSync(AVATAR_META_FILE)) {
            try {
                const raw = await fs.promises.readFile(AVATAR_META_FILE, 'utf8');
                metaMap = normalizeAvatarMeta(JSON.parse(raw));
            } catch (error) {
                console.warn('[AvatarModels] 讀取 avatars.meta.json 失敗，將使用預設說明。', error.message);
            }
        }

        const models = modelFiles.map((fileName, index) => {
            const meta = getAvatarMetaByFile(metaMap, fileName);
            const displayName = String(meta.displayName || '').trim() || toAvatarLabel(fileName);
            const role = String(meta.role || '').trim() || '智能保險顧問';
            const description = String(meta.description || '').trim() || '可在 avatars.meta.json 中補充這位顧問的人物特質與說明。';

            return {
                id: `avatar-${index + 1}`,
                fileName,
                modelUrl: `/frontend/assets/models/${encodeURIComponent(fileName)}`,
                displayName,
                role,
                description,
                isDefault: fileName.toLowerCase() === 'avatar.vrm'
            };
        });

        return res.json({
            models,
            defaultModel: models.find((m) => m.isDefault)?.fileName || models[0]?.fileName || null,
            metaFile: 'frontend/assets/models/avatars.meta.json'
        });
    } catch (error) {
        console.error('[AvatarModels] 載入模型列表失敗:', error);
        return res.status(500).json({
            message: '載入模型列表失敗',
            models: [],
            metaFile: 'frontend/assets/models/avatars.meta.json'
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- 社群 API ---
app.get('/api/posts', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ message: '資料庫尚未連線' });
        }
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error("讀取貼文失敗:", err);
        res.status(500).json({ message: '無法取得貼文' });
    }
});

// --- 智慧保單 API ---
app.get('/api/policies', async (req, res) => {
    const { userId } = req.query;
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }
        const policies = await Policy.find({ userId }).sort({ uploadDate: -1 });
        res.json(policies);
    } catch (err) {
        res.status(500).json({ message: '讀取失敗' });
    }
});

// --- 新增：給 face backend 使用的輕量保單摘要 API（不回 fileData/base64） ---
app.get('/api/policies/summary', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ message: '缺少 userId' });
    }

    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }

        const policies = await Policy.find(
            { userId },
            {
                _id: 1,
                title: 1,
                type: 1,
                company: 1,
                aiReply: 1,
                extractedText: 1,
                details: 1,
                uploadDate: 1
            }
        ).sort({ uploadDate: -1 });

        const toShortText = (value, max = 220) => {
            const text = String(value || '').replace(/\s+/g, ' ').trim();
            return text.length > max ? `${text.slice(0, max)}...` : text;
        };

        const summaries = policies.map((p) => {
            const details = (p.details && typeof p.details === 'object') ? p.details : {};
            const category = p.type || details.category || details.policyType || p.company || '未分類';
            const title = p.title || details.product_name || details.planName || '未命名保單';
            const summary = toShortText(
                p.aiReply
                || details.summary
                || details.recommendation
                || details.risks
                || p.extractedText
                || ''
            );
            const extractedTextShort = toShortText(p.extractedText || '', 180);

            return {
                policyId: String(p._id),
                title,
                category,
                summary,
                extractedTextShort
            };
        });

        return res.json({ userId, count: summaries.length, policies: summaries });
    } catch (err) {
        console.error('讀取保單摘要失敗:', err);
        return res.status(500).json({ message: '讀取保單摘要失敗' });
    }
});

app.post('/api/policies', async (req, res) => {
    const { userId, policyData } = req.body;
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }
        const newPolicy = await Policy.create({ userId, ...policyData });
        res.json(newPolicy);
    } catch (err) {
        res.status(500).json({ message: '儲存失敗' });
    }
});

app.delete('/api/policies/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }
        await Policy.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: '刪除失敗' });
    }
});

app.patch('/api/policies/:id/aiReply', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }
        const { aiReply } = req.body;
        const updatedPolicy = await Policy.findByIdAndUpdate(
            req.params.id,
            { aiReply },
            { new: true }
        );
        res.json(updatedPolicy);
    } catch (err) {
        res.status(500).json({ message: '更新失敗' });
    }
});

// --- 組合建議 (Portfolio Advice) API ---
app.get('/api/portfolio-advice/:userId', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }
        const advice = await PortfolioAdvice.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.json(advice);
    } catch (err) {
        res.status(500).json({ message: '讀取建議失敗' });
    }
});

app.post('/api/portfolio-advice', async (req, res) => {
    const { userId, fingerprint, advice } = req.body;
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: '資料庫尚未連線' });
        }
        const newAdvice = await PortfolioAdvice.create({ userId, fingerprint, advice });
        res.json(newAdvice);
    } catch (err) {
        res.status(500).json({ message: '儲存建議失敗' });
    }
});

// --- 客服支援 Email API ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/api/contact', async (req, res) => {
    const { name, email, phone, category, message, image, imageName } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: '請填寫必要欄位' });
    }

    const supportEmail = process.env.SUPPORT_EMAIL || 'p11246707375@gmail.com';
    const attachments = [];

    if (image) {
        try {
            let base64Data = image;
            if (image.includes(',')) base64Data = image.split(',')[1];
            attachments.push({
                filename: imageName || 'attachment.png',
                content: base64Data,
                encoding: 'base64'
            });
        } catch (e) { console.error('Failed to process image attachment:', e); }
    }

    const mailToSupport = {
        from: process.env.EMAIL_USER,
        to: supportEmail,
        replyTo: email,
        subject: `【客服問題】${category} - 來自 ${name}`,
        text: `姓名: ${name}\n電子信箱: ${email}\n手機號碼: ${phone || '未提供'}\n問題類別: ${category}\n\n問題內容:\n${message}`,
        attachments: attachments
    };

    const attachmentNote = image ? `<p><strong>附件檔案：</strong> ${imageName || 'attachment.png'}</p>` : '';
    const mailToUser = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '【系統自動回覆】我們已收到您的客服訊息',
        html: `
            <h3>您好 ${name}，我們已收到您的訊息！</h3>
            <p>感謝您的聯絡，客服團隊將會儘快處理您的問題。</p>
            <hr>
            <p><strong>您填寫的內容備份：</strong></p>
            <p>姓名：${name}</p>
            <p>問題類別：${category}</p>
            <p>問題內容：<br>${message.replace(/\n/g, '<br>')}</p>
            ${attachmentNote}
            <hr>
            <p style="color: #666; font-size: 0.9rem;">這是系統自動發送的郵件，請勿直接回覆此信件。</p>
        `,
        attachments: attachments
    };

    try {
        await Promise.all([
            transporter.sendMail(mailToSupport),
            transporter.sendMail(mailToUser)
        ]);
        res.json({ success: true, message: '您的問題已送出，我們會盡快處理' });
    } catch (err) {
        console.error('Email 發送失敗:', err);
        res.status(500).json({ success: false, message: '信件發送失敗', error: err.message });
    }
});

// 當 Node 程序結束時一併關閉 Python
process.on('SIGINT', () => { if (backendProcess) backendProcess.kill(); process.exit(); });
process.on('SIGTERM', () => { if (backendProcess) backendProcess.kill(); process.exit(); });

// ---------------------------------------------------------
// 4. 連線 MongoDB 並啟動服務
// ---------------------------------------------------------
const startServer = () => {
    app.listen(PORT, () => {
        console.log(`🚀 伺服器運行中: http://localhost:${PORT}`);
        console.log('[AI] 正在預備啟動...');
        startBackend();
    });
};

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    family: 4 // 強制使用 IPv4 解決某些環境下的連線問題
})
    .then(() => {
        console.log('✅ MongoDB 連線成功');
        startServer();
    })
    .catch((err) => {
        console.log('⚠️ MongoDB 連線失敗, 但仍將啟動 Web 服務:', err.message);
        startServer();
    });
