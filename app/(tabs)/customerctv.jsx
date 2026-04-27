import Colors from "@/constant/Colors";
import { UserDetailContext } from "@/context/UserDetailContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useContext, useEffect, useState } from "react";
import {
    ActivityIndicator, FlatList, Image, Platform,
    RefreshControl, ScrollView, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from "react-native";
import { getRole, useCustomers } from "../../components/Hooks/useCustomers";
import { db } from "../../config/firebaseConfig";

const isWeb = Platform.OS === "web";
const BG_IMAGE = require('../../assets/images/logo-light.png');

function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).filter(n => n.length > 0)
        .map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

// ── Trạng thái tư vấn ─────────────────────────────────────────
const CONSULT_STATUS = {
    success: { label: "Thành công", color: "#059669", bg: "#ECFDF5", dot: "#059669" },
    failed: { label: "Thất bại", color: "#EF4444", bg: "#FEF2F2", dot: "#EF4444" },
    pending: { label: "Đang tư vấn", color: "#2563EB", bg: "#EFF6FF", dot: "#2563EB" },
    none: { label: "Chưa tư vấn", color: "#94A3B8", bg: "#F1F5F9", dot: "#CBD5E1" },
};

// ── CTV Dashboard ─────────────────────────────────────────────
function CTVDashboard({ customers, consultMap, loading, refreshing, onRefresh, onAddCustomer, onPressCustomer, search, setSearch }) {
    const total = customers.length;
    const consulted = customers.filter(c => consultMap[c.phone] && consultMap[c.phone] !== "none").length;
    const success = customers.filter(c => consultMap[c.phone] === "success").length;
    const failed = customers.filter(c => consultMap[c.phone] === "failed").length;

    const filtered = customers.filter(c =>
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").includes(search)
    );

    const STATS = [
        { label: "Tổng số khách hàng", value: total, icon: "people-outline", color: "#2563EB", bg: "#EFF6FF", trend: "+5%", trendUp: true },
        { label: "Khách hàng đã tư vấn", value: consulted, icon: "chatbubbles-outline", color: "#7C3AED", bg: "#F5F3FF", trend: null, trendUp: true },
        { label: "Tư vấn thành công", value: success, icon: "checkmark-circle-outline", color: "#059669", bg: "#ECFDF5", trend: null, trendUp: true },
        { label: "Tư vấn thất bại", value: failed, icon: "close-circle-outline", color: "#EF4444", bg: "#FEF2F2", trend: null, trendUp: false },
    ];

    const renderRow = ({ item, index }) => {
        const statusKey = consultMap[item.phone] || "none";
        const status = CONSULT_STATUS[statusKey];
        const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "—";
        return (
            <TouchableOpacity style={C.tableRow} onPress={() => onPressCustomer(item)} activeOpacity={0.7}>
                {/* Avatar + Name */}
                <View style={[C.tableCell, { flex: 2.5, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <View style={[C.rowAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                        <Text style={C.rowAvatarText}>{getInitials(item.name)}</Text>
                    </View>
                    <Text style={C.rowName} numberOfLines={1}>{item.name || "—"}</Text>
                </View>
                {/* Phone */}
                <View style={[C.tableCell, { flex: 1.5 }]}>
                    <Text style={C.rowPhone}>{item.phone || "—"}</Text>
                </View>
                {/* Date */}
                {isWeb && (
                    <View style={[C.tableCell, { flex: 1.2 }]}>
                        <Text style={C.rowDate}>{createdAt}</Text>
                    </View>
                )}
                {/* Status */}
                <View style={[C.tableCell, { flex: 1.5 }]}>
                    <View style={[C.statusChip, { backgroundColor: status.bg }]}>
                        <View style={[C.statusDot, { backgroundColor: status.dot }]} />
                        <Text style={[C.statusChipText, { color: status.color }]}>{status.label}</Text>
                    </View>
                </View>
                {/* Action */}
                <TouchableOpacity style={C.actionBtn} onPress={() => onPressCustomer(item)} activeOpacity={0.7}>
                    <Text style={C.actionBtnText}>Xem chi tiết</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* ── Header ── */}
            <View style={C.headerWrap}>
                <View>
                    <Text style={C.pageTitle}>Quản lý Khách hàng</Text>
                    <Text style={C.pageDesc}>Theo dõi và quản lý dữ liệu khách hàng của bạn.</Text>
                </View>
                <TouchableOpacity style={C.addBtn} onPress={onAddCustomer} activeOpacity={0.85}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={C.addBtnText}>+ Thêm Khách hàng</Text>
                </TouchableOpacity>
            </View>

            {/* ── Stat cards ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={C.statsScroll} contentContainerStyle={C.statsRow}>
                {STATS.map(s => (
                    <View key={s.label} style={C.statCard}>
                        <View style={C.statTop}>
                            <View style={[C.statIconWrap, { backgroundColor: s.bg }]}>
                                <Ionicons name={s.icon} size={22} color={s.color} />
                            </View>
                            {s.trend && (
                                <View style={[C.trendBadge, s.trendUp ? C.trendUp : C.trendDown]}>
                                    <Text style={[C.trendText, s.trendUp ? C.trendTextUp : C.trendTextDown]}>{s.trend}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={C.statLabel}>{s.label}</Text>
                        <Text style={[C.statValue, { color: s.color }]}>{s.value.toLocaleString()}</Text>
                    </View>
                ))}
            </ScrollView>

            {/* ── Table card ── */}
            <View style={C.tableCard}>
                {/* Table header */}
                <View style={C.tableTopBar}>
                    <Text style={C.tableTitle}>Danh sách khách hàng</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={C.searchBox}>
                            <Ionicons name="search-outline" size={14} color="#94A3B8" />
                            <TextInput
                                style={C.searchInput}
                                placeholder="Tìm kiếm..."
                                placeholderTextColor="#94A3B8"
                                value={search}
                                onChangeText={setSearch}
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch("")}>
                                    <Ionicons name="close-circle" size={14} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity style={C.filterBtn} activeOpacity={0.8}>
                            <Ionicons name="filter-outline" size={14} color="#374151" />
                            <Text style={C.filterBtnText}>Lọc</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Column headers */}
                <View style={C.colHeader}>
                    <Text style={[C.colText, { flex: 2.5 }]}>TÊN KHÁCH HÀNG</Text>
                    <Text style={[C.colText, { flex: 1.5 }]}>SỐ ĐIỆN THOẠI</Text>
                    {isWeb && <Text style={[C.colText, { flex: 1.2 }]}>NGÀY ĐĂNG KÝ</Text>}
                    <Text style={[C.colText, { flex: 1.5 }]}>TRẠNG THÁI TƯ VẤN</Text>
                    <Text style={[C.colText, { width: 90 }]}>HÀNH ĐỘNG</Text>
                </View>

                {/* Rows */}
                {loading ? (
                    <View style={C.loadWrap}><ActivityIndicator color="#2563EB" size="small" /><Text style={C.loadText}>Đang tải...</Text></View>
                ) : filtered.length === 0 ? (
                    <View style={C.emptyWrap}>
                        <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                        <Text style={C.emptyText}>{search ? "Không tìm thấy kết quả" : "Chưa có khách hàng nào"}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item, i) => item.docId || String(i)}
                        renderItem={renderRow}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        contentContainerStyle={{ paddingBottom: isWeb ? 16 : 80 }}
                    />
                )}

                {/* Pagination footer */}
                {filtered.length > 0 && (
                    <View style={C.tableFooter}>
                        <Text style={C.footerCount}>Hiển thị {Math.min(filtered.length, 20)} trên {filtered.length} khách hàng</Text>
                    </View>
                )}
            </View>

            {/* ── Bottom banner ── */}
            {!loading && total > 0 && (
                <View style={C.bannerRow}>
                    {/* Left banner */}
                    <View style={[C.banner, { backgroundColor: "#0F172A" }]}>
                        <Ionicons name="sparkles-outline" size={22} color="#60A5FA" style={{ marginBottom: 8 }} />
                        <Text style={C.bannerTitle}>Kiến tạo trải nghiệm dịch vụ đẳng cấp cùng Azure Horizon.</Text>
                        <Text style={C.bannerDesc}>Tối ưu hóa quy trình tư vấn và chăm sóc khách hàng với dữ liệu minh bạch</Text>
                    </View>
                    {/* Right banner */}
                    {success > 0 && (
                        <View style={[C.banner, C.bannerLight]}>
                            <Ionicons name="bulb-outline" size={22} color="#2563EB" style={{ marginBottom: 8 }} />
                            <Text style={C.bannerTitleDark}>Gợi ý thông minh</Text>
                            <Text style={C.bannerDescDark}>
                                Tỷ lệ chuyển đổi đạt {total > 0 ? Math.round((success / total) * 100) : 0}%. Tập trung vào nhóm khách hàng "Đang tư vấn" để cải thiện.
                            </Text>
                            <TouchableOpacity activeOpacity={0.8} style={{ marginTop: 8 }}>
                                <Text style={C.bannerLink}>Xem báo cáo chi tiết →</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

// ── Group view (admin/daily/phantan) ─────────────────────────
function SectionHeader({ email, name, count }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionAvatar}>
                <Text style={styles.sectionAvatarText}>{getInitials(name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.sectionName}>{name || "Chưa có tên"}</Text>
                <Text style={styles.sectionEmail}>{email}</Text>
            </View>
            <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{count} KH</Text>
            </View>
        </View>
    );
}
function CustomerCard({ item, index, onPress }) {
    return (
        <TouchableOpacity style={styles.listRow} activeOpacity={0.6} onPress={() => onPress(item)}>
            <View style={[styles.listAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                <Text style={styles.listAvatarText}>{getInitials(item.name)}</Text>
            </View>
            <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.name}</Text>
                <Text style={styles.listSub}>
                    {item.phone || "Chưa có SĐT"}
                    {item.email ? ` · ${item.email}` : ""}
                </Text>
                {item.address && <Text style={styles.listAddress} numberOfLines={1}>{item.address}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
        </TouchableOpacity>
    );
}

// ── Main ─────────────────────────────────────────────────────
export default function CustomerView() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);
    const role = getRole(userDetail);
    const isCTV = role === "ctv";

    const { customers, loading, refresh } = useCustomers();
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    // Map phone → consult status for CTV
    const [consultMap, setConsultMap] = useState({});
    const [consultLoad, setConsultLoad] = useState(false);

    useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

    // Fetch consult status for CTV customers
    useEffect(() => {
        if (!isCTV || customers.length === 0) return;
        const fetchConsult = async () => {
            setConsultLoad(true);
            try {
                const phones = customers.map(c => c.phone).filter(Boolean);
                const map = {};
                // Default all to none
                phones.forEach(p => { map[p] = "none"; });

                // Query tư vấn services for these customers
                for (let i = 0; i < phones.length; i += 30) {
                    const chunk = phones.slice(i, i + 30);
                    const snap = await getDocs(
                        query(collection(db, "service"), where("type", "==", "CONSULTING"), where("phone", "in", chunk))
                    );
                    snap.docs.forEach(d => {
                        const svc = d.data();
                        const phone = svc.phone;
                        const status = svc.status || "";
                        if (status === "Tư vấn thành công") map[phone] = "success";
                        else if (status === "Tư vấn thất bại") map[phone] = "failed";
                        else if (status === "Nhận thông tin khách hàng" || status === "Chờ xử lý") {
                            if (map[phone] !== "success" && map[phone] !== "failed") map[phone] = "pending";
                        }
                    });
                }
                setConsultMap(map);
            } catch (e) { console.error(e); }
            finally { setConsultLoad(false); }
        };
        fetchConsult();
    }, [isCTV, customers]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    const handlePress = (item) => {
        router.push({
            pathname: "/CustomerView/[customerID]",
            params: { customerid: item?.docId, customerParam: JSON.stringify(item) },
        });
    };

    // ── CTV view ─────────────────────────────────────────────
    if (isCTV) {
        return (
            <View style={styles.root}>
                <Image source={BG_IMAGE} style={styles.watermark} resizeMode="contain" />
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={C.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                >
                    <CTVDashboard
                        customers={customers}
                        consultMap={consultMap}
                        loading={loading || consultLoad}
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        onAddCustomer={() => router.push("/addCustomer")}
                        onPressCustomer={handlePress}
                        search={search}
                        setSearch={setSearch}
                    />
                </ScrollView>
            </View>
        );
    }

    // ── Admin / daily / phantan view (grouped) ────────────────
    const groups = (() => {
        const myEmail = userDetail?.email;
        if (role === "daily" || role === "phantan") {
            const selfCustomers = customers.filter(c => c.createdBy === myEmail);
            const subMap = new Map();
            customers.forEach(c => {
                if (c.createdBy && c.createdBy !== myEmail) {
                    if (!subMap.has(c.createdBy)) subMap.set(c.createdBy, { email: c.createdBy, name: c.createdBy, customers: [] });
                    subMap.get(c.createdBy).customers.push(c);
                }
            });
            return [
                { email: myEmail, name: userDetail?.name || myEmail, customers: selfCustomers, isSelf: true },
                ...[...subMap.values()].filter(g => g.customers.length > 0),
            ];
        }
        if (role === "admin") {
            const map = new Map();
            customers.forEach(c => {
                const key = c.createdBy || "unknown";
                if (!map.has(key)) map.set(key, { email: key, name: key, customers: [] });
                map.get(key).customers.push(c);
            });
            return [...map.values()];
        }
        return [];
    })();

    const filteredGroups = groups.map(g => ({
        ...g,
        customers: search.trim() === "" ? g.customers
            : g.customers.filter(c =>
                (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
                (c.phone || "").includes(search)
            ),
    })).filter(g => g.customers.length > 0 || search.trim() === "");

    if (loading && !refreshing) return (
        <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={{ marginTop: 12, color: "#94A3B8", fontSize: 14 }}>Đang tải khách hàng...</Text>
        </View>
    );

    return (
        <View style={styles.root}>
            <Image source={BG_IMAGE} style={styles.watermark} resizeMode="contain" />
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        {!isWeb && <Text style={styles.headerSub}>QUẢN LÝ</Text>}
                        <Text style={styles.headerTitle}>Khách hàng</Text>
                        <Text style={styles.headerCount}>{customers.length} khách hàng · {groups.length} nhóm</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/addCustomer")}>
                        <Ionicons name="add" size={18} color={Colors.White} />
                        {isWeb && <Text style={styles.addBtnText}>Thêm khách hàng</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.searchWrap}>
                    <Ionicons name="search-outline" size={16} color="#94A3B8" />
                    <TextInput style={styles.searchInput} placeholder="Tìm tên, SĐT..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
                    {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#94A3B8" /></TouchableOpacity>}
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: isWeb ? 32 : 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                >
                    {filteredGroups.length === 0 ? (
                        <View style={styles.empty}>
                            <View style={styles.emptyIconWrap}><Ionicons name="people-outline" size={32} color="#94A3B8" /></View>
                            <Text style={styles.emptyTitle}>{search ? "Không tìm thấy kết quả" : "Chưa có khách hàng"}</Text>
                            <Text style={styles.emptySub}>{search ? "Thử từ khoá khác" : "Thêm khách hàng đầu tiên"}</Text>
                            {!search && (
                                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/addCustomer")}>
                                    <Ionicons name="add" size={16} color={Colors.White} />
                                    <Text style={styles.emptyBtnText}>Thêm khách hàng</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        filteredGroups.map((group) => (
                            <View key={group.email} style={styles.group}>
                                {!group.isSelf && <SectionHeader email={group.email} name={group.name} count={group.customers.length} />}
                                {group.customers.map((item, index) => (
                                    <CustomerCard key={item.docId || index} item={item} index={index} onPress={handlePress} />
                                ))}
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </View>
    );
}

// ── CTV Dashboard Styles ──────────────────────────────────────
const C = StyleSheet.create({
    scrollContent: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 20, paddingBottom: 40 },
    // Header
    headerWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
    pageTitle: { fontSize: isWeb ? 26 : 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
    pageDesc: { fontSize: 13, color: "#64748B", marginTop: 3 },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E3A8A", paddingHorizontal: isWeb ? 16 : 12, paddingVertical: 10, borderRadius: 10, shadowColor: "#1E3A8A", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    // Stat cards
    statsScroll: { flexGrow: 0, marginBottom: 20 },
    statsRow: { flexDirection: "row", gap: 12, paddingRight: 16 },
    statCard: { width: isWeb ? undefined : 160, flex: isWeb ? 1 : undefined, backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    statIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    trendBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
    trendUp: { backgroundColor: "#ECFDF5" },
    trendDown: { backgroundColor: "#FEF2F2" },
    trendText: { fontSize: 11, fontWeight: "700" },
    trendTextUp: { color: "#059669" },
    trendTextDown: { color: "#EF4444" },
    statLabel: { fontSize: 12, color: "#64748B", marginBottom: 4 },
    statValue: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
    // Table
    tableCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
    tableTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    tableTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#E2E8F0", minWidth: isWeb ? 180 : 130 },
    searchInput: { flex: 1, fontSize: 13, color: "#0F172A" },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#E2E8F0" },
    filterBtnText: { fontSize: 13, color: "#374151", fontWeight: "600" },
    colHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    colText: { fontSize: 10, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
    tableCell: { paddingRight: 8 },
    rowAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    rowAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    rowName: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
    rowPhone: { fontSize: 13, color: "#374151" },
    rowDate: { fontSize: 12, color: "#64748B" },
    statusChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusChipText: { fontSize: 11, fontWeight: "700" },
    actionBtn: { width: 90, alignItems: "flex-end" },
    actionBtnText: { fontSize: 12, color: "#2563EB", fontWeight: "600" },
    loadWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
    loadText: { fontSize: 13, color: "#94A3B8" },
    emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 13, color: "#94A3B8" },
    tableFooter: { padding: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    footerCount: { fontSize: 12, color: "#64748B" },
    // Bottom banners
    bannerRow: { flexDirection: isWeb ? "row" : "column", gap: 12, marginBottom: 12 },
    banner: { flex: 1, borderRadius: 14, padding: 20 },
    bannerLight: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
    bannerTitle: { fontSize: 15, fontWeight: "800", color: "#fff", lineHeight: 22, marginBottom: 8 },
    bannerDesc: { fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 18 },
    bannerTitleDark: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
    bannerDescDark: { fontSize: 12, color: "#64748B", lineHeight: 17 },
    bannerLink: { fontSize: 12, color: "#2563EB", fontWeight: "700" },
});

// ── Shared styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F8FAFC" },
    watermark: { position: "absolute", width: "80%", height: "60%", top: "20%", left: "10%", opacity: 0.05 },
    container: { flex: 1, backgroundColor: "transparent", paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 30 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    headerSub: { fontSize: 10, color: "#94A3B8", fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
    headerTitle: { fontSize: isWeb ? 28 : 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
    headerCount: { fontSize: 13, color: "#64748B", marginTop: 2 },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: isWeb ? 14 : 12, paddingVertical: 9, borderRadius: 8 },
    addBtnText: { color: Colors.White, fontSize: 13, fontWeight: "600" },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
    searchInput: { flex: 1, fontSize: 14, color: "#0F172A" },
    group: { marginBottom: 20 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
    sectionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    sectionAvatarText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    sectionName: { fontSize: 13, fontWeight: "700", color: "#F8FAFC" },
    sectionEmail: { fontSize: 11, color: "#fff", marginTop: 1 },
    sectionBadge: { backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    sectionBadgeText: { fontSize: 11, color: "#2563EB", fontWeight: "600" },
    listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 5, borderWidth: 1, borderColor: "#E2E8F0", gap: 10 },
    listAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    listAvatarText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
    listInfo: { flex: 1 },
    listName: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
    listSub: { fontSize: 12, color: "#64748B", marginTop: 1 },
    listAddress: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 8 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
    emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center" },
    emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#2563EB", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
    emptyBtnText: { color: Colors.White, fontWeight: "600", fontSize: 13 },
});