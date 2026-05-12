import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import {
    ActivityIndicator, FlatList, Image, Platform,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { db } from '../../config/firebaseConfig';

const isWeb = Platform.OS === 'web';
const BG_IMAGE = require('../../assets/images/logo-light.png')

// ── Role helpers ─────────────────────────────────────────────
const getRole = (u) => {
    const r = (u?.role || u?.member || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (['đại lý', 'daily', 'dealer'].includes(r)) return 'daily';
    if (['đối tác', 'phantan', 'distributor'].includes(r)) return 'phantan';
    if (['cộng tác viên', 'ctv', 'collaborator'].includes(r)) return 'ctv';
    return 'other';
};

const PRICE_LABELS = {
    price: { label: 'Giá niêm yết', color: '#64748B', bg: '#F1F5F9' },
    price_a: { label: 'Giá đại lý', color: '#2563EB', bg: '#EFF6FF' },
    price_p: { label: 'Giá đối tác', color: '#7C3AED', bg: '#F5F3FF' },
    price_c: { label: 'Giá CTV', color: '#059669', bg: '#ECFDF5' },
};

const getPriceFields = (role) => ({
    admin: ['price', 'price_a', 'price_p', 'price_c'],
    daily: ['price_a'],
    phantan: ['price_p'],
    ctv: ['price_c'],
}[role] || ['price']);

const fmt = (n) => (n || 0).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

// ── Service category color palette (cycles if more than 6 items) ──
const CATEGORY_COLORS = [
    { color: '#EC4899', bg: '#FDF2F8', icon: 'chatbubbles-outline' },   // Tư vấn
    { color: '#8B5CF6', bg: '#F5F3FF', icon: 'build-outline' },          // Lắp đặt
    { color: '#F59E0B', bg: '#FFFBEB', icon: 'construct-outline' },      // Bảo dưỡng
    { color: '#3B82F6', bg: '#EFF6FF', icon: 'water-outline' },          // Đổ muối
    { color: '#10B981', bg: '#ECFDF5', icon: 'car-outline' },            // Giao hàng
    { color: '#EF4444', bg: '#FEF2F2', icon: 'flash-outline' },          // fallback
];

const getCategoryStyle = (index) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];

// ── Product Detail Panel ──────────────────────────────────────
function ProductDetail({ product, priceFields, onClose }) {
    const specs = [
        { label: 'Nguồn nước xử lý', value: product.water_source },
        { label: 'Tiêu chuẩn nước', value: product.water_certificate },
        { label: 'Xuất xứ', value: product.made_in },
        { label: 'Công suất lọc', value: product.capacity },
        { label: 'Công nghệ', value: product.technology },
        { label: 'Hệ thống điều khiển', value: product.control_system },
        { label: 'Hệ thống giám sát', value: product.monitoring_system },
        { label: 'Điện áp', value: product.electric_requirement },
        { label: 'Công suất (lọc)', value: product.using_electric_capacity },
        { label: 'Công suất (nghỉ)', value: product.electric_capacity },
        { label: 'Công nghệ màng', value: product.sorting_tech },
        { label: 'Vật liệu màng', value: product.pipe_material },
        { label: 'Xuất xứ màng', value: product.pipe_original },
        { label: 'Đường kính ống v/r', value: product.pipe_diameter },
        { label: 'Đường kính ống thải', value: product.drain_pipe_diameter },
        { label: 'Lượng nước thải', value: product.drain_water },
        { label: 'Kích thước', value: product.dimension },
        { label: 'Màu sắc', value: product.color },
        { label: 'Trọng lượng', value: product.weight },
        { label: 'Tuổi thọ', value: product.life_style },
        { label: 'Bảo hành', value: product.guarantee },
        { label: 'Vị trí lắp đặt', value: product.recommend_location },
    ].filter(s => s.value);

    const features = [
        { key: 'has_music', label: 'Tích hợp M.U.S.I.C' },
        { key: 'has_filter_regen', label: 'Tái sinh màng lọc C.I.P' },
        { key: 'auto_detect', label: 'Tự động phát hiện & sửa lỗi' },
        { key: 'auto_trigger', label: 'Hoạt động theo kích bản' },
        { key: 'has_bypass', label: 'Tự động Bypass' },
        { key: 'realtime_monitoring', label: 'Giám sát chất lượng nước TG thực' },
        { key: 'smarthome_connect', label: 'Kết nối SmartHome / HMS' },
    ].filter(f => product[f.key]);

    return (
        <ScrollView style={D.root} contentContainerStyle={D.content} showsVerticalScrollIndicator={false}>
            <View style={D.header}>
                <TouchableOpacity onPress={onClose} style={D.backBtn}>
                    <Ionicons name="arrow-back" size={18} color="#64748B" />
                    <Text style={D.backText}>Quay lại</Text>
                </TouchableOpacity>
            </View>
            <View style={D.titleRow}>
                <View style={D.productIcon}><Ionicons name="water-outline" size={28} color="#2563EB" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={D.productName}>{product.name}</Text>
                    <Text style={D.productSub}>ID: {product.id} · {product.capacity}</Text>
                </View>
            </View>

            <View style={D.card}>
                <View style={D.cardHeader}><Ionicons name="pricetag-outline" size={15} color="#2563EB" /><Text style={D.cardTitle}>Bảng giá</Text></View>
                <View style={D.priceGrid}>
                    {priceFields.map(field => {
                        const cfg = PRICE_LABELS[field];
                        return (
                            <View key={field} style={[D.priceCard, { backgroundColor: cfg.bg }]}>
                                <Text style={[D.priceLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                <Text style={[D.priceValue, { color: cfg.color }]}>{fmt(product[field])}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            <View style={D.card}>
                <View style={D.cardHeader}><Ionicons name="list-outline" size={15} color="#2563EB" /><Text style={D.cardTitle}>Thông số kỹ thuật</Text></View>
                {specs.map((s, i) => (
                    <View key={i} style={[D.specRow, i % 2 === 0 && D.specRowAlt]}>
                        <Text style={D.specLabel}>{s.label}</Text>
                        <Text style={D.specValue}>{s.value}</Text>
                    </View>
                ))}
            </View>

            {features.length > 0 && (
                <View style={D.card}>
                    <View style={D.cardHeader}><Ionicons name="star-outline" size={15} color="#2563EB" /><Text style={D.cardTitle}>Tính năng đặc biệt</Text></View>
                    <View style={D.featureGrid}>
                        {features.map(f => (
                            <View key={f.key} style={D.featureItem}>
                                <View style={D.featureCheck}><Ionicons name="checkmark" size={12} color="#059669" /></View>
                                <Text style={D.featureText}>{f.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            <View style={{ height: 32 }} />
        </ScrollView>
    );
}

// ── Product List ──────────────────────────────────────────────
function ProductList({ products, priceFields, onSelect }) {
    return (
        <FlatList
            data={products}
            keyExtractor={item => String(item.id)}
            numColumns={isWeb ? 3 : 1}
            key={isWeb ? 'grid' : 'list'}
            columnWrapperStyle={isWeb ? { gap: 14 } : undefined}
            contentContainerStyle={[{ paddingBottom: isWeb ? 32 : 100 }, isWeb && { gap: 14 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
                <TouchableOpacity style={[L.card, isWeb && { flex: 1 }]} activeOpacity={0.7} onPress={() => onSelect(item)}>
                    <View style={L.cardTop}>
                        <View style={L.productIcon}><Ionicons name="water-outline" size={20} color="#2563EB" /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={L.productName}>{item.name}</Text>
                            <Text style={L.productCapacity}>{item.capacity}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                    </View>
                    {item.technology && <View style={L.techBadge}><Text style={L.techBadgeText}>{item.technology}</Text></View>}
                    <View style={L.priceRow}>
                        {priceFields.slice(0, 2).map(field => {
                            const cfg = PRICE_LABELS[field];
                            return (
                                <View key={field} style={[L.pricePill, { backgroundColor: cfg.bg }]}>
                                    <Text style={[L.pricePillLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                    <Text style={[L.pricePillValue, { color: cfg.color }]}>{fmt(item[field])}</Text>
                                </View>
                            );
                        })}
                    </View>
                    {priceFields.length > 2 && (
                        <View style={[L.priceRow, { marginTop: 6 }]}>
                            {priceFields.slice(2).map(field => {
                                const cfg = PRICE_LABELS[field];
                                return (
                                    <View key={field} style={[L.pricePill, { backgroundColor: cfg.bg }]}>
                                        <Text style={[L.pricePillLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                        <Text style={[L.pricePillValue, { color: cfg.color }]}>{fmt(item[field])}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={L.empty}><Ionicons name="cube-outline" size={40} color="#CBD5E1" /><Text style={L.emptyText}>Chưa có sản phẩm</Text></View>}
        />
    );
}

// ── Service Category Grid ─────────────────────────────────────
function ServiceCategoryGrid({ services }) {
    if (services.length === 0) return (
        <View style={L.empty}>
            <Ionicons name="construct-outline" size={40} color="#CBD5E1" />
            <Text style={L.emptyText}>Chưa có dịch vụ nào</Text>
        </View>
    );

    return (
        <FlatList
            data={services}
            keyExtractor={item => String(item.id || item.docId)}
            numColumns={isWeb ? 3 : 2}
            key={isWeb ? 'svc-grid-web' : 'svc-grid-mobile'}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
                const style = getCategoryStyle(index);
                return (
                    <View style={[SC.card, { flex: 1, borderTopColor: style.color, backgroundColor: '#FFFFFF' }]}>
                        <View style={[SC.iconWrap, { backgroundColor: style.bg }]}>
                            <Ionicons name={style.icon} size={28} color={style.color} />
                        </View>
                        <Text style={[SC.categoryName, { color: '#0F172A' }]}>{item.name}</Text>
                        <View style={[SC.priceBadge, { backgroundColor: style.bg }]}>
                            <Text style={[SC.priceLabel, { color: style.color }]}>Giá dịch vụ</Text>
                            <Text style={[SC.priceValue, { color: style.color }]}>{fmt(item.price)}</Text>
                        </View>
                    </View>
                );
            }}
        />
    );
}

// ── Main Screen ───────────────────────────────────────────────
export default function InformationScreen() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const priceFields = getPriceFields(role);

    const [activeTab, setActiveTab] = useState('products');
    const [products, setProducts] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingServices, setLoadingServices] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Fetch products
    useEffect(() => {
        getDocs(collection(db, 'productPrice'))
            .then(snap => setProducts(snap.docs.map(d => ({ ...d.data(), docId: d.id })).sort((a, b) => (a.id || 0) - (b.id || 0))))
            .catch(console.error)
            .finally(() => setLoadingProducts(false));
    }, []);

    // Fetch services (danh mục giá dịch vụ)
    useEffect(() => {
        getDocs(collection(db, 'servicePrice'))
            .then(snap => setServices(snap.docs.map(d => ({ ...d.data(), docId: d.id })).sort((a, b) => (a.id || 0) - (b.id || 0))))
            .catch(console.error)
            .finally(() => setLoadingServices(false));
    }, []);

    const handleTabChange = (key) => {
        setActiveTab(key);
        setSelectedProduct(null);
    };

    return (
        <View style={S.root}>

            {/* ✅ Watermark — cố định chính giữa, mờ nhạt */}
            <Image
                source={BG_IMAGE}
                style={S.watermark}
                resizeMode="contain"
            />
            <View style={S.container}>
                {/* Header */}
                <View style={S.header}>

                    <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={S.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.TextPrimary} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                        <Text style={S.headerTitle}>Thông tin</Text>
                        <View style={S.roleBadge}>
                            <Text style={S.roleBadgeText}>
                                {{ admin: '👑 Quản trị viên', daily: '🏪 Đại lý', phantan: '🚚 đối tác', ctv: '🤝 Cộng tác viên' }[role] || ''}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Tabs */}
                <View style={S.tabBar}>
                    {[
                        { key: 'products', label: 'Sản phẩm', icon: 'cube-outline' },
                        { key: 'services', label: 'Dịch vụ', icon: 'construct-outline' },
                    ].map(tab => (
                        <TouchableOpacity key={tab.key} style={[S.tab, activeTab === tab.key && S.tabActive]} onPress={() => handleTabChange(tab.key)}>
                            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#2563EB' : '#94A3B8'} />
                            <Text style={[S.tabText, activeTab === tab.key && S.tabTextActive]}>{tab.label}</Text>
                            {tab.key === 'services' && services.length > 0 && (
                                <View style={S.tabBadge}><Text style={S.tabBadgeText}>{services.length}</Text></View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Content */}
                <View style={S.content}>

                    {/* ── Products ── */}
                    {activeTab === 'products' && (
                        selectedProduct ? (
                            <ProductDetail product={selectedProduct} priceFields={priceFields} onClose={() => setSelectedProduct(null)} />
                        ) : (
                            <View style={S.listContainer}>
                                {loadingProducts ? (
                                    <View style={S.loadingWrap}><ActivityIndicator size="large" color="#2563EB" /><Text style={S.loadingText}>Đang tải sản phẩm...</Text></View>
                                ) : (
                                    <>
                                        <View style={S.listHeader}>
                                            <Text style={S.listCount}>{products.length} sản phẩm</Text>
                                        </View>
                                        <ProductList products={products} priceFields={priceFields} onSelect={setSelectedProduct} />
                                    </>
                                )}
                            </View>
                        )
                    )}

                    {/* ── Services ── */}
                    {activeTab === 'services' && (
                        <View style={S.listContainer}>
                            {loadingServices ? (
                                <View style={S.loadingWrap}><ActivityIndicator size="large" color="#2563EB" /><Text style={S.loadingText}>Đang tải dịch vụ...</Text></View>
                            ) : (
                                <>
                                    <View style={S.listHeader}>
                                        <Text style={S.listCount}>{services.length} danh mục dịch vụ</Text>
                                    </View>
                                    <ServiceCategoryGrid services={services} />
                                </>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#F8FAFC",
    },
    watermark: {
        position: "absolute",
        width: "80%",           // ← to nhỏ tuỳ ý
        height: "60%",          // ← cao thấp tuỳ ý
        top: "20%",             // ← căn giữa dọc
        left: "10%",            // ← căn giữa ngang
        opacity: 0.05,          // ← 0.05 rất mờ / 0.15 rõ hơn
    },
    container: { flex: 1, backgroundColor: 'transparent', paddingTop: isWeb ? 0 : 44 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: isWeb ? 32 : 16, paddingVertical: isWeb ? 20 : 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
    headerTitle: { fontSize: isWeb ? 22 : 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    roleBadge: { marginTop: 2 },
    roleBadgeText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
    tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: isWeb ? 32 : 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 4 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#2563EB' },
    tabText: { fontSize: 14, fontWeight: '500', color: '#94A3B8' },
    tabTextActive: { color: '#2563EB', fontWeight: '700' },
    tabBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
    content: { flex: 1 },
    listContainer: { flex: 1, paddingHorizontal: isWeb ? 32 : 16, paddingTop: 16 },
    listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    listCount: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
    loadingText: { fontSize: 14, color: '#94A3B8' },
});

const L = StyleSheet.create({
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    productIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
    productCapacity: { fontSize: 12, color: '#64748B' },
    techBadge: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 10 },
    techBadgeText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
    priceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    pricePill: { flex: 1, minWidth: 120, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
    pricePillLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
    pricePillValue: { fontSize: 13, fontWeight: '800' },
    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 14, color: '#94A3B8' },
});

// ── Service Category Card Styles ──────────────────────────────
const SC = StyleSheet.create({
    card: {
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderTopWidth: 3,
        alignItems: 'center',
        gap: 10,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    priceBadge: {
        width: '100%',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 2,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
});

const D = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: 16 },
    header: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: 16, paddingBottom: 8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    backText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: isWeb ? 32 : 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 16 },
    productIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
    productName: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
    productSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: isWeb ? 20 : 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14, marginHorizontal: isWeb ? 32 : 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    priceCard: { flex: 1, minWidth: isWeb ? 160 : 140, padding: 14, borderRadius: 10 },
    priceLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    priceValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    specRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
    specRowAlt: { backgroundColor: '#F8FAFC', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 4 },
    specLabel: { width: isWeb ? 200 : 140, fontSize: 12, color: '#64748B', fontWeight: '500' },
    specValue: { flex: 1, fontSize: 12, color: '#0F172A', fontWeight: '600' },
    featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    featureCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
    featureText: { fontSize: 12, color: '#059669', fontWeight: '600' },
});