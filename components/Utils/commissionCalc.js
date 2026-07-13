// components/Utils/commissionCalc.js
// Logic tính hoa hồng/thưởng cho 1 đơn hàng — dùng khi đơn chuyển sang "Đã thanh toán"
// (trước đây được tính lại mỗi lần mở màn Hoa hồng, nay ghi 1 lần thành document
// trong collection 'commissions' để useScreenData đọc như các màn khác).

import { db } from '@/config/firebaseConfig';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

export const normalizePhone = (p) => String(p || '').replace(/\D/g, '');
export const normalizeName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const getRoleFromUserData = (u) => {
    const r = (u?.role || u?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

export const getRolePriceField = (role) => ({
    daily: 'price_a',
    phantan: 'price_p',
    ctv: 'price_c',
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
            return sum + (sellPrice - basePrice) * qty;
        }, 0),
        0
    );
}

/**
 * bonus = 1% × Σ price_field_role_collab_i × qty_i
 */
export function calcBonus(items = [], collabPriceField = 'price') {
    return items.reduce((sum, p) => {
        const rolePrice = parseFloat(p[collabPriceField] || p.price || 0);
        const qty = parseFloat(p.qty || 1);
        return sum + rolePrice * qty * 0.01;
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

    // Khách được giới thiệu (consult) đã tư vấn thành công → tính theo giá CTV
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
    } else if (creatorData.advisor) {
        const level1 = await findLevel1Advisor(creatorData.advisor);
        if (level1) basePriceField = getRolePriceField(getRoleFromUserData(level1));
    } else {
        basePriceField = getRolePriceField(creatorRole);
    }

    const items = order.items || [];
    const totalValue = items.reduce(
        (s, p) => s + parseFloat(p.price || 0) * parseFloat(p.qty || 1), 0
    );

    // Hoa hồng: chỉ tính nếu đơn khách hàng tự thanh toán
    const isCommissionEligible = order.paymentMethod === 'customer';
    const commission = isCommissionEligible ? calcCommission(items, basePriceField) : 0;

    // Thưởng: tính cho collaborator của người tạo đơn (nếu có)
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
        createdBy: creatorEmail,          // để useScreenData lọc theo team (createdBy in [...])
        sellerEmail: creatorEmail,
        rootAdvisor: order.rootAdvisor || creatorEmail,
        customer: order.customer || '',
        phone: order.phone || '',
        orderType: order.orderType || null,
        paymentMethod: order.paymentMethod || null,
        createdAt: order.createdAt || null, // ngày giao đơn, để sort/hiển thị giống các bản ghi khác
        paidAt: new Date().toISOString(),
        totalValue,
        basePriceField,
        commission,
        commissionStatus: 'pending',
        collaboratorEmail,
        bonusAmount,
        bonusStatus: 'pending',
    };
}
