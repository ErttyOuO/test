/**
 * idb-files.js - IndexedDB 檔案儲存共用模組
 * ============================================================
 * 將廣告素材、Fallback 素材等大檔存入 IndexedDB，
 * 避免爆 localStorage 的 5MB 上限。
 *
 * 公開 API（全部回傳 Promise）：
 *   IDB_FILES.save({ blob, type, name, sizeBytes }) -> fileId
 *   IDB_FILES.get(fileId)   -> { blob, url, type, name, sizeBytes, createdAt }
 *   IDB_FILES.del(fileId)   -> void
 *   IDB_FILES.clearAll()    -> void
 *
 * DB 名稱：AdManagerFiles，store：ad_files
 */

const IDB_FILES = (() => {
    'use strict';

    const DB_NAME = 'AdManagerFiles';
    const DB_VER = 1;
    const STORE = 'ad_files';

    // 開啟 / 建立 DB
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VER);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'fileId' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // 產生唯一 fileId
    function uid() {
        return 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    /**
     * 儲存檔案到 IndexedDB
     * @param {Object} opts
     * @param {Blob}   opts.blob
     * @param {string} opts.type      - MIME type
     * @param {string} opts.name      - 原始檔名
     * @param {number} opts.sizeBytes - 檔案大小
     * @returns {Promise<string>} fileId
     */
    async function save({ blob, type, name, sizeBytes }) {
        const db = await openDB();
        const fileId = uid();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({
                fileId,
                blob,
                type: type || '',
                name: name || '',
                sizeBytes: sizeBytes || 0,
                createdAt: new Date().toISOString()
            });
            tx.oncomplete = () => resolve(fileId);
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 從 IndexedDB 讀取檔案
     * @param {string} fileId
     * @returns {Promise<{blob, url, type, name, sizeBytes, createdAt}|null>}
     */
    async function get(fileId) {
        if (!fileId) return null;
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(fileId);
            req.onsuccess = () => {
                const rec = req.result;
                if (!rec) { resolve(null); return; }
                // 建立 objectURL 供 <video> / <img> 使用
                const url = (rec.blob instanceof Blob)
                    ? URL.createObjectURL(rec.blob)
                    : '';
                resolve({
                    blob: rec.blob,
                    url,
                    type: rec.type,
                    name: rec.name,
                    sizeBytes: rec.sizeBytes,
                    createdAt: rec.createdAt
                });
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * 刪除檔案
     * @param {string} fileId
     * @returns {Promise<void>}
     */
    async function del(fileId) {
        if (!fileId) return;
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(fileId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 清空所有檔案（demo 重設用）
     * @returns {Promise<void>}
     */
    async function clearAll() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    return { save, get, del, clearAll };
})();
