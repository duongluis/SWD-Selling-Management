// components/Hooks/useIdleReload.js
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { cleanupStaleCaches } from '../Utils/cleanupStaleCaches';

const IDLE_MS = 5 * 60 * 1000; // 5 phút

export function useIdleReload() {
    // Chỉ lưu 1 nguồn sự thật duy nhất: thời điểm hoạt động gần nhất.
    // Tránh dùng flag nhị phân (idleSince) dễ bị "kẹt" — trước đây onActivity chỉ
    // reset khi CHƯA idle, nên một khi đã bị đánh dấu idle, gõ phím không hủy được
    // trạng thái đó nữa → lần focus/blur tiếp theo (kể cả do bàn phím ảo bật/tắt khi
    // đang gõ) vẫn kích hoạt reload và mất dữ liệu đang nhập.
    const lastActivityRef = useRef(Date.now());

    useEffect(() => {
        // Hook luôn được gọi (đúng rules-of-hooks) — chỉ thực thi logic trên web
        // vì dùng window/document (không tồn tại trên native)
        if (Platform.OS !== 'web') return;

        const markActivity = () => {
            lastActivityRef.current = Date.now();
        };

        // Chỉ kiểm tra reload tại đúng thời điểm app quay lại foreground
        // (visible/focus) — không dùng timer chạy nền, tránh reload đột ngột
        // khi người dùng vẫn đang thao tác trong tab.
        const maybeReload = () => {
            const idleFor = Date.now() - lastActivityRef.current;
            if (idleFor < IDLE_MS) return;

            // An toàn thêm 1 lớp: nếu đang có ô nhập liệu được focus (kể cả khi đủ
            // 5 phút không có sự kiện activity nào bắt được — ví dụ người dùng đang
            // đọc lại nội dung đã gõ mà không gõ thêm), không reload để tránh mất dữ
            // liệu chưa lưu. Chỉ reload khi thực sự không có input nào đang active.
            const activeTag = document.activeElement?.tagName;
            const isEditing = activeTag === 'INPUT' || activeTag === 'TEXTAREA'
                || document.activeElement?.isContentEditable;
            if (isEditing) return;

            cleanupStaleCaches().finally(() => window.location.reload());
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                maybeReload();
            }
            // Khi ẩn: không cần làm gì — lastActivityRef vẫn giữ nguyên,
            // thời gian ẩn tự động được tính vào lần kiểm tra kế tiếp.
        };

        const onFocus = () => maybeReload();

        // 'input' bắt trực tiếp sự kiện gõ trong TextInput trên web (đáng tin cậy
        // hơn 'keydown' với một số component chặn bubbling), giữ nguyên các event khác.
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'input', 'touchstart', 'scroll'];
        activityEvents.forEach(e => window.addEventListener(e, markActivity, { passive: true, capture: true }));

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', onFocus);

        return () => {
            activityEvents.forEach(e => window.removeEventListener(e, markActivity, { capture: true }));
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', onFocus);
        };
    }, []);
}