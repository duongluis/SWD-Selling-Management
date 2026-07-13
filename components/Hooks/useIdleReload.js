// components/Hooks/useIdleReload.js
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { cleanupStaleCaches } from '../Utils/cleanupStaleCaches';

const IDLE_MS = 5 * 60 * 1000; // 5 phút

export function useIdleReload() {
    const timer = useRef(null);
    const idleSince = useRef(null); // thời điểm bắt đầu idle

    useEffect(() => {
        // Hook luôn được gọi (đúng rules-of-hooks) — chỉ thực thi logic trên web
        // vì dùng window/document/navigator.serviceWorker (không tồn tại trên native)
        if (Platform.OS !== 'web') return;

        const markIdle = () => {
            idleSince.current = Date.now();
        };

        const checkAndReload = () => {
            if (idleSince.current && Date.now() - idleSince.current >= IDLE_MS) {
                idleSince.current = null;
                cleanupStaleCaches().finally(() => window.location.reload());
                return;
            }
        };

        const resetIdle = () => {
            idleSince.current = null;
            startTimer();
        };

        const startTimer = () => {
            clearTimeout(timer.current);
            timer.current = setTimeout(markIdle, IDLE_MS);
        };

        // ── Reload ngay khi focus/visible trở lại ────────────
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkAndReload();
            } else {
                // Tab bị ẩn → bắt đầu tính giờ idle
                startTimer();
            }
        };

        const onFocus = () => checkAndReload();
        const onBlur = () => startTimer();

        // ── Reset idle khi user còn đang dùng ────────────────
        const onActivity = () => {
            if (!idleSince.current) resetIdle();
        };

        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
        activityEvents.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);

        startTimer(); // bắt đầu đếm

        return () => {
            clearTimeout(timer.current);
            activityEvents.forEach(e => window.removeEventListener(e, onActivity));
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, []);
}