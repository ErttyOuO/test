import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import User from './models/User.js';
import Post from './models/Post.js';
import Policy from './models/Policy.js';

// 1. 設定 MongoDB 連線字串 (直接使用您提供的)
const MONGODB_URI = "mongodb+srv://yi:1210@cluster0.krdjklg.mongodb.net/?appName=Cluster0";
const PORT = 3000;

// 2. 修正路徑問題 (為了服務靜態檔案)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '..');

const app = express();

app.use(cors());
app.use(express.json());

// 3. 讓後端伺服器「服務」前端檔案
// 這樣您訪問 http://localhost:3000 時，就能看到網頁，且 API 連線不會有跨域問題
app.use(express.static(PUBLIC_DIR)); 

// API 路由
app.use('/api/auth', authRoutes);

// --- 社群 API ---
app.get('/api/posts', async (req, res) => {
    try {
        // 確保資料庫有連線
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

// --- 資料播種 (Seeding) ---
const seedData = async () => {
    try {
        // 1. 建立 Superuser
        const existingAdmin = await User.findOne({ username: 'superuser' });
        if (!existingAdmin) {
            const passwordHash = await bcrypt.hash('0000', 10);
            await User.create({
                username: 'superuser',
                displayName: '系統管理員(測試)',
                passwordHash,
                role: 'owner'
            });
            console.log('✅ Superuser 已建立 (帳號: superuser / 密碼: 0000)');
        }

        // 2. 建立社群資料 (強制檢查)
        const postCount = await Post.countDocuments();
        if (postCount === 0) {
            console.log('正在產生社群虛擬資料...');
            
            // 建立虛擬用戶
            const users = [
                { username: 'user1', name: '理賠達人', pass: '1234' },
                { username: 'user2', name: '焦慮媽媽', pass: '1234' },
                { username: 'user3', name: '保險業務Ken', pass: '1234' }
            ];

            const dbUsers = [];
            for (const u of users) {
                let user = await User.findOne({ username: u.username });
                if (!user) {
                    const hash = await bcrypt.hash(u.pass, 10);
                    user = await User.create({ username: u.username, displayName: u.name, passwordHash: hash });
                }
                dbUsers.push(user);
            }

            // 建立貼文
            await Post.create([
                {
                    title: '車禍對方全責，理賠談判技巧？',
                    content: '對方保險公司一直砍價，精神賠償金只願意給 2000，請問各位前輩該怎麼談？',
                    author: dbUsers[0]._id, authorName: dbUsers[0].displayName, tags: ['理賠'], likes: 15
                },
                {
                    title: '新生兒罐頭保單請益',
                    content: '剛出生的寶寶，業務規劃雙實支+重大傷病，年繳 25000，這樣夠嗎？還是有哪邊可以刪減？',
                    author: dbUsers[1]._id, authorName: dbUsers[1].displayName, tags: ['新生兒'], likes: 8
                },
                {
                    title: '乙式車險出險疑問',
                    content: '自己在停車場嚕到牆壁，乙式能賠嗎？會有自負額嗎？需不需要報警？',
                    author: dbUsers[2]._id, authorName: dbUsers[2].displayName, tags: ['車險'], likes: 22
                }
            ]);
            console.log('✅ 社群虛擬資料建立完成');
        }
    } catch (e) {
        console.error('資料建立失敗:', e);
    }
};

// 連線並啟動
const startServer = () => {
    app.listen(PORT, () => {
        console.log(`🚀 伺服器已啟動: http://localhost:${PORT}`);
        console.log(`⚠️ 請務必使用 http://localhost:${PORT} 訪問網頁，不要直接打開 index.html`);
    });
};

startServer();

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB 連線成功');
        await seedData();
    })
    .catch((err) => {
        console.error('❌ MongoDB 連線失敗:', err.message);
    });