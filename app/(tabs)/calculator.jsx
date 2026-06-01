// app/(tabs)/calculator.jsx — Màn Tính toán

import TabScreenLayout from '@/components/Main/TabScreenLayout';
import { getPriceField, getRole, getRoleLabel } from '@/components/Utils/roleHelper';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { useContext, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, Modal,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';
import { db } from '../../config/firebaseConfig';

import { useLayout } from '@/components/Main/TabScreenLayout';
const { isDesktop } = useLayout();
const isAdmin = r => r === 'admin';

const fmtVND = n => (n || 0).toLocaleString('vi-VN');
const parseNum = s => parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0;

const ROLE_LABEL_MAP = {
    admin: { label: 'Giá ưu đãi', field: 'price' },
    daily: { label: 'Giá ưu đãi', field: 'price_a' },
    phantan: { label: 'Giá ưu đãi', field: 'price_p' },
    ctv: { label: 'Giá ưu đãi', field: 'price_c' },
    other: { label: 'Giá ưu đãi', field: 'price' },
};

// ── Product picker modal ─────────────────────────────────────
function ProductPicker({ visible, products, onSelect, onClose }) {
    const [search, setSearch] = useState('');
    const filtered = products.filter(p =>
        (p.name || '').toLowerCase().includes(search.toLowerCase())
    );
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={PK.overlay}>
                <View style={PK.modal}>
                    <View style={PK.header}>
                        <Text style={PK.title}>Chọn mặt hàng</Text>
                        <TouchableOpacity onPress={onClose} style={PK.closeBtn}>
                            <Ionicons name="close" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    <View style={PK.searchWrap}>
                        <Ionicons name="search-outline" size={15} color="#94A3B8" />
                        <TextInput style={PK.searchInput} value={search} onChangeText={setSearch}
                            placeholder="Tìm tên sản phẩm..." placeholderTextColor="#CBD5E1" />
                    </View>
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, i) => item.docId || String(i)}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={PK.item} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.75}>
                                <View style={PK.itemIcon}>
                                    <Ionicons name="water-outline" size={18} color="#2563EB" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={PK.itemName}>{item.name}</Text>
                                    {item.capacity && <Text style={PK.itemSub}>{item.capacity}</Text>}
                                </View>
                                <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ paddingBottom: 32 }}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </Modal>
    );
}
const PK = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    title: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    closeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: '#F8FAFC' },
    itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    itemSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});

// ── Row item ─────────────────────────────────────────────────
function CalcRow({ item, index, priceField, role, onChange, onRemove }) {
    const admin = isAdmin(role);

    const baseListPrice = parseNum(item.listPrice);  // giá niêm yết (editable, chỉ để tham khảo)
    const baseSellPrice = parseNum(item.sellPrice);  // giá ưu đãi theo vai trò
    const qty = parseNum(item.qty) || 1;
    const discount = parseNum(item.discount);   // hoa hồng %

    // thành tiền = giá ưu đãi × (1 - hoa hồng%)
    const sellAfterDisc = discount > 0
        ? baseSellPrice * (1 - discount / 100)
        : baseSellPrice;

    // hoa hồng = (niêm yết - ưu đãi × (1 - CK%)) × SL  →  mặc định = niêm yết - ưu đãi
    const commission = (baseListPrice - baseSellPrice * (1 - discount / 100)) * qty;
    const totalSell = sellAfterDisc * qty;
    const totalList = baseListPrice * qty;

    const isPositive = commission >= 0;

    return (
        <View style={[R.row, index % 2 === 1 && { backgroundColor: '#FAFBFF' }]}>
            {/* Tên mặt hàng */}
            <View style={[R.cell, { flex: 2 }]}>
                <Text style={R.productName} numberOfLines={2}>{item.name || '—'}</Text>
                {item.capacity && <Text style={R.productSub}>{item.capacity}</Text>}
            </View>

            {/* Số lượng */}
            <View style={[R.cell, { width: 70 }]}>
                <TextInput
                    style={R.numInput}
                    value={String(item.qty || 1)}
                    onChangeText={v => onChange(index, 'qty', v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                />
            </View>

            {/* Giá niêm yết (editable) */}
            <View style={[R.cell, { flex: 1.4 }]}>
                <TextInput
                    style={[R.numInput, { textAlign: 'right' }]}
                    value={fmtVND(parseNum(item.listPrice))}
                    onChangeText={v => onChange(index, 'listPrice', v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                />
            </View>

            {/* Giá bán vai trò (chỉ admin sửa) */}
            <View style={[R.cell, { flex: 1.4 }]}>
                {admin ? (
                    <TextInput
                        style={[R.numInput, { textAlign: 'right', color: '#7C3AED' }]}
                        value={fmtVND(parseNum(item.sellPrice))}
                        onChangeText={v => onChange(index, 'sellPrice', v)}
                        keyboardType="numeric"
                        selectTextOnFocus
                    />
                ) : (
                    <Text style={[R.readOnly, { color: '#7C3AED' }]}>{fmtVND(baseSellPrice)}</Text>
                )}
            </View>

            {/* Chiết khấu % */}
            <View style={[R.cell, { flex: 1.1, alignItems: 'flex-end' }]}>
                <View style={R.discountWrap}>
                    <TextInput
                        style={R.discountInput}
                        value={item.discount || ''}
                        onChangeText={v => onChange(index, 'discount', v)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#CBD5E1"
                        selectTextOnFocus
                    />
                    <Text style={R.discountPct}>%</Text>
                </View>
            </View>

            {/* Hoa hồng */}
            <View style={[R.cell, { flex: 1.3 }]}>
                <Text style={[R.commValue, { color: isPositive ? '#059669' : '#EF4444' }]}>
                    {isPositive ? '+' : ''}{fmtVND(commission)}
                </Text>
                {/* <Text style={R.commSub}>= (NL - BH) × SL</Text> */}
            </View>

            {/* Thành tiền */}
            <View style={[R.cell, { flex: 1.4 }]}>
                <Text style={R.totalSell}>{fmtVND(totalSell)}</Text>
                {discount > 0 && (
                    <Text style={R.totalList}>{fmtVND(totalList)}</Text>
                )}
            </View>

            {/* Xóa */}
            <TouchableOpacity style={R.removeBtn} onPress={() => onRemove(index)}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );
}

const R = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9', gap: 8 },
    cell: { justifyContent: 'center' },
    productName: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
    productSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
    numInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: '#0F172A', textAlign: 'center', ...(isDesktop ? { outlineStyle: 'none' } : {}) },
    readOnly: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
    discountWrap: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, gap: 4, width: 80 },
    discountInput: { width: 44, fontSize: 13, color: '#D97706', textAlign: 'right', ...(isDesktop ? { outlineStyle: 'none' } : {}) },
    discountPct: { fontSize: 12, color: '#D97706', fontWeight: '700', width: 14 },
    commValue: { fontSize: 13, fontWeight: '800', textAlign: 'right' },
    commSub: { fontSize: 9, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
    totalSell: { fontSize: 13, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
    totalList: { fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through', textAlign: 'right', marginTop: 2 },
    removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

// ── Main ─────────────────────────────────────────────────────
export default function CalculatorScreen() {
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const priceField = getPriceField(role);
    const admin = isAdmin(role);
    const roleInfo = ROLE_LABEL_MAP[role] || ROLE_LABEL_MAP.other;

    const [products, setProducts] = useState([]);
    const [loadingProd, setLoadingProd] = useState(true);
    const [items, setItems] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);

    // Fetch products
    useEffect(() => {
        getDocs(collection(db, 'productPrice'))
            .then(snap => setProducts(
                snap.docs.map(d => ({ ...d.data(), docId: d.id }))
                    .sort((a, b) => (a.id || 0) - (b.id || 0))
            ))
            .catch(console.error)
            .finally(() => setLoadingProd(false));
    }, []);

    // Thêm sản phẩm vào danh sách
    const handleSelectProduct = (product) => {
        const listPrice = parseNum(product.price) || 0;
        const sellPrice = parseNum(product[priceField]) || listPrice;
        setItems(prev => [...prev, {
            name: product.name || '',
            capacity: product.capacity || '',
            qty: '1',
            listPrice: String(listPrice),
            sellPrice: String(sellPrice),
            discount: '',
            productRef: product,
        }]);
    };

    // Cập nhật field của row
    const handleChange = (index, field, value) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            const updated = { ...item, [field]: value }; m
            return updated;
        }));
    };

    const handleRemove = (index) => setItems(prev => prev.filter((_, i) => i !== index));
    const handleClear = () => setItems([]);

    // Tổng kết
    const totals = useMemo(() => {
        return items.reduce((acc, item) => {
            const list = parseNum(item.listPrice);
            const sell = parseNum(item.sellPrice);  // giá ưu đãi
            const disc = parseNum(item.discount);   // hoa hồng %
            const qty = parseNum(item.qty) || 1;
            const sellAfterDisc = disc > 0 ? (sell * (1 - disc / 100)) : sell;
            acc.totalList += list * qty;
            acc.totalSell += sellAfterDisc * qty;
            acc.totalComm += (list - (sell * (1 - disc / 100))) * qty;
            acc.totalQty += qty;
            return acc;
        }, { totalList: 0, totalSell: 0, totalComm: 0, totalQty: 0 });
    }, [items]);

    const TABLE_HEADERS = [
        { label: 'Tên mặt hàng', flex: 2, align: 'left' },
        { label: 'SL', width: 70, align: 'center' },
        { label: 'Giá niêm yết', flex: 1.4, align: 'right' },
        { label: roleInfo.label, flex: 1.4, align: 'right' },  // Giá bán theo role
        { label: 'Chiết khấu %', flex: 1.1, align: 'right' },
        { label: 'Hoa hồng', flex: 1.3, align: 'right' },
        { label: 'Thành tiền', flex: 1.4, align: 'right' },
        { label: '', width: 36, align: 'center' },
    ];

    return (
        <TabScreenLayout>
            <View style={S.root}>

                {/* ── Header bar ── */}
                <View style={S.topBar}>
                    <View>
                        <Text style={S.pageTitle}>Bảng tính toán</Text>
                        <Text style={S.pageSub}>
                            Vai trò: <Text style={{ color: '#2563EB', fontWeight: '700' }}>{getRoleLabel(role)}</Text>
                            {' · '}Giá bán: <Text style={{ color: '#7C3AED', fontWeight: '700' }}>{roleInfo.label}</Text>
                        </Text>
                    </View>
                    <View style={S.topActions}>
                        {items.length > 0 && (
                            <TouchableOpacity style={S.clearBtn} onPress={handleClear}>
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                <Text style={S.clearBtnText}>Xóa tất cả</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={S.addBtn}
                            onPress={() => setPickerOpen(true)}
                            disabled={loadingProd}>
                            {loadingProd
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <><Ionicons name="add" size={16} color="#fff" /><Text style={S.addBtnText}>Thêm mặt hàng</Text></>
                            }
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Legend ── */}
                <View style={S.legend}>
                    <View style={S.legendItem}>
                        <View style={[S.legendDot, { backgroundColor: '#64748B' }]} />
                        <Text style={S.legendText}>NL = Giá niêm yết</Text>
                    </View>
                    <View style={S.legendItem}>
                        <View style={[S.legendDot, { backgroundColor: '#7C3AED' }]} />
                        <Text style={S.legendText}>BH = {roleInfo.label}</Text>
                    </View>
                    <View style={S.legendItem}>
                        <View style={[S.legendDot, { backgroundColor: '#059669' }]} />
                        <Text style={S.legendText}>HH = ( NL - ( BH × (1 - CK%) ) ) × SL</Text>
                    </View>
                    <View style={S.legendItem}>
                        <View style={[S.legendDot, { backgroundColor: '#D97706' }]} />
                        <Text style={S.legendText}>Thành tiền = BH × (1 − CK%)</Text>
                    </View>
                </View>

                {/* ── Table ── */}
                <View style={S.tableWrap}>
                    {/* Table header */}
                    <View style={S.tableHead}>
                        <View style={S.thRow}>
                            {TABLE_HEADERS.map((h, i) => (
                                <Text key={i}
                                    style={[
                                        S.th,
                                        h.flex ? { flex: h.flex } : { width: h.width },
                                        h.align === 'right' && { textAlign: 'right' },
                                        h.align === 'center' && { textAlign: 'center' },
                                    ]}
                                    numberOfLines={1}>
                                    {h.label}
                                </Text>
                            ))}
                        </View>
                    </View>

                    {/* Empty state */}
                    {items.length === 0 ? (
                        <View style={S.empty}>
                            <View style={S.emptyIcon}>
                                <Ionicons name="calculator-outline" size={40} color="#CBD5E1" />
                            </View>
                            <Text style={S.emptyTitle}>Chưa có mặt hàng</Text>
                            <Text style={S.emptySub}>Bấm "Thêm mặt hàng" để bắt đầu tính toán</Text>
                            <TouchableOpacity style={S.emptyBtn} onPress={() => setPickerOpen(true)}>
                                <Ionicons name="add-circle-outline" size={16} color="#2563EB" />
                                <Text style={S.emptyBtnText}>Thêm mặt hàng</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            {items.map((item, index) => (
                                <CalcRow
                                    key={index}
                                    item={item}
                                    index={index}
                                    priceField={priceField}
                                    role={role}
                                    onChange={handleChange}
                                    onRemove={handleRemove}
                                />
                            ))}

                            {/* Subtotal row */}
                            <View style={S.subtotalRow}>
                                <Text style={[S.subtotalLabel, { flex: 2 }]}>
                                    Tổng cộng ({totals.totalQty} sản phẩm)
                                </Text>
                                <View style={{ width: 70 }} />
                                <Text style={[S.subtotalValue, { flex: 1.4, textAlign: 'right', color: '#64748B' }]}>
                                    {fmtVND(totals.totalList)}
                                </Text>
                                <Text style={[S.subtotalValue, { flex: 1.4, textAlign: 'right', color: '#7C3AED' }]}>
                                    {fmtVND(totals.totalSell)}
                                </Text>
                                <View style={{ flex: 1.1 }} />
                                <Text style={[S.subtotalValue, { flex: 1.3, textAlign: 'right', color: totals.totalComm >= 0 ? '#059669' : '#EF4444' }]}>
                                    {fmtVND(totals.totalComm)}
                                </Text>
                                <Text style={[S.subtotalValue, { flex: 1.4, textAlign: 'right', color: '#0F172A' }]}>
                                    {fmtVND(totals.totalSell)}
                                </Text>
                                <View style={{ width: 36 }} />
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* ── Summary bottom bar ── */}
                {items.length > 0 && (
                    <View style={S.summaryBar}>
                        <View style={S.summaryItem}>
                            <Text style={S.summaryLabel}>Tổng niêm yết</Text>
                            <Text style={S.summaryValue}>{fmtVND(totals.totalList)} đ</Text>
                        </View>
                        <View style={S.summaryDivider} />
                        <View style={S.summaryItem}>
                            <Text style={S.summaryLabel}>{roleInfo.label} tổng</Text>
                            <Text style={[S.summaryValue, { color: '#7C3AED' }]}>{fmtVND(totals.totalSell)} đ</Text>
                        </View>
                        <View style={S.summaryDivider} />
                        <View style={S.summaryItem}>
                            <Text style={S.summaryLabel}>Hoa hồng</Text>
                            <Text style={[S.summaryValue, { color: totals.totalComm >= 0 ? '#059669' : '#EF4444' }]}>
                                {fmtVND(totals.totalComm)} đ
                            </Text>
                        </View>
                        <View style={S.summaryDivider} />
                        <View style={[S.summaryItem, { flex: 1.5 }]}>
                            <Text style={S.summaryLabel}>Doanh thu dự kiến</Text>
                            <Text style={[S.summaryValue, { fontSize: 20, color: '#1E3A8A' }]}>
                                {fmtVND(totals.totalSell)} đ
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── Product picker ── */}
                <ProductPicker
                    visible={pickerOpen}
                    products={products}
                    onSelect={handleSelectProduct}
                    onClose={() => setPickerOpen(false)}
                />
            </View>
        </TabScreenLayout>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC', flexDirection: 'column' },
    // Top bar
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isDesktop ? 32 : 16, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexWrap: 'wrap', gap: 12 },
    pageTitle: { fontSize: isDesktop ? 24 : 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },
    pageSub: { fontSize: 12, color: '#64748B', marginTop: 3 },
    topActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
    clearBtnText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2563EB' },
    addBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    // Legend
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: isDesktop ? 32 : 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
    // Table
    tableWrap: { flex: 1, backgroundColor: '#fff', margin: isDesktop ? 16 : 0, marginBottom: 0, borderRadius: isDesktop ? 14 : 0, borderWidth: isDesktop ? 1 : 0, borderColor: '#E2E8F0', overflow: 'hidden' },
    tableHead: { backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    thRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    th: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.04 },
    // Subtotal
    subtotalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F0F7FF', borderTopWidth: 1.5, borderTopColor: '#BFDBFE', gap: 8 },
    subtotalLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    subtotalValue: { fontSize: 13, fontWeight: '800' },
    // Empty
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
    emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', marginTop: 4 },
    emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
    // Summary bar
    summaryBar: { flexDirection: isDesktop ? 'row' : 'column', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: isDesktop ? 32 : 20, paddingVertical: 16, gap: isDesktop ? 0 : 12, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, elevation: 8 },
    summaryItem: { flex: 1, alignItems: isDesktop ? 'center' : 'flex-start' },
    summaryDivider: { width: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },
    summaryLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.06, marginBottom: 4 },
    summaryValue: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4 },
});