import dns from 'dns';
// 強制使用 Google DNS 避開 Windows/本地網路的 SRV 解析問題
dns.setServers(['8.8.8.8', '8.8.4.4']);
console.log("🛠️ DNS Fix Applied: Using Google Public DNS (8.8.8.8)");
