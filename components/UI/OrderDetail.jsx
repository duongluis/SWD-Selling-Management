// components/UI/OrderDetail.jsx
// Panel chi tiết đơn hàng — dùng ở order.jsx (web) và OrderView (mobile)

import { showAlert } from '@/components/Main/showAlert';
import { createNotification, getSupportRoomId, sendStatusUpdateMessage } from '@/components/Utils/chatService';
import { computeOrderCommission } from '@/components/Utils/commissionCalc';
import { fmtCurrency } from '@/components/Utils/formatters';
import { linesTotal, productItems, productTotal } from '@/components/Utils/orderItems';
import { isAdmin as checkAdmin } from '@/components/Utils/roleHelper';
import { syncServiceStatusFromOrder } from '@/components/Utils/syncOrderStatus';
import { revertRevenueOnDelete, trackRevenueOnPaid } from '@/components/Utils/trackRevenue';
import { db } from '@/config/firebaseConfig';
import statusConfig from '@/config/status.json';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
} from 'react-native';
import banksData from '../../config/banks.json';
import { useLayout } from '../Main/TabScreenLayout';
import { generateVietQR } from '../Utils/vietQR';
import QRCode from 'react-native-qrcode-svg';
let QRCodeWeb = null;
if (Platform.OS === 'web') {
    QRCodeWeb = require('qrcode.react').QRCodeSVG;
}

// Khối QR chuyển khoản ở cuối panel chi tiết đơn. Đặt true để bật lại.
// Khi false, effect buildQR cũng không chạy nên không tốn lượt đọc Firestore.
const SHOW_PAYMENT_QR = false;


const PARSE = (v) => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

// ── Xuất biên bản bàn giao ────────────────────────────────────
async function _getLogo() {
    try {
        const { Asset } = await import('expo-asset');
        const a = Asset.fromModule(require('../../assets/images/logo-light.png'));
        await a.downloadAsync();
        return a.uri;
    } catch { return null; }
}

async function _printHtml(html, isDesktop) {
    if (isDesktop) {
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 400);
    } else {
        try {
            const Print = await import('expo-print');
            await Print.printAsync({ html });
        } catch (e) { console.error(e); }
    }
}

async function _getAdminInfo() {
    try {
        const q = query(collection(db, 'users'), where('email', '==', 'admin@swd.vn'));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0].data();
        return { name: 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT GOLDEN PANTHERA', phone: '0108133982', email: 'admin@swd.vn' };
    } catch {
        return { name: 'GOLDEN PANTHERA (Admin)', email: 'admin@swd.vn' };
    }
}

// Thay thế hàm _getUserByEmail bằng hàm này
async function _getLevel1Advisor(createdByEmail) {
    if (!createdByEmail) return null;
    try {
        // Lấy thông tin người tạo đơn
        const userSnap = await getDoc(doc(db, 'users', createdByEmail));
        if (!userSnap.exists()) return null;
        const userData = userSnap.data();

        // Cấp 1: advisor === null → chính họ là cấp 1
        if (!userData.advisor) return userData;

        // Cấp 2: advisor trỏ về cấp 1
        const lvl1Snap = await getDoc(doc(db, 'users', userData.advisor));
        if (!lvl1Snap.exists()) return userData; // fallback
        const lvl1Data = lvl1Snap.data();

        // Nếu cấp 1 không có advisor → đúng rồi
        if (!lvl1Data.advisor) return lvl1Data;

        // Cấp 3: advisor của lvl1 trỏ về cấp 1 thực sự
        const lvl0Snap = await getDoc(doc(db, 'users', lvl1Data.advisor));
        if (!lvl0Snap.exists()) return lvl1Data; // fallback
        return lvl0Snap.data();

    } catch (e) {
        console.error('_getLevel1Advisor error:', e);
        return null;
    }
}

function _buildHandoverHtml({ order, seller, services, logoBase64 }) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const isCompany = seller.bizModel === 'company' || !!seller.taxCode;
    // Rows Sản phẩm
    const productRows = productItems(order).map((p, i) => `
        <tr>
            <td style="text-align:center">${i + 1}</td>
            <td>${p.name}</td>
            <td style="text-align:center">${p.qty.toString().padStart(2, '0')}</td>
            <td style="text-align:center">Máy</td>
        </tr>`).join('');

    // Rows Dịch vụ
    const serviceRows = (services || []).map((s, i) => `
        <tr>
            <td style="text-align:center">${i + 1}</td>
            <td>${s.type === 'INSTALLATION' ? 'Thi công, vận chuyển, lắp đặt máy' : s.type === 'MAINTENANCE' ? 'Bảo dưỡng hệ thống' : s.type}</td>
            <td style="text-align:center">01</td>
            <td style="text-align:center">Đã bao gồm</td>
        </tr>`).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
        body { font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.5; color: #000; padding: 10px; }
            .header-title { text-align: center; font-weight: bold; font-size: 13pt; text-transform: uppercase; margin-bottom: 5px; }
            .sub-title { text-align: center; font-size: 10pt; margin-bottom: 5px; }
            
            .info-table { width: 100%; border: none; margin-bottom: 20px; }
            .info-table td { border: none; padding: 2px 0; vertical-align: top; font-size: 10pt; }
            .label { font-weight: bold; width: 180px; text-transform: uppercase; font-size:13pt }
            .dots { flex: 1; border-bottom: 1px dotted #000; min-height: 1.2em; display: inline-block; width: 100%; }
            
            .section-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; font-size: 13pt; }
            
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            table.data-table th, table.data-table td { border: 1px solid #000; padding: 8px; font-size: 12pt; }
            table.data-table th { background-color: #f2f2f2; text-transform: uppercase; }
            
            .notes-list { padding-left: 25px; margin-bottom: 20px; }
            .notes-list li { margin-bottom: 10px; text-align: justify; }
            
            .confirmation-text { font-style: italic; margin-top: 15px; font-size: 10pt; }
            
            .footer-sig { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; }
            .sig-box { width: 48%; font-size: 10pt; }
            .watermark { position: fixed; top: 25%; left: 10%; width: 80%; opacity: 0.04; z-index: -1; }
        @media print {
            .page-break {
            display: block;
            page-break-before: always; /* Nhảy sang trang mới trước khi bắt đầu thẻ này */
            break-before: page; /* Thuộc tính hiện đại hơn cho các trình duyệt mới */
            }
        }
        </style>
    </head>
    <body>
        ${logoBase64 ? `<img src="${logoBase64}" class="watermark">` : ''}
        
        <div class="header-title">BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO CHẤT LƯỢNG<br/>KHỐI LƯỢNG HẠNG MỤC THI CÔNG</div>
        <div class="sub-title">Ngày bàn giao: ..../..../${currentYear}</div>
        <div class="sub-title">Ngày lắp đặt: ..../..../${currentYear}</div>
   <br>   <br>
 <!--  <p>Hạng mục cung cấp thiết bị và thi công: <strong>"${(order.items || []).map(p => p.name).join(', ')} "</strong></p> -->

   <p>Hạng mục cung cấp thiết bị và thi công <strong>"Hệ thống lọc tổng sinh hoạt "</strong></p> 

        <!-- BÊN NHẬN -->
        <table class="info-table">
            <tr>
                <td class="label">BÊN NHẬN BÀN GIAO:</td>
                <td style="font-weight:bold">${order.customer}</td>
            </tr>
            <tr>
                <td>Địa chỉ công trình:</td>
                <td>${order.address || '...........................................................................................'}</td>
            </tr>
            <tr>
                <td>Số điện thoại:</td>
                <td>${order.phone || '...........................................................................................'}</td>
            </tr>
            <tr>
                <td>Người nhận bàn giao:</td>
                <td>...........................................................................................</td>
            </tr>
            <tr>
                <td>Chức vụ:</td>
                <td>...........................................................................................</td>
            </tr>
            <tr>
                <td></td>
                <td style="font-style: italic">(Sau đây gọi tắt là <strong>“Bên A”</strong>)</td>
            </tr>
        </table>

        <!-- BÊN GIAO -->
        <table class="info-table">
            <tr>
                <td class="label">BÊN BÀN GIAO:</td>
                <td style="font-weight:bold;">${seller.companyName || seller.name || 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ VÀ SẢN XUẤT GOLDEN PANTHERA'}</td>
            </tr>
            ${isCompany ? `
                <tr><td>Mã số thuế:</td><td>${seller.taxCode || '—'}</td></tr>
                <tr><td>Địa chỉ:</td><td>${seller.bizAddress || seller.address || '...........................................................................................'}</td></tr>
                <tr><td>Người đại diện:</td><td>${seller.contactName || '...........................................................................................'}</td></tr>
                <tr><td>Chức vụ:</td><td>${seller.title || '...........................................................................................'}</td></tr>
            ` : `
                <tr>
                    <td>Số điện thoại:</td>
                    <td>${seller.phone || '...........................................................................................'}</td>
                </tr>
                <tr><td>Địa chỉ:</td><td>${seller.address || '—'}</td></tr>

            `}
            <tr>
                <td></td>
                <td style="font-style: italic">(Sau đây gọi tắt là <strong>“Bên B”</strong>)</td>
            </tr>
        </table>

        <p>Hai bên đã thống nhất nghiệm thu và bàn giao các hạng mục như sau:</p>

        <div class="section-title">I. DANH MỤC SẢN PHẨM DỊCH VỤ:</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 8%">STT</th>
                    <th style="width: 62%">HẠNG MỤC</th>
                    <th style="width: 10%">SL</th>
                    <th style="width: 20%">Đơn vị</th>
                </tr>
            </thead>
            <tbody>
                <tr><td colspan="4" style="font-weight:bold; background:#f9f9f9">HỆ THỐNG LỌC NƯỚC TỔNG SINH HOẠT</td></tr>
                ${productRows}
                <tr><td colspan="4" style="font-weight:bold; background:#f9f9f9">DỊCH VỤ</td></tr>
                ${serviceRows}
            </tbody>
        </table>

        <br/>

       <div class="section-title page-break">II. CHECKLIST KIỂM TRA CHI TIẾT VẬN HÀNH, AN TOÀN:</div>
       <table class="data-table">
            <tr>
                <th style="width: 8%">STT</th>
                <th style="width: 32%">NỘI DUNG</th>
                <th style="width: 30%">Tình trạng thực tế</th>
                <th style="width: 30%">Ghi chú</th>
            </tr>
            <tr><td style="text-align:center">1</td><td>Nguồn điện</td><td>□ Có &nbsp;&nbsp; □ Chưa có</td><td></td></tr>
            <tr><td style="text-align:center">2</td><td>Nguồn nước</td><td>□ Có &nbsp;&nbsp; □ Chưa có</td><td></td></tr>
            <tr><td style="text-align:center">3</td><td>Kích hoạt máy</td><td>□ Đã kích hoạt &nbsp;&nbsp; □ Chưa kích hoạt</td><td></td></tr>
            <tr><td style="text-align:center">4</td><td>Vị trí lắp đặt máy</td><td>□ Đã hoàn thành (đã treo máy) &nbsp;&nbsp; □ Chưa hoàn thành</td><td></td></tr>
            <tr><td style="text-align:center">5</td><td>Vị trí lắp đặt thùng muối</td><td>□ Đã hoàn thành &nbsp;&nbsp; □ Chưa hoàn thành</td><td></td></tr>
            <tr><td style="text-align:center">6</td><td>Test rò rỉ hệ thống</td><td>□ Đã kiểm tra, không rò rỉ &nbsp;&nbsp; □ Chưa kiểm tra</td><td></td></tr>
        </table>

        <div class="section-title">III. LƯU Ý:</div>
        <ul class="notes-list">
            <li><strong>Trường hợp thiếu nguồn điện:</strong> Nếu địa hình nhà khách chưa có nguồn điện, máy sẽ không được mở để sử dụng. Trường hợp Bên A yêu cầu mở máy để phục vụ mục đích riêng, mọi rủi ro về bảo quản, mất mát hoặc hư hỏng sẽ hoàn toàn thuộc về Bên A.</li>
            <li><strong>Chuyển giao trách nhiệm:</strong> Ngay sau khi ký biên bản này, trách nhiệm bảo quản, quản lý thiết bị và mọi rủi ro liên quan đến mất mát, hư hỏng do tác động ngoại cảnh (không phải lỗi sản xuất của SWD) sẽ hoàn toàn thuộc về Bên A.</li>
        </ul>

        <div class="confirmation-text">
            Khối lượng thi công và chất lượng đã hoàn thành theo biên bản trên<br/>
            Nội dung biên bản trên đã được thống nhất xác nhận từ cả hai bên<br/>
            vào Ngày .... Tháng .... Năm ${currentYear}
        </div>

        <div class="footer-sig">
            <div class="sig-box">
                <div style="font-weight:bold; text-transform: uppercase;">ĐẠI DIỆN BÊN NHẬN BÀN GIAO</div>
                <div style="margin-top:80px; font-weight:bold">${order.customer}</div>
            </div>
            <div class="sig-box">
                <div style="font-weight:bold; text-transform: uppercase;">ĐẠI DIỆN BÊN BÀN GIAO</div>
                <div style="margin-top:80px; font-weight:bold">${seller.name}</div>
            </div>
        </div>
    </body>
    </html>`;
}



// ── Status config ─────────────────────────────────────────────
const S_CFG = {
    'Chờ xác nhận': { c: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
    'Chờ lắp đặt': { c: '#2563EB', bg: '#EFF6FF', bd: '#BFDBFE' },
    'Đang lắp đặt': { c: '#7C3AED', bg: '#F5F3FF', bd: '#DDD6FE' },
    'Đã lắp đặt': { c: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
    'Chờ thanh toán': { c: '#EA580C', bg: '#FFF7ED', bd: '#FED7AA' },
    'Đã thanh toán': { c: '#16A34A', bg: '#DCFCE7', bd: '#86EFAC' },
    'Đã hủy': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
    'CANCELLED': { c: '#DC2626', bg: '#FEF2F2', bd: '#FCA5A5' },
    'PENDING': { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' },
};
const scfg = (s) => S_CFG[s] || { c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' };

const TYPE_CFG = {
    buon: { label: 'Đơn buôn', c: '#065F46', bg: '#ECFDF5' },
    le: { label: 'Đơn lẻ', c: '#5B21B6', bg: '#F5F3FF' },
};

const LOCKED_STATUSES = ['Đã thanh toán', 'Hoàn thành', 'Đã hủy', 'CANCELLED', 'PENDING', 'COMPLETED'];

// Lấy danh sách trạng thái theo loại đơn từ status.json
const getStatusOptions = (orderType) => {
    const key = orderType === 'buon' ? 'don_buon' : 'don_le';
    return (statusConfig[key] || statusConfig['don_le']).map(s => s.name);
};

// Các trạng thái "đang xử lý/giao hàng" vốn tự động đồng bộ theo dịch vụ đính kèm
// (xem syncServiceStatusFromOrder) → chỉ cho sửa tay khi đơn KHÔNG có dịch vụ nào
const AUTO_SYNC_STATUSES = ['Chờ xử lý', 'Đang xử lý', 'Chờ lắp đặt', 'Đang lắp đặt', 'Chờ giao hàng', 'Đang giao hàng'];

// Kiểm tra trạng thái hiện tại có được phép thay đổi không
const isStatusChangeable = (orderType, currentStatus, hasNoServices) => {
    if (!currentStatus || ['CANCELLED', 'PENDING', 'COMPLETED'].includes(currentStatus)) return false;
    const key = orderType === 'buon' ? 'don_buon' : 'don_le';
    const found = (statusConfig[key] || statusConfig['don_le']).find(s => s.name === currentStatus);
    if (!found) return false;
    if (found.changeable) return true;
    // Đơn không có dịch vụ đính kèm → không có gì tự đồng bộ, cho phép sửa tay
    return !!hasNoServices && AUTO_SYNC_STATUSES.includes(currentStatus);
};

// ── Status Chip ───────────────────────────────────────────────
export function StatusChip({ status, onPress, dropdown }) {
    const cfg = scfg(status);
    const pressable = typeof onPress === 'function';  // ← chỉ enable khi là function

    return (
        <TouchableOpacity
            style={[SD.chip, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}
            onPress={pressable ? onPress : undefined}
            activeOpacity={pressable ? 0.8 : 1}
            disabled={!pressable}
        >
            <View style={[SD.dot, { backgroundColor: cfg.c }]} />
            <Text style={[SD.text, { color: cfg.c }]}>{status || 'PENDING'}</Text>
            {dropdown && <Ionicons name="chevron-down" size={11} color={cfg.c} />}
        </TouchableOpacity>
    );
}

// ── Status Menu ───────────────────────────────────────────────
export function StatusMenu({ status, options, onChange, onClose, style }) {
    return (
        <View style={[SD.menu, style]}>
            {(options || getStatusOptions('le')).map(s => {
                const cfg = scfg(s);
                const active = s === status;
                return (
                    <TouchableOpacity
                        key={s}
                        style={[SD.menuItem, active && { backgroundColor: cfg.bg }]}
                        onPress={() => { onChange(s); onClose(); }}
                    >
                        <View style={[SD.dot, { backgroundColor: cfg.c }]} />
                        <Text style={[SD.menuText, { color: active ? cfg.c : '#374151', fontWeight: active ? '700' : '500' }]}>
                            {s}
                        </Text>
                        {active && <Ionicons name="checkmark" size={13} color={cfg.c} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const SD = StyleSheet.create({
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontSize: 12, fontWeight: '700' },
    menu: { position: 'absolute', zIndex: 9999, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', minWidth: 180, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
    menuText: { fontSize: 13 },
});

// ── OrderDetail Panel ─────────────────────────────────────────
export default function OrderDetail({ order, onClose, onUpdated, role }) {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const admin = checkAdmin(role);
    const chipRef = useRef(null);
    const { isDesktop } = useLayout();

    // ── State — khai báo TRƯỚC mọi return ──
    const [localOrder, setLocalOrder] = useState(null);
    const [services, setServices] = useState([]);
    // true ngay từ đầu để tránh nháy "Chưa có dịch vụ" / mở khoá đổi trạng thái nhầm
    // trong khoảnh khắc trước khi fetchServices (useEffect) kịp chạy
    const [svLoading, setSvLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });
    const [updating, setUpdating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [orderCreator, setOrderCreator] = useState(null);
    const [qrString, setQrString] = useState('');
    const [bankInfo, setBankInfo] = useState(null);
    const [deleting, setDeleting] = useState(false);


    useEffect(() => {
        if (!SHOW_PAYMENT_QR || !localOrder) return;

        const buildQR = async () => {
            let bankAccountNo, bankAccountName, bankId;

            if (localOrder.paymentMethod === 'customer') {
                // Lấy thông tin bank của admin
                try {
                    const adminSnap = await getDoc(doc(db, 'users', 'admin@swd.vn'));
                    if (!adminSnap.exists()) return;
                    const adminData = adminSnap.data();
                    if (!adminData?.bank?.id || !adminData?.bank?.accountNo) return;
                    bankId = adminData.bank.id;
                    bankAccountNo = adminData.bank.accountNo;
                    bankAccountName = adminData.bank.accountName;
                } catch { return; }
            } else {
                // Doanh nghiệp thanh toán → tìm người tạo đơn không có advisor
                try {
                    const creatorSnap = await getDoc(doc(db, 'users', localOrder.createdBy));
                    if (!creatorSnap.exists()) return;
                    const creatorData = creatorSnap.data();

                    let targetUser = creatorData;

                    // Nếu người tạo có advisor → leo lên tìm người không có advisor
                    if (creatorData.advisor) {
                        const lvl1Snap = await getDoc(doc(db, 'users', creatorData.advisor));
                        if (lvl1Snap.exists()) targetUser = lvl1Snap.data();
                    }

                    if (!targetUser?.bank?.id || !targetUser?.bank?.accountNo) return;
                    bankId = targetUser.bank.id;
                    bankAccountNo = targetUser.bank.accountNo;
                    bankAccountName = targetUser.bank.accountName;
                } catch { return; }
            }

            const bank = banksData.find(b => b.id === bankId);
            if (!bank?.bin) return;

            setBankInfo({ ...bank, accountNo: bankAccountNo, accountName: bankAccountName });

            // QR là số tiền khách thực trả → sản phẩm + dịch vụ. Khác với doanh thu ghi
            // nhận (chỉ sản phẩm) nên phải cộng riêng, không dùng lại productTotal.
            const amount = Math.round(productTotal(localOrder) + linesTotal(services));
            setQrString(generateVietQR({
                bankBin: bank.bin,
                bankNumber: bankAccountNo,
                amount,
                description: `TTDH ${localOrder.id}`,
            }));
        };

        buildQR();
    }, [localOrder, services]);

    // ── Fetch helpers — dùng useCallback để không phụ thuộc closure ──
    const fetchServices = useCallback(async (orderId) => {
        if (!orderId) return;
        setSvLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'service'), where('orderId', '==', orderId))
            );
            setServices(snap.docs.map(d => ({ ...d.data(), docId: d.id })));
        } catch (_) { }
        finally { setSvLoading(false); }
    }, []);

    const fetchOrderCreator = useCallback(async (o) => {
        try {
            const phone = o?.phone || o?.customerPhone;
            if (!phone) return;
            const custSnap = await getDocs(
                query(collection(db, 'customers'), where('phone', '==', phone))
            );
            if (!custSnap.empty) {
                setOrderCreator(custSnap.docs[0].data().createdBy || null);
            }
        } catch (_) { }
    }, []);

    const openMenu = () => {
        if (!canChangeStatus || !chipRef.current) return;
        chipRef.current.measure((_fx, _fy, width, height, pageX, pageY) => {
            const sw = Dimensions.get('window').width;
            setMenuPos({ top: pageY + height + 4, right: sw - pageX - width });
            setMenuOpen(true);
        });
    };

    // ── Effect — 1 useEffect duy nhất ──
    useEffect(() => {
        if (order) {
            setLocalOrder(order);
            setMenuOpen(false);
            fetchServices(order.id);
            fetchOrderCreator(order);
        }
    }, [order, fetchServices, fetchOrderCreator]);

    // ── Guard — đặt SAU toàn bộ hooks ──
    if (!order || !localOrder) return null;

    // ── Derived values ──
    // `items` chỉ còn sản phẩm (dịch vụ nằm ở collection 'service', lấy qua fetchServices).
    // productItems() vẫn lọc để đơn cũ — vốn nhét dịch vụ chung vào items — không bị
    // cộng nhầm tiền dịch vụ vào doanh thu.
    const items = productItems(localOrder);
    const total = productTotal(localOrder);                 // doanh thu sản phẩm
    const servicesTotal = linesTotal(services);             // tiền dịch vụ, chỉ hiển thị ở đây
    const grandTotal = total + servicesTotal;               // số tiền thực thu của khách
    const tcfg = TYPE_CFG[localOrder.orderType];
    const date = localOrder.createdAt
        ? new Date(localOrder.createdAt).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        })
        : null;
    const paymentDateStr = localOrder.paymentDate
        ? new Date(localOrder.paymentDate).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        : null;

    // Quyền sửa: admin, hoặc người tạo đơn NHƯNG phải là cấp 1 (không có advisor).
    // Người tạo đơn ở cấp 2 trở xuống không sửa được đơn của chính mình.
    const isLevel1Creator = localOrder.createdBy === userDetail?.email
        && !userDetail?.advisor;

    const canEditOrder = (admin || isLevel1Creator)
        && ['Chờ xác nhận', 'PENDING'].includes(localOrder.status);
    // && !LOCKED_STATUSES.includes(localOrder.status);

    // Quyền đổi status: chỉ admin
    const hasNoServices = !svLoading && services.length === 0;
    const canChangeStatus = admin
        && isStatusChangeable(localOrder.orderType, localOrder.status, hasNoServices);

    // ── Handlers ──
    const handleExport = async () => {
        if (!localOrder) return;
        setExporting(true);
        try {
            const logo = await _getLogo();

            let sellerInfo;
            if (localOrder.paymentMethod === 'customer') {
                // Khách hàng thanh toán → dùng thông tin Admin
                sellerInfo = await _getAdminInfo();
            } else {
                // Doanh nghiệp thanh toán → leo cây tìm người cấp 1
                const creatorEmail = localOrder.createdBy;
                const level1User = await _getLevel1Advisor(creatorEmail);
                sellerInfo = level1User || userDetail;
            }

            const svcSnap = await getDocs(
                query(collection(db, 'service'), where('orderId', '==', localOrder.id))
            );
            const linkedServices = svcSnap.docs.map(d => d.data());

            const html = _buildHandoverHtml({
                order: localOrder,
                seller: sellerInfo,
                services: linkedServices,
                logoBase64: logo,
            });

            await _printHtml(html, isDesktop);
        } catch (e) {
            console.error(e);
            showAlert('Lỗi', 'Không thể xuất hóa đơn: ' + e.message);
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteOrder = () => {
        if (!admin || !localOrder) return;
        showAlert(
            'Xoá đơn hàng',
            `Bạn có chắc muốn xoá đơn #${localOrder.id}? Hành động này sẽ xoá vĩnh viễn đơn hàng${services.length > 0 ? `, ${services.length} dịch vụ đi kèm` : ''} và toàn bộ hoa hồng của đơn. Không thể hoàn tác.`,
            async () => {
                setDeleting(true);
                try {
                    // 1. Xoá toàn bộ service gắn với đơn (query lại để chắc chắn không sót
                    //    dịch vụ nào phát sinh sau lần fetch gần nhất)
                    const svcSnap = await getDocs(
                        query(collection(db, 'service'), where('orderId', '==', localOrder.id))
                    );
                    await Promise.all(svcSnap.docs.map(d => deleteDoc(doc(db, 'service', d.id))));

                    // 2. Xoá hoa hồng/thưởng của đơn — gồm cả 2 dòng chia "2 phần"/"1 phần"
                    //    (docId `{orderId}-2`, `{orderId}-3`) sinh ra khi admin duyệt trả.
                    const commSnap = await getDocs(
                        query(collection(db, 'commissions'), where('orderId', '==', localOrder.id))
                    );
                    const commIds = new Set(commSnap.docs.map(d => d.id));
                    // Bản ghi cũ có thể thiếu trường orderId nên query không thấy → bổ sung
                    // theo docId suy ra từ mã đơn. deleteDoc trên doc không tồn tại là no-op.
                    [localOrder.id, `${localOrder.id}-2`, `${localOrder.id}-3`]
                        .forEach(id => commIds.add(id));
                    await Promise.all([...commIds].map(id => deleteDoc(doc(db, 'commissions', id))));

                    // 3. Trừ lại doanh thu đã cộng vào users khi đơn được thanh toán,
                    //    nếu không "Top nhân viên" ở màn Báo cáo sẽ đếm mãi đơn đã xoá.
                    await revertRevenueOnDelete(localOrder.createdBy, localOrder);

                    // 4. Xoá đơn hàng
                    await deleteDoc(doc(db, 'orders', localOrder.id));

                    // 5. Thông báo người tạo đơn (nếu không phải chính admin đang thao tác)
                    if (orderCreator && orderCreator !== userDetail?.email) {
                        const roomId = getSupportRoomId(orderCreator);
                        await createNotification({
                            userEmail: orderCreator,
                            type: 'order_deleted',
                            title: '🗑️ Đơn hàng đã bị xoá',
                            body: `Đơn #${localOrder.id} (KH: ${localOrder.customer || '—'}) đã bị admin xoá khỏi hệ thống`,
                            orderId: localOrder.id,
                            roomId,
                            path: '/(tabs)/order',
                        }).catch(() => { });
                    }

                    // 6. Báo cho parent biết để cập nhật lại danh sách, rồi đóng panel
                    onUpdated?.({ ...localOrder, _deleted: true });
                    onClose?.();
                } catch (e) {
                    showAlert('Lỗi', 'Không thể xoá đơn hàng: ' + e.message);
                } finally {
                    setDeleting(false);
                }
            }
        );
    };

    const handleStatusChange = async (newStatus) => {
        if (!admin || !localOrder) return;
        showAlert('Cập nhật trạng thái', `Chuyển sang "${newStatus}"?`, async () => {
            setUpdating(true);
            try {
                // Đơn chuyển sang "Đã thanh toán" → ghi nhận thời điểm thanh toán
                const isPaid = newStatus === 'Đã thanh toán';
                const paymentDate = isPaid ? new Date().toISOString() : null;

                // ✅ Cập nhật trực tiếp vào document order (cấu trúc phẳng)
                const orderRef = doc(db, 'orders', localOrder.id);
                await updateDoc(orderRef, {
                    status: newStatus,
                    ...(isPaid ? { paymentDate } : {}),
                });

                // Đơn thanh toán lần đầu → ghi 1 document hoa hồng/thưởng vào collection 'commissions'
                // (chỉ áp dụng cho đơn thanh toán từ nay trở đi, không hồi tố đơn cũ)
                if (isPaid) {
                    // Không fire-and-forget: hoa hồng hỏng thì admin phải biết ngay, chứ
                    // trước đây lỗi chỉ nằm trong console nên nhìn từ UI như thể tính năng
                    // không chạy, rất khó lần ra nguyên nhân.
                    try {
                        const payload = await computeOrderCommission({ ...localOrder, status: newStatus, paymentDate });
                        if (!payload) {
                            showAlert(
                                'Không ghi được hoa hồng',
                                `Đơn #${localOrder.id} đã chuyển sang "${newStatus}", nhưng không tìm thấy hồ sơ người tạo đơn (users/${localOrder.createdBy || '—'}). Hoa hồng chưa được tạo.`
                            );
                        } else if (payload.missingBasePrice) {
                            showAlert(
                                'Thiếu giá gốc trong bảng giá',
                                `Đơn #${localOrder.id}: có sản phẩm chưa được điền "${payload.basePriceField}" trong bảng giá (productPrice). `
                                + `Hoa hồng đang bị tính thành 0 vì không có giá gốc để so. Hãy cập nhật bảng giá rồi đặt lại trạng thái đơn.`
                            );
                            await setDoc(doc(db, 'commissions', localOrder.id), payload);
                        } else if (payload.commission <= 0 && payload.bonusAmount <= 0) {
                            showAlert(
                                'Hoa hồng bằng 0',
                                `Đơn #${localOrder.id}: hình thức thanh toán "${payload.paymentMethod}", giá gốc so theo "${payload.basePriceField}". `
                                + `Hoa hồng chỉ phát sinh khi khách hàng tự thanh toán ("customer") và giá bán cao hơn giá gốc của vai trò.`
                            );
                            await setDoc(doc(db, 'commissions', localOrder.id), payload);
                        } else {
                            await setDoc(doc(db, 'commissions', localOrder.id), payload);
                        }
                    } catch (e) {
                        console.error(`Ghi commission cho đơn #${localOrder.id} thất bại:`, e);
                        showAlert('Lỗi ghi hoa hồng', `Đơn #${localOrder.id}: ${e.message}`);
                    }

                    // Cộng doanh thu vào users/{email}.revenueTotal cho người bán và advisor
                    // cấp trên. Bảng "Top nhân viên" ở màn Báo cáo đọc đúng trường này —
                    // trước đây không nơi nào gọi nên bảng đó luôn rỗng.
                    // trackRevenueOnPaid tự chống cộng trùng qua mảng revenueOrders.
                    trackRevenueOnPaid(localOrder.createdBy, localOrder, newStatus)
                        .catch(e => console.error(`Ghi doanh thu cho đơn #${localOrder.id} thất bại:`, e));
                }

                // Sync service + gửi chat message (fire-and-forget)
                syncServiceStatusFromOrder(localOrder.id, newStatus).catch(() => { });
                sendStatusUpdateMessage({
                    orderId: localOrder.id,
                    newStatus,
                    changedBy: userDetail?.email,
                    changedByName: userDetail?.name,
                }).catch(() => { });

                // Thông báo người tạo đơn
                let roomId = null;
                if (orderCreator) {
                    roomId = getSupportRoomId(orderCreator);
                }
                if (roomId && orderCreator && orderCreator !== userDetail?.email) {
                    await createNotification({
                        userEmail: orderCreator,
                        type: 'order_status_changed',
                        title: '🔄 Trạng thái đơn hàng thay đổi',
                        body: `Đơn #${localOrder.id} (KH: ${localOrder.customer || '—'}) chuyển sang "${newStatus}"`,
                        orderId: localOrder.id,
                        roomId,
                        path: `/chat/${roomId}?orderId=${localOrder.id}`,
                    });
                }

                const next = { ...localOrder, status: newStatus, ...(isPaid ? { paymentDate } : {}) };
                setLocalOrder(next);
                onUpdated?.(next);
            } catch (e) { showAlert('Lỗi', e.message); }
            finally { setUpdating(false); setMenuOpen(false); }
        });
    };

    // ── Render ──
    return (
        <View style={DP.root}>
            {/* ── Header ── */}
            <View style={DP.header}>
                <View style={DP.headerTop}>
                    {date && <Text style={DP.date}>Ngày giao đơn: {date}</Text>}
                    <TouchableOpacity style={DP.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={15} color="#64748B" />
                    </TouchableOpacity>
                </View>

                <View style={DP.titleRow}>
                    <Text style={DP.title}>Order #{localOrder.id}</Text>
                    {tcfg && (
                        <View style={[DP.typePill, { backgroundColor: tcfg.bg }]}>
                            <Text style={[DP.typePillText, { color: tcfg.c }]}>{tcfg.label}</Text>
                        </View>
                    )}
                </View>

                {paymentDateStr && (
                    <View style={DP.paymentDateRow}>
                        <Ionicons name="checkmark-done-circle-outline" size={13} color="#16A34A" />
                        <Text style={DP.paymentDateText}>Ngày thanh toán: {paymentDateStr}</Text>
                    </View>
                )}

                <View style={DP.actions}>
                    {/* Xuất HĐ */}
                    <TouchableOpacity style={DP.aBtn} onPress={handleExport} disabled={exporting}>
                        {exporting
                            ? <ActivityIndicator size="small" color="#2563EB" style={{ width: 13 }} />
                            : <Ionicons name="document-text-outline" size={13} color="#2563EB" />
                        }
                        <Text style={DP.aBtnText}>{exporting ? 'Đang xuất...' : 'Xuất HĐ'}</Text>
                    </TouchableOpacity>

                    {/* Chat */}
                    {role !== 'giamdoc' && (
                        <TouchableOpacity
                            style={DP.aBtn}
                            onPress={() => router.push({
                                pathname: '/chat/[roomID]',
                                params: {
                                    roomID: getSupportRoomId(orderCreator || localOrder.createdBy),
                                    orderId: localOrder.id,
                                },
                            })}
                        >
                            <Ionicons name="chatbubble-outline" size={13} color="#2563EB" />
                            <Text style={DP.aBtnText}>Chat</Text>
                        </TouchableOpacity>
                    )}
                    {/* Sửa — admin hoặc người tạo đơn, trạng thái chưa khoá */}
                    {canEditOrder && (
                        <TouchableOpacity
                            style={DP.aBtn}
                            onPress={() => router.push({
                                pathname: '/editOrder/[orderID]',
                                params: {
                                    orderID: localOrder.id,
                                    orderParam: JSON.stringify(localOrder),
                                },
                            })}
                        >
                            {console.log('localOrder : ', JSON.stringify(localOrder))}
                            <Ionicons name="create-outline" size={13} color="#2563EB" />
                            <Text style={DP.aBtnText}>Sửa</Text>
                        </TouchableOpacity>
                    )}

                    {admin && (
                        <TouchableOpacity
                            style={[DP.aBtn, DP.aBtnDanger]}
                            onPress={handleDeleteOrder}
                            disabled={deleting}
                        >
                            {deleting
                                ? <ActivityIndicator size="small" color="#EF4444" style={{ width: 13 }} />
                                : <Ionicons name="trash-outline" size={13} color="#EF4444" />
                            }
                            <Text style={[DP.aBtnText, DP.aBtnDangerText]}>{deleting ? 'Đang xoá...' : 'Xoá đơn'}</Text>
                        </TouchableOpacity>
                    )}

                    {/* Status chip — measure để định vị modal menu */}
                    <View ref={chipRef} collapsable={false}>
                        {updating
                            ? <ActivityIndicator size="small" color="#2563EB" />
                            : <StatusChip
                                status={localOrder.status}
                                dropdown={canChangeStatus}
                                onPress={canChangeStatus ? openMenu : undefined}
                            />
                        }
                    </View>
                </View>
            </View>

            {/* ── Status dropdown — dùng Modal để vượt overflow ── */}
            {menuOpen && admin && (
                <Modal
                    transparent
                    statusBarTranslucent
                    animationType="none"
                    onRequestClose={() => setMenuOpen(false)}
                >
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        activeOpacity={1}
                        onPress={() => setMenuOpen(false)}
                    />
                    <StatusMenu
                        status={localOrder.status}
                        options={getStatusOptions(localOrder.orderType)}
                        onChange={handleStatusChange}
                        onClose={() => setMenuOpen(false)}
                        style={{ top: menuPos.top, right: menuPos.right }}
                    />
                </Modal>
            )}

            {/* ── Body ── */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>

                {/* 2-col: khách hàng + dịch vụ */}
                <View style={DP.infoGrid}>
                    <View style={[DP.infoCol, { borderRightWidth: 0.5, borderRightColor: '#F1F5F9' }]}>
                        <View style={DP.infoColLabel}>
                            <Ionicons name="person-circle-outline" size={13} color="#94A3B8" />
                            <Text style={DP.infoColLabelText}>Khách hàng</Text>
                        </View>
                        <View style={DP.infoRow2}>
                            <Ionicons name="person-outline" size={13} color="#94A3B8" />
                            <Text style={DP.infoVal}>{localOrder.customer}</Text>
                        </View>
                        {localOrder.address && (
                            <View style={DP.infoRow2}>
                                <Ionicons name="location-outline" size={13} color="#94A3B8" />
                                <Text style={DP.infoSub} numberOfLines={2}>{localOrder.address}</Text>
                            </View>
                        )}
                    </View>

                    <View style={DP.infoCol}>
                        <View style={DP.infoColLabel}>
                            <Ionicons name="construct-outline" size={13} color="#94A3B8" />
                            <Text style={DP.infoColLabelText}>Dịch vụ</Text>
                            {services.length > 0 && (
                                <View style={DP.svCountBadge}>
                                    <Text style={DP.svCountText}>{services.length}</Text>
                                </View>
                            )}
                        </View>
                        {svLoading
                            ? <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 8 }} />
                            : services.length === 0
                                ? <Text style={DP.noSv}>Chưa có dịch vụ</Text>
                                : services.map((sv, i) => {
                                    const c = scfg(sv.status);
                                    // Giá dịch vụ chỉ lộ ở màn chi tiết này — danh sách đơn,
                                    // báo cáo và hoa hồng đều không tính tới nó.
                                    const svQty = Number(sv.qty) || 1;
                                    const svLineTotal = sv.included ? 0 : (Number(sv.price) || 0) * svQty;
                                    return (
                                        <View key={sv.docId || i} style={DP.svRow}>
                                            <Ionicons name="construct-outline" size={13} color="#8B5CF6" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={DP.svId}>#{sv.id || sv.docId?.slice(-6)}</Text>
                                                <Text style={DP.svType}>
                                                    {sv.name || {
                                                        DELIVERY: 'Giao hàng',
                                                        INSTALLATION: 'Lắp đặt',
                                                        MAINTENANCE: 'Bảo dưỡng',
                                                        CONSULTING: 'Tư vấn',
                                                        giao_hang: 'Giao hàng',
                                                        lap_dat: 'Lắp đặt',
                                                        bao_duong: 'Bảo dưỡng',
                                                        tu_van: 'Tư vấn',
                                                    }[sv.type] || sv.type || 'Dịch vụ'}
                                                </Text>
                                                <Text style={DP.svPrice}>
                                                    x{svQty} · {sv.included ? 'Bao gồm' : fmtCurrency(svLineTotal)}
                                                </Text>
                                            </View>
                                            <View style={[DP.svStatus, { backgroundColor: c.bg }]}>
                                                <Text style={[DP.svStatusText, { color: c.c }]}>
                                                    {sv.status || 'Chờ xử lý'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })
                        }
                        {services.length > 0 && (
                            <TouchableOpacity style={{ marginTop: 6 }} onPress={() => router.replace("/(tabs)/service")}>
                                <Text style={DP.svLink}>Xem tất cả dịch vụ →</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Sản phẩm */}
                <View style={DP.section}>
                    <View style={DP.sectionHead}>
                        <View style={DP.sectionIcon}>
                            <Ionicons name="water-outline" size={13} color="#2563EB" />
                        </View>
                        <Text style={DP.sectionTitle}>Sản phẩm</Text>
                        <View style={DP.sectionBadge}>
                            <Text style={DP.sectionBadgeText}>{items.length}</Text>
                        </View>
                    </View>
                    {items.map((p, i) => {
                        const lt = PARSE(p.price) * PARSE(p.qty || 1);
                        return (
                            <View key={i} style={DP.prodRow}>
                                <View style={DP.prodIcon}>
                                    <Ionicons name="water-outline" size={14} color="#2563EB" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={DP.prodName}>{p.name}</Text>
                                    <Text style={DP.prodSub}>
                                        x{p.qty || 1} · {fmtCurrency(PARSE(p.price))}
                                    </Text>
                                </View>
                                <Text style={DP.prodTotal}>{fmtCurrency(lt)}</Text>
                            </View>
                        );
                    })}
                    {localOrder.note && (
                        <View style={DP.noteBox}>
                            <Text style={DP.noteText}>{localOrder.note}</Text>
                        </View>
                    )}
                </View>

                {/* Khối QR chuyển khoản — bật/tắt bằng SHOW_PAYMENT_QR ở đầu file.
                    Trước đây khối này bị comment nhưng effect buildQR vẫn chạy, tốn 1–2 lượt
                    đọc Firestore mỗi lần mở đơn để dựng một mã QR không bao giờ hiển thị. */}
                {SHOW_PAYMENT_QR && bankInfo && qrString && (
                    <View style={DP.qrSection}>
                        <View style={DP.qrHeader}>
                            <Ionicons name="qr-code-outline" size={18} color="#2563EB" />
                            <Text style={DP.qrTitle}>Thanh toán chuyển khoản</Text>
                        </View>
                        <View style={DP.qrBody}>
                            <View style={DP.qrCode}>
                                {Platform.OS === 'web' && QRCodeWeb ? (
                                    <QRCodeWeb value={qrString} size={140} />
                                ) : (
                                    <QRCode value={qrString} size={140} />
                                )}
                            </View>
                            <View style={DP.bankInfo}>
                                <Text style={DP.bankName}>{bankInfo.name}</Text>
                                <Text style={DP.accountNo}>STK: {bankInfo.accountNo}</Text>
                                <Text style={DP.accountName}>Chủ TK: {bankInfo.accountName}</Text>
                                <Text style={DP.amount}>Số tiền: {fmtCurrency(grandTotal)}</Text>
                                <Text style={DP.description}>Nội dung: TTDH {localOrder.id}</Text>
                            </View>
                        </View>
                        <Text style={DP.qrNote}>Quét mã QR bằng ứng dụng ngân hàng để thanh toán</Text>
                    </View>
                )}

                {/* Total bar — tách rõ doanh thu sản phẩm và tiền dịch vụ.
                    Mọi báo cáo/hoa hồng chỉ dùng `total`; dịch vụ chỉ cộng vào số thực thu. */}
                {servicesTotal > 0 ? (
                    <View style={DP.totalBox}>
                        <View style={DP.totalLine}>
                            <Text style={DP.totalLineLabel}>Tiền sản phẩm</Text>
                            <Text style={DP.totalLineValue}>{fmtCurrency(total)}</Text>
                        </View>
                        <View style={DP.totalLine}>
                            <Text style={DP.totalLineLabel}>Tiền dịch vụ</Text>
                            <Text style={DP.totalLineValue}>{fmtCurrency(servicesTotal)}</Text>
                        </View>
                        <View style={DP.totalBar}>
                            <Text style={DP.totalLabel}>Khách phải trả</Text>
                            <Text style={DP.totalValue}>{fmtCurrency(grandTotal)}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={DP.totalBar}>
                        <Text style={DP.totalLabel}>Tổng cộng</Text>
                        <Text style={DP.totalValue}>{fmtCurrency(total)}</Text>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View >
    );
}

const DP = StyleSheet.create({
    root: { width: 360, backgroundColor: '#fff', borderLeftWidth: 0.5, borderLeftColor: '#E2E8F0', borderRadius: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 12 : 0, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 },
    header: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 6 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    date: { fontSize: 11, color: '#94A3B8' },
    closeBtn: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    typePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    typePillText: { fontSize: 10, fontWeight: '700' },
    paymentDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    paymentDateText: { fontSize: 11, fontWeight: '600', color: '#16A34A' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4 },
    aBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
    aBtnText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
    aBtnDanger: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
    aBtnDangerText: { color: '#EF4444' },
    infoGrid: { flexDirection: 'row', paddingVertical: 14 },
    infoCol: { flex: 1, paddingHorizontal: 14, gap: 6 },
    infoColLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    infoColLabelText: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.06 },
    infoRow2: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    infoVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
    infoSub: { fontSize: 11, color: '#64748B', lineHeight: 16, flex: 1 },
    svCountBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
    svCountText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    noSv: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
    svRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: '#F8FAFC' },
    svId: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
    svType: { fontSize: 11, color: '#64748B' },
    svPrice: { fontSize: 11, color: '#8B5CF6', fontWeight: '700', marginTop: 1 },
    svStatus: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    svStatusText: { fontSize: 10, fontWeight: '700' },
    svLink: { fontSize: 12, color: '#2563EB', fontWeight: '600' },
    section: { paddingHorizontal: 16, paddingVertical: 12 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
    sectionIcon: { width: 22, height: 22, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 1 },
    sectionBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
    sectionBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    prodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 0.5, borderTopColor: '#F8FAFC' },
    prodIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    prodName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
    prodSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    prodTotal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    noteBox: { marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 0.5, borderColor: '#E2E8F0' },
    noteText: { fontSize: 12, color: '#64748B', lineHeight: 17 },
    totalBox: { marginTop: 4 },
    totalLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, paddingVertical: 5 },
    totalLineLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    totalLineValue: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
    totalBar: { margin: 16, borderRadius: 12, backgroundColor: '#1E3A5F', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18 },
    totalLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
    totalValue: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
    qrSection: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    qrTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    qrBody: { flexDirection: Platform.OS === 'web' && Dimensions.get('window').width >= 768 ? 'row' : 'column', alignItems: 'center', gap: 16 },
    qrCode: { backgroundColor: '#fff', padding: 8, borderRadius: 12, alignSelf: 'center' },
    bankInfo: { flex: 1, gap: 4 },
    bankName: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },
    accountNo: { fontSize: 13, color: '#334155' },
    accountName: { fontSize: 13, color: '#334155' },
    amount: { fontSize: 14, fontWeight: '700', color: '#2563EB', marginTop: 4 },
    description: { fontSize: 12, color: '#64748B' },
    qrNote: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 12 },
});
