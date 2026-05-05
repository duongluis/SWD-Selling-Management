// components/CTVDashboard.jsx
// Component dashboard riêng cho CTV — export named để tránh conflict

import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const isWeb = Platform.OS === "web";

function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).filter(n => n.length > 0).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

const CONSULT_STATUS = {
    success: { label: "Thành công", color: "#059669", bg: "#ECFDF5", dot: "#059669" },
    failed: { label: "Thất bại", color: "#EF4444", bg: "#FEF2F2", dot: "#EF4444" },
    pending: { label: "Đang tư vấn", color: "#2563EB", bg: "#EFF6FF", dot: "#2563EB" },
    none: { label: "Chưa tư vấn", color: "#94A3B8", bg: "#F1F5F9", dot: "#CBD5E1" },
};

export function CTVDashboard({ customers, consultMap, loading, refreshing, onRefresh, onAddConsult, onPressCustomer, search, setSearch }) {
    const total = customers.length;
    const consulted = customers.filter(c => consultMap[c.docId] && consultMap[c.docId] !== "none").length;
    const success = customers.filter(c => consultMap[c.docId] === "success").length;
    const failed = customers.filter(c => consultMap[c.docId] === "failed").length;

    const filtered = customers.filter(c =>
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").includes(search)
    );

    const STATS = [
        { label: "Tổng số khách hàng", value: total, icon: "people-outline", color: "#2563EB", bg: "#EFF6FF" },
        { label: "Khách hàng đã tư vấn", value: consulted, icon: "chatbubbles-outline", color: "#7C3AED", bg: "#F5F3FF" },
        { label: "Tư vấn thành công", value: success, icon: "checkmark-circle-outline", color: "#059669", bg: "#ECFDF5" },
        { label: "Tư vấn thất bại", value: failed, icon: "close-circle-outline", color: "#EF4444", bg: "#FEF2F2" },
    ];

    const renderRow = ({ item, index }) => {
        const statusKey = consultMap[item.docId] || "none";
        const status = CONSULT_STATUS[statusKey];
        const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "—";
        return (
            <TouchableOpacity style={C.tableRow} onPress={() => onPressCustomer(item)} activeOpacity={0.7}>
                <View style={[C.tableCell, { flex: 2.5, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <View style={[C.rowAvatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
                        <Text style={C.rowAvatarText}>{getInitials(item.name)}</Text>
                    </View>
                    <Text style={C.rowName} numberOfLines={1}>{item.name || "—"}</Text>
                </View>
                <View style={[C.tableCell, { flex: 1.5 }]}>
                    <Text style={C.rowPhone}>{item.phone || "—"}</Text>
                </View>
                {isWeb && (
                    <View style={[C.tableCell, { flex: 1.2 }]}>
                        <Text style={C.rowDate}>{createdAt}</Text>
                    </View>
                )}
                <View style={[C.tableCell, { flex: 1.5 }]}>
                    <View style={[C.statusChip, { backgroundColor: status.bg }]}>
                        <View style={[C.statusDot, { backgroundColor: status.dot }]} />
                        <Text style={[C.statusChipText, { color: status.color }]}>{status.label}</Text>
                    </View>
                </View>
                <TouchableOpacity style={C.actionBtn} onPress={() => onPressCustomer(item)} activeOpacity={0.7}>
                    <Text style={C.actionBtnText}>Xem chi tiết</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={C.headerWrap}>
                <View>
                    <Text style={C.pageTitle}>Quản lý Khách hàng</Text>
                    <Text style={C.pageDesc}>Theo dõi và quản lý dữ liệu khách hàng của bạn.</Text>
                </View>
                <TouchableOpacity style={C.addBtn} onPress={onAddConsult} activeOpacity={0.85}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={C.addBtnText}>+ Thêm Khách hàng</Text>
                </TouchableOpacity>
            </View>

            {/* Stat cards — dàn đều */}
            <View style={C.statsRow}>
                {STATS.map(s => (
                    <View key={s.label} style={C.statCard}>
                        <View style={C.statTop}>
                            <View style={[C.statIconWrap, { backgroundColor: s.bg }]}>
                                <Ionicons name={s.icon} size={20} color={s.color} />
                            </View>
                        </View>
                        <Text style={C.statLabel}>{s.label}</Text>
                        <Text style={[C.statValue, { color: s.color }]}>{s.value.toLocaleString()}</Text>
                    </View>
                ))}
            </View>

            {/* Table */}
            <View style={C.tableCard}>
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

                {loading ? (
                    <View style={C.loadWrap}>
                        <ActivityIndicator color="#2563EB" size="small" />
                        <Text style={C.loadText}>Đang tải...</Text>
                    </View>
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

                {filtered.length > 0 && (
                    <View style={C.tableFooter}>
                        <Text style={C.footerCount}>Hiển thị {filtered.length} khách hàng</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const C = StyleSheet.create({
    headerWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    pageTitle: { fontSize: isWeb ? 26 : 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
    pageDesc: { fontSize: 13, color: "#64748B", marginTop: 3 },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E3A8A", paddingHorizontal: isWeb ? 16 : 12, paddingVertical: 10, borderRadius: 10 },
    addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
    statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", minWidth: 0 },
    statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
    statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    statLabel: { fontSize: isWeb ? 12 : 10, color: "#64748B", marginBottom: 4 },
    statValue: { fontSize: isWeb ? 28 : 22, fontWeight: "900", letterSpacing: -0.5 },
    tableCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", marginBottom: 16 },
    tableTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    tableTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFC", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#E2E8F0", minWidth: isWeb ? 180 : 130 },
    searchInput: { flex: 1, fontSize: 13, color: "#0F172A" },
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
});