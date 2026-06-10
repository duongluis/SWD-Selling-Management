// components/Hooks/useIdleReload.js
import { useEffect, useRef } from 'react';

const IDLE_MS = 5 * 60 * 1000; // 5 phút

export function useIdleReload() {
    const timer = useRef(null);

    useEffect(() => {
        const reset = () => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => {
                // Đánh dấu cần reload, không reload ngay
                sessionStorage.setItem('needsReload', '1');
            }, IDLE_MS);
        };

        const onActivity = () => {
            // Nếu đã idle đủ 5p → reload khi user quay lại
            if (sessionStorage.getItem('needsReload') === '1') {
                sessionStorage.removeItem('needsReload');
                window.location.reload();
                return;
            }
            reset();
        };

        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
        events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
        reset(); // bắt đầu đếm

        return () => {
            clearTimeout(timer.current);
            events.forEach(e => window.removeEventListener(e, onActivity));
        };
    }, []);
}