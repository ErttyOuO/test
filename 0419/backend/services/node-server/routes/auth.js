import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, displayName, password } = req.body || {};
    if (!username || !displayName || !password) {
      return res.status(400).json({ message: '欄位不足' });
    }

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(409).json({ message: '此帳號已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, displayName, passwordHash });
    return res.status(201).json({ message: '註冊成功', user: user.toSafeJSON() });
  } catch (err) {
    return res.status(500).json({ message: '註冊失敗' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '欄位不足' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '帳號或密碼錯誤' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: '帳號或密碼錯誤' });
    }

    return res.json({ message: '登入成功', user: user.toSafeJSON() });
  } catch (err) {
    return res.status(500).json({ message: '登入失敗' });
  }
});

export default router;
