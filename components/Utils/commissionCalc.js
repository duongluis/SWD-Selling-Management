// components/Utils/commissionCalc.js
// Logic tính hoa hồng/thưởng cho 1 đơn hàng — dùng khi đơn chuyển sang "Đã thanh toán"
// (trước đây được tính lại mỗi lần mở màn Hoa hồng, nay ghi 1 lần thành document
// trong collection 'commissions' để useScreenData đọc như các màn khác).

import { db } from '@/config/firebaseConfig';
import { collection, doc, getDoc, getDocs, query, runTransaction, where, writeBatch } from 'firebase/firestore';
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
    //   ngày cuối quý của createdAt đơn (splitReleaseAt, GMT+7)
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

const toDate = (v) => {
    const d = v?.toDate ? v.toDate() : new Date(v || '');
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Ngày mở dòng 2 phần: cuối quý chứa createdAt của đơn (không theo paidAt — đơn tháng 9
 * thanh toán sang tháng 10 vẫn mở từ 30/09). Chỉ lùi về paidAt khi đơn không có createdAt.
 */
export const splitReleaseAt = (c) =>
    quarterEnd(toDate(c.createdAt) || toDate(c.paidAt) || new Date());

/**
 * Bản ghi hoa hồng đã tới kỳ chưa: trước đó admin chưa thấy dòng 2 phần nên cũng chưa
 * duyệt trả được. Tính lại từ createdAt thay vì đọc releaseAt đã lưu, vì các bản ghi tạo
 * trước đây lưu releaseAt theo paidAt; releaseAt chỉ còn là cờ "dòng này có kỳ mở".
 */
export const isCommissionReleased = (c, now = new Date()) =>
    !c.releaseAt || splitReleaseAt(c) <= now;

// ── Điều chỉnh hoa hồng trực tiếp ─────────────────────────────
// Chỉ tài khoản này thấy nút và được điều chỉnh.
export const COMMISSION_ADJUST_ADMIN = 'admin@swd.vn';

export const canAdjustCommissionAccount = (email) =>
    String(email || '').trim().toLowerCase() === COMMISSION_ADJUST_ADMIN;

/**
 * Hạn điều chỉnh: 00:00 (GMT+7) ngày 15 của tháng sau tháng đơn hoàn thành.
 * Vd hoàn thành 16/09 → điều chỉnh được hết ngày 14/10, từ 15/10 thì khóa.
 */
export function adjustDeadline(date) {
    const vn = new Date(new Date(date).getTime() + VN_OFFSET_MS);
    return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() + 1, 15) - VN_OFFSET_MS);
}

/**
 * Bản ghi hoa hồng còn được điều chỉnh không:
 * - đơn có hoa hồng, người bán không phải nhân viên kinh doanh (sale)
 * - chưa trả, và chưa tới hạn khóa (adjustDeadline tính từ paidAt — lúc đơn hoàn thành)
 */
export function canAdjustCommission(c, now = new Date()) {
    if (!c || c.adminOnly) return false;
    if (c.splitEligible ?? c.creatorRole === 'sale') return false;
    if ((c.commissionStatus || 'pending') === 'paid') return false;
    if (!(c.commission > 0) && !c.adjustments?.length) return false;
    const done = new Date(c.paidAt || '');
    if (isNaN(done.getTime())) return false;
    return now < adjustDeadline(done);
}

/**
 * Tăng/giảm hoa hồng của 1 bản ghi, lưu lại lịch sử trong `adjustments`.
 * Chạy trong transaction để 2 lần điều chỉnh sát nhau không ghi đè nhau.
 * Trả về { before, after }.
 */
export async function adjustCommission({ docId, direction, amount, reason, adminEmail }) {
    if (!canAdjustCommissionAccount(adminEmail)) throw new Error('Tài khoản không có quyền điều chỉnh hoa hồng.');
    const delta = Math.round(Number(amount) || 0);
    if (delta <= 0) throw new Error('Số tiền điều chỉnh phải lớn hơn 0.');

    const ref = doc(db, 'commissions', docId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Không tìm thấy bản ghi hoa hồng.');
        const c = snap.data();
        if (!canAdjustCommission(c)) throw new Error('Hoa hồng của đơn này đã bị khóa điều chỉnh.');

        const before = Math.round(c.commission || 0);
        // Được phép giảm xuống dưới 0 (hoa hồng âm)
        const after = before + (direction === 'decrease' ? -delta : delta);

        tx.update(ref, {
            commission: after,
            commissionTotal: after,
            commissionOriginal: c.commissionOriginal ?? before,
            adjustments: [...(c.adjustments || []), {
                direction: direction === 'decrease' ? 'decrease' : 'increase',
                amount: delta,
                reason,
                before,
                after,
                by: adminEmail,
                at: new Date().toISOString(),
            }],
        });
        return { before, after };
    });
}

/**
 * Dòng "2 phần" (adminOnly) đi kèm dòng 8 phần của đơn sale — ghi vào docId `{orderId}-2`.
 * Trả về null nếu đơn không thuộc diện chia.
 */
export function buildAdminShareRecord(payload) {
    if (!payload?.splitEligible) return null;
    return {
        ...payload,
        commission: Math.max(0, payload.commissionTotal - payload.commission),
        releaseAt: splitReleaseAt(payload).toISOString(),
        bonusAmount: 0,
        bonusStatus: 'paid',
        adminOnly: true,
        splitPart: 2,
    };
}

// ── Chuyển bản ghi cũ 7/2/1 sang 8/2 ──────────────────────────
/**
 * Bản ghi hoa hồng đơn sale ghi theo mô hình 7/2/1 đã bỏ (không có splitScheme) và
 * dòng gốc CHƯA trả. Bản ghi đã trả thì giữ nguyên — dòng 2 phần / 1 phần của nó đã sinh rồi.
 */
export const isLegacySplitRecord = (c) =>
    !!c && !c.adminOnly && !c.splitScheme
    && (c.splitEligible ?? c.creatorRole === 'sale')
    && (c.commissionStatus || 'pending') !== 'paid';

const validIso = (v) => {
    const d = new Date(v || '');
    return isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Chuyển các bản ghi isLegacySplitRecord sang 8/2: dòng gốc thành 8 phần, sinh thêm dòng
 * 2 phần `{orderId}-2` với releaseAt = cuối quý của createdAt đơn (splitReleaseAt).
 * Số 7 phần cũ được giữ lại ở `commissionLegacy` để đối chiếu.
 * `records` là dữ liệu đọc từ collection (có docId). Trả về số bản ghi đã chuyển.
 */
export async function convertLegacySplit(records = []) {
    const targets = records.filter(isLegacySplitRecord);
    // Mỗi bản ghi tốn 2 thao tác, 1 batch Firestore tối đa 500 thao tác
    for (let i = 0; i < targets.length; i += 200) {
        const batch = writeBatch(db);
        targets.slice(i, i + 200).forEach(({ docId, ...c }) => {
            const total = Math.round(c.commissionTotal ?? ((c.commission || 0) / 0.7));
            const changes = {
                paidAt: validIso(c.paidAt) || validIso(c.createdAt) || new Date().toISOString(),
                commission: Math.round(total * 0.8),
                commissionTotal: total,
                commissionLegacy: c.commission || 0,
                releaseAt: null,
                splitEligible: true,
                splitScheme: '8/2',
            };
            // update (không set) để không ghi đè các trường khác vừa đổi, vd bonusStatus
            batch.update(doc(db, 'commissions', docId), changes);
            batch.set(
                doc(db, 'commissions', `${c.orderId || c.id || docId}-2`),
                buildAdminShareRecord({ ...c, ...changes })
            );
        });
        await batch.commit();
    }
    return targets.length;
}
