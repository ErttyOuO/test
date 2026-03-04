const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.static(__dirname));
app.use(express.json());

// mock 保險員初始化資料
let agentProfile = {
    personal: {
        name: "林保險", // 初始寫死為「林保險」
        age: "35 歲",
        experience: "8 年 5 個月",
        salesVolume: "1,250 單",
        company: "富邦人壽",
        position: "業務經理",
        avatar: null, // base64 string
        isVerified: true, // true 顯示藍勾勾，false 則隱藏
        introduction: "您好，我是林保險，專注於為每個家庭提供最合適的保障方案。在保險業界已有超過八年的經驗，協助上千位客戶完成資產傳承與醫療規劃。"
    },
    metrics: {
        responseRate: "90%",
        responseSpeed: "5 mins",
        closingRateRank: "3"
    }
};

let activeGroups = [
    {
        id: 'group_test_123',
        name: '保險理財交流群 (測試)',
        agentName: agentProfile.personal.name,
        agentAvatar: agentProfile.personal.avatar,
        isVerified: agentProfile.personal.isVerified
    }
]; // Array to store active group chats

app.get('/api/profile', (req, res) => {
    res.json(agentProfile);
});

// 更新保險員資料
app.post('/api/profile', (req, res) => {
    // 取得前端傳來的更新內容並覆蓋
    agentProfile.personal = { ...agentProfile.personal, ...req.body.personal };

    // 如果有傳 avatar，另外處理避免覆蓋掉沒傳時的原本值 (若有需要)
    if (req.body.avatar !== undefined) {
        agentProfile.personal.avatar = req.body.avatar;
    }

    res.json({ success: true, message: 'Profile updated', profile: agentProfile });
});

// 排行榜列表 Mock 資料
const rankings = [
    { rank: 1, name: "王保險", company: "國泰人壽", closingRate: "89%", subtitle: "超棒棒，大家的榜樣" },
    { rank: 2, name: "陳保險", company: "富邦人壽", closingRate: "86%", subtitle: "有潛力，穩定成長" },
    { rank: 3, name: "林保險", company: "安泰人壽", closingRate: "82%", subtitle: "持續努力，突破自我" },
    { rank: 4, name: "蔡保險", company: "南山人壽", closingRate: "78%", subtitle: "一步一腳印，扎實邁進" },
    { rank: 5, name: "龔保險", company: "新光人壽", closingRate: "75%", subtitle: "不屈不撓，漸入佳境" }
];

app.get('/api/rankings', (req, res) => {
    // 動態將當前保險員的最新資料更新到排行榜中對應的項目
    const updatedRankings = rankings.map(r => {
        // 第一版的預設名是「林保險」或當前修改後的名字
        if (r.name === "林保險" || r.name === agentProfile.personal.name) {
            return {
                ...r,
                name: agentProfile.personal.name,
                company: agentProfile.personal.company,
                avatar: agentProfile.personal.avatar
            };
        }
        return r;
    });
    res.json(updatedRankings);
});

// Server-side persistent chat history
const chatHistory = {};

function updateAgentMetrics() {
    let totalUsers = 0;
    let repliedUsers = 0;
    let totalResponseTimeMs = 0;
    let validSpeedMeasurements = 0;

    for (const userId in chatHistory) {
        const msgs = chatHistory[userId];
        const userMsgs = msgs.filter(m => m.role === 'user');
        const agentMsgs = msgs.filter(m => m.role === 'agent');

        if (userMsgs.length > 0) {
            totalUsers++;
            if (agentMsgs.length > 0) {
                repliedUsers++;
                // Calculate response speed for the first reply
                const firstUserMsgDate = new Date(userMsgs[0].timestamp);
                const firstAgentReplyDate = new Date(agentMsgs[0].timestamp);

                // Only count if reply is after the user msg
                if (firstAgentReplyDate >= firstUserMsgDate) {
                    const diffMs = firstAgentReplyDate - firstUserMsgDate;
                    totalResponseTimeMs += diffMs;
                    validSpeedMeasurements++;
                }
            }
        }
    }

    if (totalUsers > 0) {
        const rate = (repliedUsers / totalUsers) * 100;
        agentProfile.metrics.responseRate = `${rate.toFixed(1)}%`;
    }

    if (validSpeedMeasurements > 0) {
        const avgMs = totalResponseTimeMs / validSpeedMeasurements;
        const avgSeconds = Math.floor(avgMs / 1000);
        const avgMinutes = Math.floor(avgSeconds / 60);

        if (avgMinutes > 0) {
            agentProfile.metrics.responseSpeed = `${avgMinutes} 分鐘`;
        } else {
            agentProfile.metrics.responseSpeed = `${avgSeconds} 秒`;
        }
    }
}

// Socket.io for Real-time Chat
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Identify user vs agent (simplified for demo)
    socket.on('register', (data) => {
        const role = typeof data === 'string' ? data : data.role;
        const customId = (typeof data === 'object' && data.userId) ? data.userId : socket.id;

        socket.role = role; // 'user' or 'agent'
        socket.customId = customId; // Map to their persistent ID

        socket.join(role);
        socket.join(customId); // Users and Agents join their own personal room

        // If user is registering, we optionally make sure they don't get mixed messages.
        // The bug usually happens when the userId is reused.

        console.log(`Socket ${socket.id} registered as ${role} mapped to User ID: ${customId}`);

        if (role === 'agent') {
            // Send existing history to the agent dashboard so old chats aren't lost
            socket.emit('sync_history', chatHistory);
        } else if (role === 'user') {
            // A user reconnected. Send them their specific history.
            if (chatHistory[customId]) {
                socket.emit('sync_user_history', {
                    userId: customId,
                    history: chatHistory[customId]
                });
            }
            // Send available groups
            socket.emit('available_groups', activeGroups);
        }
    });

    // Handle messages from user to agent
    socket.on('user_message', (data) => {
        const userId = socket.customId || socket.id;
        console.log('Message from user:', userId, data.text || 'File Attached');

        const msgObj = {
            role: 'user',
            text: data.text,
            timestamp: new Date().toISOString(),
            file: data.file
        };

        if (!chatHistory[userId]) {
            chatHistory[userId] = [];
        }
        chatHistory[userId].push(msgObj);

        // Broadcast to all connected agents
        io.to('agent').emit('new_message_from_user', {
            userId: userId,
            text: msgObj.text,
            timestamp: msgObj.timestamp,
            file: msgObj.file
        });

        updateAgentMetrics();
    });

    // Handle replies from agent to user
    socket.on('agent_reply', (data) => {
        console.log('Reply from agent to user', data.userId, ':', data.text || 'File Attached');

        const msgObj = {
            role: 'agent',
            text: data.text,
            timestamp: new Date().toISOString(),
            file: data.file
        };

        if (!chatHistory[data.userId]) {
            chatHistory[data.userId] = [];
        }
        chatHistory[data.userId].push(msgObj);

        // Send back to the specific user room exactly
        io.to(data.userId).emit('new_reply_from_agent', {
            text: msgObj.text,
            timestamp: msgObj.timestamp,
            file: msgObj.file,
            agentProfile: {
                name: agentProfile.personal.name,
                avatar: agentProfile.personal.avatar,
                isVerified: agentProfile.personal.isVerified
            }
        });

        updateAgentMetrics();
    });

    // Group Chat Logic
    socket.on('create_group', (data) => {
        const groupId = 'group_' + Date.now();
        const groupName = data.groupName || '保險員群聊';
        const groupAvatar = data.groupAvatar || null;

        socket.join(groupId);

        const newGroup = {
            id: groupId,
            name: groupName,
            groupAvatar: groupAvatar,
            agentName: agentProfile.personal.name,
            agentAvatar: agentProfile.personal.avatar,
            isVerified: agentProfile.personal.isVerified
        };
        activeGroups.push(newGroup);

        // Inform the agent that group is created
        socket.emit('group_created', {
            groupId,
            groupName,
            groupAvatar
        });

        // Broadcast to all users
        io.emit('new_group_available', newGroup);
    });

    socket.on('join_group', (data) => {
        const { groupId } = data;
        socket.join(groupId);
        console.log(`${socket.id} joined group ${groupId}`);
    });

    socket.on('group_message', (data) => {
        const { groupId, text, file, senderName, senderAvatar, isVerified } = data;

        const message = {
            role: socket.role,
            text: text,
            timestamp: new Date().toISOString(),
            file: file,
            senderName: senderName || (socket.role === 'agent' ? agentProfile.personal.name : '客戶'),
            senderAvatar: senderAvatar,
            isVerified: isVerified,
            clientId: socket.id
        };

        if (!activeGroups.find(g => g.id === groupId)) return;

        io.to(groupId).emit('new_group_message', {
            groupId,
            message
        });

        io.emit('agent_new_group_message', {
            groupId,
            message
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id, 'userId:', socket.customId);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Agent Dashboard: http://localhost:${PORT}/agent_chat_dashboard.html`);
});
