// NAS Backup Server — Express + Multer
// Chỉ nhận file .xlsx và .zip từ app SWD với API key hợp lệ

const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app = express();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
const API_KEY    = process.env.API_KEY;          // bắt buộc set trong docker-compose
const PORT       = parseInt(process.env.PORT || '3099', 10);

// ── Kiểm tra cấu hình lúc khởi động ─────────────────────────
if (!API_KEY || API_KEY.length < 16) {
    console.error('[FATAL] API_KEY chưa được set hoặc quá ngắn (tối thiểu 16 ký tự).');
    process.exit(1);
}
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── CORS — chỉ cho phép từ localhost và LAN ──────────────────
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);            // mobile / curl
        const allowed = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
        cb(allowed.test(origin) ? null : new Error('CORS blocked'), allowed.test(origin));
    },
    methods: ['GET', 'POST'],
}));

// ── Rate limit đơn giản (không cần thư viện) ─────────────────
const rateMap = new Map();
function rateLimit(req, res, next) {
    const ip  = req.ip;
    const now = Date.now();
    const win = rateMap.get(ip) || { count: 0, start: now };
    if (now - win.start > 60_000) { win.count = 0; win.start = now; }
    win.count++;
    rateMap.set(ip, win);
    if (win.count > 10) return res.status(429).json({ error: 'Quá nhiều request, thử lại sau 1 phút.' });
    next();
}

// ── Xác thực API Key ─────────────────────────────────────────
function authKey(req, res, next) {
    const key = req.headers['x-api-key'] || '';
    // So sánh constant-time để chống timing attack
    const expected = Buffer.from(API_KEY);
    const provided  = Buffer.from(key.padEnd(API_KEY.length).slice(0, API_KEY.length));
    if (key.length !== API_KEY.length || !crypto.timingSafeEqual(expected, provided)) {
        return res.status(401).json({ error: 'API key không hợp lệ.' });
    }
    next();
}

// ── Multer — chỉ chấp nhận .xlsx và .zip ─────────────────────
const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
        // Sanitize: chỉ giữ chữ, số, dấu gạch, dấu chấm
        const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9\-_.]/g, '_');
        const ext  = path.extname(safe).toLowerCase();
        if (!['.xlsx', '.zip'].includes(ext)) {
            return cb(new Error(`Loại file không được phép: ${ext}`));
        }
        // Thêm timestamp để tránh ghi đè
        const name = `${path.basename(safe, ext)}_${Date.now()}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, ['.xlsx', '.zip'].includes(ext));
    },
});

// ── Endpoint upload ───────────────────────────────────────────
app.post('/upload', rateLimit, authKey, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Không có file hoặc sai định dạng.' });

    const info = {
        ok:       true,
        filename: req.file.filename,
        size:     req.file.size,
        savedAt:  new Date().toISOString(),
    };
    console.log(`[UPLOAD] ${info.filename} — ${(info.size / 1024 / 1024).toFixed(2)} MB — ${req.ip}`);
    res.json(info);
});

// ── Health check (không cần key) ─────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

// ── Bắt mọi route còn lại ────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('[ERROR]', err.message);
    res.status(400).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SWD NAS Server] Đang chạy trên port ${PORT}`);
    console.log(`[SWD NAS Server] Lưu file vào: ${UPLOAD_DIR}`);
});
