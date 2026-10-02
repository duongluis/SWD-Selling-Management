// components/Utils/commissionCalc.js
// Logic tính hoa hồng/thưởng cho 1 đơn hàng — dùng khi đơn chuyển sang "Đã thanh toán"
// (trước đây được tính lại mỗi lần mở màn Hoa hồng, nay ghi 1 lần thành document
// trong collection 'commissions' để useScreenData đọc như các màn khác).

import { db } from '@/config/firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { productItems } from './orderItems';

export const normalizePhone = (p) => String(p || '').replace(/\D/g, '');
export const normalizeName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const getRoleFromUserData = (u) => {
    const r = (u?.role || u?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['sale', 'nhân viên bán hàng'].includes(r)) return 'sale';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

export const getRolePriceField = (role) => ({
    daily: 'price_a',
    phantan: 'price_p',
    ctv: 'price_c',
    sale: 'price_s',
}[role] || 'price');

/**
 * commission = Σ (price_sp_i - basePrice_sp_i) * qty_i
 */
export function calcCommission(items = [], basePriceField = 'price') {
    return Math.max(
        items.reduce((sum, p) => {
            const sellPrice = parseFloat(p.price || 0);
            const basePrice = parseFloat(p[basePriceField] || p.basePrice || p.price || 0);
            const qty = parseFloat(p.qty || 1);
            // Không nhân 0.8 ở đây: phần chia 8/2 cho đơn sale được áp 1 lần duy nhất
            // tại computeOrderCommission (visibleCommission).
            return sum + (sellPrice - basePrice) * qty;
        }, 0),
        0
    );
}

/**
 * bonus = 1% × Σ price_field_role_collab_i × qty_i / 1,08 ( bỏ VAT )
 */
export function calcBonus(items = [], collabPriceField = 'price') {
    return items.reduce((sum, p) => {
        const rolePrice = parseFloat(p[collabPriceField] || p.price || 0);
        const qty = parseFloat(p.qty || 1);
        return sum + rolePrice * qty / 1.08 * 0.01;
    }, 0);
}

const userCache = {};
async function getUserData(email) {
    if (!email) return null;
    if (userCache[email]) return userCache[email];
    try {
        const snap = await getDoc(doc(db, 'users', email));
        if (snap.exists()) {
            const data = snap.data();
            userCache[email] = data;
            return data;
        }
    } catch (_) { }
    return null;
}

// Tìm advisor cấp 1 (không có advisor trên họ)
async function findLevel1Advisor(email) {
    let currentEmail = email;
    const visited = new Set();
    while (currentEmail) {
        if (visited.has(currentEmail)) break;
        visited.add(currentEmail);
        const userData = await getUserData(currentEmail);
        if (!userData) break;
        if (!userData.advisor) return userData;
        currentEmail = userData.advisor;
    }
    return null;
}


/**
 * Tính toàn bộ dữ liệu hoa hồng/thưởng cho 1 đơn hàng đã "Đã thanh toán".
 * Trả về payload sẵn sàng ghi vào collection 'commissions' (docId = order.id).
 */
export async function computeOrderCommission(order) {
    const creatorEmail = order.createdBy;
    const creatorData = await getUserData(creatorEmail);
    if (!creatorData) return null;

    const creatorRole = getRoleFromUserData(creatorData);
    const isSaleOrder = creatorRole === 'sale';   // ← chỉ đơn của sale mới bị chia

    let isReferredSuccess = false;
    try {
        const successConsultSnap = await getDocs(
            query(collection(db, 'consult'), where('status', '==', 'success'))
        );
        isReferredSuccess = successConsultSnap.docs.some(d => {
            const c = d.data();
            return normalizePhone(c.phone) === normalizePhone(order.phone) &&
                normalizeName(c.name) === normalizeName(order.customer);
        });
    } catch (_) { }

    let basePriceField = 'price';
    if (isReferredSuccess) {
        basePriceField = 'price_c';
    } else if (isSaleOrder) {
        basePriceField = 'price_s';
    } else if (creatorData.advisor) {
        const level1 = await findLevel1Advisor(creatorData.advisor);
        if (level1) basePriceField = getRolePriceField(getRoleFromUserData(level1));
    } else {
        basePriceField = getRolePriceField(creatorRole);
    }

    // Chỉ sản phẩm — hoa hồng và doanh thu không tính tiền dịch vụ.
    const items = productItems(order);
    const totalValue = items.reduce(
        (s, p) => s + parseFloat(p.price || 0) * parseFloat(p.qty || 1), 0
    );

    const isCommissionEligible = order.paymentMethod === 'customer';
    const totalCommission = isCommissionEligible ? calcCommission(items, basePriceField) : 0;

    // calcCommission có chuỗi fallback `p[basePriceField] || p.basePrice || p.price`.
    // Nếu bảng giá productPrice thiếu (hoặc để 0) trường giá gốc của vai trò — vd đơn sale
    // mà sản phẩm chưa điền price_s — thì basePrice tụt về đúng giá bán, chênh lệch thành 0
    // và hoa hồng ra 0 y hệt trường hợp "đúng là không có hoa hồng". Cờ này để phân biệt.
    const missingBasePrice = isCommissionEligible
        && basePriceField !== 'price'
        && items.some(p => !(parseFloat(p[basePriceField]) > 0));

    // Đơn của sale chia 8/2:
    // - dòng gốc 8 phần: sale và admin thấy ngay, admin duyệt trả được ngay (như 7 phần cũ)
    // - dòng 2 phần (buildAdminShareRecord, adminOnly): admin thấy và duyệt trả từ
    //   ngày cuối quý thanh toán (releaseAt, GMT+7)
    // Đơn của role khác → ghi đủ 100% như trước, không chia, hiện ngay.
    const paidAt = new Date();
    const visibleCommission = isSaleOrder ? Math.round(totalCommission * 0.8) : totalCommission;

    const collaboratorEmail = creatorData.collaboration || null;
    let bonusAmount = 0;
    if (collaboratorEmail) {
        let bonusPriceField = 'price';
        if (order.rootAdvisor) {
            const rootAdvisorData = await getUserData(order.rootAdvisor);
            if (rootAdvisorData) bonusPriceField = getRolePriceField(getRoleFromUserData(rootAdvisorData));
        } else {
            bonusPriceField = getRolePriceField(creatorRole);
        }
        bonusAmount = calcBonus(items, bonusPriceField);
    }

    return {
        orderId: order.id,
        id: order.id,
        createdBy: creatorEmail,
        sellerEmail: creatorEmail,
        rootAdvisor: order.rootAdvisor || creatorEmail,
        customer: order.customer || '',
        phone: order.phone || '',
        orderType: order.orderType || null,
        paymentMethod: order.paymentMethod || null,
        createdAt: order.createdAt || null,
        paidAt: paidAt.toISOString(),
        releaseAt: null,
        totalValue,
        basePriceField,
        missingBasePrice,
        commission: visibleCommission,
        commissionTotal: totalCommission,
        commissionStatus: 'pending',
        collaboratorEmail,
        bonusAmount,
        bonusStatus: 'pending',
        adminOnly: false,
        creatorRole,
        splitEligible: isSaleOrder,
        splitScheme: isSaleOrder ? '8/2' : null,
    };
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // GMT+7

/**
 * 00:00 (GMT+7) ngày cuối quý chứa `date` (quý tính theo giờ GMT+7, không theo giờ máy).
 * Vd thanh toán 15/02 → 31/03 00:00 GMT+7 (= 30/03 17:00 UTC).
 */
export function quarterEnd(date) {
    const vn = new Date(new Date(date).getTime() + VN_OFFSET_MS);
    const firstMonthOfNextQuarter = Math.floor(vn.getUTCMonth() / 3) * 3 + 3;
    return new Date(Date.UTC(vn.getUTCFullYear(), firstMonthOfNextQuarter, 0) - VN_OFFSET_MS);
}

/**
 * Bản ghi hoa hồng đã tới kỳ chưa (releaseAt = cuối quý): trước đó admin chưa thấy
 * dòng 2 phần nên cũng chưa duyệt trả được.
 */
export const isCommissionReleased = (c, now = new Date()) =>
    !c.releaseAt || new Date(c.releaseAt) <= now;

/**
 * Dòng "2 phần" (adminOnly) đi kèm dòng 8 phần của đơn sale — ghi vào docId `{orderId}-2`.
 * Trả về null nếu đơn không thuộc diện chia.
 */
export function buildAdminShareRecord(payload) {
    if (!payload?.splitEligible) return null;
    return {
        ...payload,
        commission: Math.max(0, payload.commissionTotal - payload.commission),
        releaseAt: quarterEnd(payload.paidAt).toISOString(),
        bonusAmount: 0,
        bonusStatus: 'paid',
        adminOnly: true,
        splitPart: 2,
    };
}
