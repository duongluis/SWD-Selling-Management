// Ngày thực hiện dịch vụ (`serviceDate`, dạng 'YYYY-MM-DD').
// Dịch vụ đã hoàn thành lấy ngày hoàn thành làm ngày thực hiện.

// Ngày theo giờ VN (GMT+7) — tự cộng giờ thay vì Intl timeZone để chạy giống nhau trên mọi engine JS
const vnDateStr = (d) => new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

/** Các trường ghi khi chuyển dịch vụ sang "Hoàn thành": ngày hoàn thành đồng thời là ngày thực hiện. */
export const completionFields = () => {
    const now = new Date();
    return { completedDate: now.toISOString(), serviceDate: vnDateStr(now) };
};

/** Ngày thực hiện để hiển thị; dịch vụ cũ hoàn thành trước khi có `serviceDate` thì lùi về ngày hoàn thành. */
export const serviceDateOf = (s) => {
    if (s?.serviceDate) return s.serviceDate;
    if (!s?.completedDate) return '';
    const d = new Date(s.completedDate);
    return isNaN(d) ? '' : vnDateStr(d);
};
