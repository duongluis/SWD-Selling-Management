// components/Utils/cleanupStaleCaches.js
// Dọn Service Worker cũ (từ bản deploy trước) + Cache Storage trên web.
// Dùng chung cho: app boot (_layout.jsx) và trước khi idle-reload (useIdleReload.js).
// Tránh trường hợp SW cũ chặn request font/asset, gây mất icon hoặc tài nguyên bị stale
// — chỉ dọn khi reload đi qua useIdleReload thì không đủ, vì user có thể tự F5/Ctrl+R
// (không qua idle-timer) và vẫn dính SW cũ.

const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))]);

export async function cleanupStaleCaches() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;
    try {
        await withTimeout((async () => {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
        })(), 1500);
    } catch (_) {
        // Bỏ qua lỗi dọn dẹp — không chặn luồng chính
    }
}
