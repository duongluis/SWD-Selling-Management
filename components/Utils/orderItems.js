// components/Utils/orderItems.js
// Nguồn duy nhất để đọc sản phẩm / doanh thu của 1 đơn hàng.
//
// Từ nay `orders.items` CHỈ chứa sản phẩm — dịch vụ nằm riêng ở collection 'service'
// (xem app/addOrder/index.jsx). Nhưng các đơn tạo trước thay đổi này vẫn có dòng dịch vụ
// nhét lẫn trong items (cờ isService/serviceType), nên mọi chỗ đọc phải lọc qua đây thì
// doanh thu và hoa hồng mới không bị cộng thêm tiền dịch vụ.

const PARSE = (v) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

/** Dòng dịch vụ lẫn trong items của đơn cũ */
export const isServiceItem = (i) => i?.isService === true || !!i?.serviceType;

/** Chỉ sản phẩm — dùng thay cho `order.items` ở mọi nơi tính tiền/đếm/liệt kê */
export const productItems = (order) => (order?.items || []).filter(i => !isServiceItem(i));

/** Doanh thu sản phẩm của 1 đơn (không gồm dịch vụ) */
export const productTotal = (order) =>
    productItems(order).reduce((s, p) => s + PARSE(p.price) * PARSE(p.qty || 1), 0);

/** Tổng tiền của 1 danh sách dòng bất kỳ (sản phẩm hoặc dịch vụ đã lọc sẵn) */
export const linesTotal = (lines = []) =>
    (lines || []).reduce((s, p) => s + (p?.included ? 0 : PARSE(p.price) * PARSE(p.qty || 1)), 0);
