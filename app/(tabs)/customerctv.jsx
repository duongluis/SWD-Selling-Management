// app/(tabs)/customerCTV.jsx
import { UserDetailContext } from "@/context/UserDetailContext";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useContext, useState } from "react";
import {
    Image, Platform,
    RefreshControl, ScrollView, StyleSheet,
    View
} from "react-native";
import { CTVDashboard } from "../../components/UI/ctvDashboard";
import { db } from "../../config/firebaseConfig";

const isWeb = Platform.OS === "web";
const BG_IMAGE = require('../../assets/images/logo-light.png');

export default function CustomerCTVScreen() {
    const router = useRouter();
    const { userDetail } = useContext(UserDetailContext);

    const [consultList, setConsultList] = useState([]);
    const [consultMap, setConsultMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");

    const myEmail = userDetail?.email || "";

    const fetchConsult = useCallback(async () => {
        if (!myEmail) return;
        setLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, "consult"), where("createdBy", "==", myEmail))
            );
            const list = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
            const map = {};
            list.forEach(item => { map[item.docId] = item.status || "pending"; });
            setConsultList(list);
            setConsultMap(map);
        } catch (e) { console.error("fetchConsult error:", e); }
        finally { setLoading(false); setRefreshing(false); }
    }, [myEmail]);

    useFocusEffect(useCallback(() => { fetchConsult(); }, [fetchConsult]));

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchConsult();
    };

    // ✅ Bấm vào khách hàng → xem thông tin, không phải tạo mới
    const handlePressCustomer = (item) => {
        router.push({
            pathname: "/CustomerView/[customerID]",
            params: {
                customerid: item?.docId,
                customerParam: JSON.stringify(item),
            },
        });
    };

    return (
        <View style={S.root}>
            <Image source={BG_IMAGE} style={S.watermark} resizeMode="contain" />
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={S.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <CTVDashboard
                    customers={consultList}
                    consultMap={consultMap}
                    loading={loading}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    onAddConsult={() => router.push("/addConsult")}
                    onPressCustomer={handlePressCustomer}
                    search={search}
                    setSearch={setSearch}
                />
            </ScrollView>
        </View>
    );
}

const S = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#F8FAFC" },
    watermark: { position: "absolute", width: "80%", height: "60%", top: "20%", left: "10%", opacity: 0.05 },
    scroll: { paddingHorizontal: isWeb ? 32 : 16, paddingTop: isWeb ? 28 : 20, paddingBottom: 40 },
});