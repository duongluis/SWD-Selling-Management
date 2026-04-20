import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';
import { useContext, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import auth, { db } from '../../config/firebaseConfig';

const DESKTOP_BREAKPOINT = 768; // px — dưới mức này dùng tab bar thay vì sidebar

// ── Dữ liệu sản phẩm ────────────────────────────────────────
const PRODUCTS_DATA = require("../../config/price.json")

// [  { id: 1, name: "Máy F3000A", price: 10235000, price_a: 6141000, price_p: 7164500, price_c: 8699750, water_source: "Nước từ thủy cực", water_certificate: "QCVN 02/2009/BYT", made_in: "Việt Nam", capacity: "3000 lít/giờ", technology: "Golden Panthera", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,2 W", electric_capacity: "0 W", sorting_tech: "Ultra Filtration", pipe_material: "PVC", pipe_original: "Trung Quốc", pipe_diameter: "¾ inch", drain_pipe_diameter: "10 mm", drain_water: "0,2%", dimension: "45 x 30 x 14 (cm)", color: "Ghi xám", weight: "14 Kg", life_style: "> 3 năm", guarantee: "01 tháng với màng lọc\n12 tháng với linh kiện điện tử", recommend_location: "Âm trần thạch cao, Trong nhà, Dưới mái che" },
//   { id: 2, name: "Máy F3000AC", price: 14835000, price_a: 8901000, price_p: 10384500, price_c: 12609750, water_source: "Nước từ thủy cực", water_certificate: "QCVN 02/2009/BYT", made_in: "Việt Nam", capacity: "3000 lít/giờ", technology: "Golden Panthera", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,2 W", electric_capacity: "0 W", sorting_tech: "Ultra Filtration", pipe_material: "PVC", pipe_original: "Trung Quốc", pipe_diameter: "¾ inch", drain_pipe_diameter: "10 mm", drain_water: "0,2%", dimension: "45 x 30 x 14 (cm)", color: "Ghi sáng", weight: "14 Kg", life_style: "> 3 năm", guarantee: "01 tháng với màng lọc\n12 tháng với linh kiện điện tử", recommend_location: "Âm trần thạch cao, Trong nhà, Dưới mái che" },
//   { id: 3, name: "Máy F3000P", price: 17135000, price_a: 10281000, price_p: 11994500, price_c: 14564750, water_source: "Nước từ thủy cục", water_certificate: "QCVN 01/2018/BYT\nQCVN 02/2009/BYT", made_in: "Việt Nam", capacity: "3000 lít/giờ", technology: "Golden Panthera", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,2 W", electric_capacity: "1,2 W", sorting_tech: "Ultra Filtration", pipe_material: "PES (Mitsubishi Chemical)", pipe_original: "Trung Quốc", pipe_diameter: "3/4 inch", drain_pipe_diameter: "10 mm", drain_water: "0,2%", dimension: "45 x 30 x 14 (cm)", color: "Trắng", weight: "14 kg", life_style: "> 3 năm", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Âm trần thạch cao, trong nhà, dưới mái che" },
//   { id: 4, name: "Máy F3000PC", price: 21735000, price_a: 13041000, price_p: 15214500, price_c: 18474750, water_source: "Nước từ thủy cục", water_certificate: "QCVN 01/2018/BYT\nQCVN 02/2009/BYT", made_in: "Việt Nam", capacity: "3000 lít/giờ", technology: "Golden Panthera", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,2 W", electric_capacity: "1,2 W", sorting_tech: "Ultra Filtration", pipe_material: "PES (Mitsubishi Chemical)", pipe_original: "Trung Quốc", pipe_diameter: "3/4 inch", drain_pipe_diameter: "10 mm", drain_water: "0,2%", dimension: "45 x 30 x 14 (cm)", color: "Trắng", weight: "14 kg", life_style: "> 3 năm", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Âm trần thạch cao, trong nhà, dưới mái che" },
//   { id: 5, name: "Máy F3000PS", price: 41273500, price_a: 24764100, price_p: 28891450, price_c: 35082475, water_source: "Nước từ thủy cục", water_certificate: "QCVN 01/2018/BYT\nQCVN 02/2009/BYT", made_in: "Việt Nam", capacity: "3000 lít/giờ", technology: "Golden Panthera", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,2 W", electric_capacity: "1,2 W", sorting_tech: "Ultra Filtration", pipe_material: "PES (Mitsubishi Chemical)", pipe_original: "Trung Quốc", pipe_diameter: "3/4 inch", drain_pipe_diameter: "10 mm", drain_water: "0,2%", dimension: "45 x 30 x 14 (cm)", color: "Trắng", weight: "14 kg", life_style: "> 3 năm", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Âm trần thạch cao, trong nhà, dưới mái che" },
//   { id: 6, name: "Máy R1000E", price: 137873500, price_a: 82724100, price_p: 96511450, price_c: 117192475, water_source: "Nước sinh hoạt, nước ao, hồ, sông, suối, giếng", water_certificate: "Nước uống, nước sinh hoạt trực tiếp; PUB (Singapore); QCVN 06/2010/BYT; QCVN 01/2018/BYT", made_in: "Việt Nam", capacity: "1000 lít/giờ", technology: "RO, UF, MF, v.v.", control_system: "Siemens điều khiển tự động (CHLB Đức)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "Vontron (Trung Quốc)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, dimension: "Tùy chỉnh", color: "Inox", weight: "160 - 200 Kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Trong nhà, Dưới mái che" },
//   { id: 7, name: "Máy M1200E", price: 160873500, price_a: 96524100, price_p: 112611450, price_c: 136742475, water_source: "Nước sinh hoạt, nước ao, hồ, sông, suối, giếng", water_certificate: "Nước uống, nước sinh hoạt trực tiếp; PUB (Singapore); QCVN 06/2010/BYT; QCVN 01/2018/BYT", made_in: "Việt Nam", capacity: "1200 lít/giờ", technology: "Nano, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "Vontron (Trung Quốc)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, dimension: "Tùy chỉnh", color: "Inox", weight: "160 - 200 Kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Dưới mái che" },
//   { id: 8, name: "Máy R500I", price: 206885000, price_a: 124131000, price_p: 144819500, price_c: 175852250, water_source: "Nước sinh hoạt, ao, hồ, sông, suối, giếng", water_certificate: "QCVN 01/2018/BYT\nQCVN 06/2010/BYT", made_in: "Việt Nam", capacity: "500 lít/giờ", technology: "RO, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", monitoring_system: "Mitsubishi (Nhật Bản)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "CSM (Hàn Quốc)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, realtime_monitoring: true, smarthome_connect: true, dimension: "65 x 65 x 160 (cm)", color: "Trắng", weight: "200 - 250 kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Ngoài trời, trong nhà, dưới mái che" },
//   { id: 9, name: "Máy R1000I", price: 442623500, price_a: 265574100, price_p: 309836450, price_c: 376229975, water_source: "Nước sinh hoạt, ao, hồ, sông, suối, giếng", water_certificate: "QCVN 01/2018/BYT\nQCVN 06/2010/BYT", made_in: "Việt Nam", capacity: "1000 lít/giờ", technology: "RO, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", monitoring_system: "Mitsubishi (Nhật Bản)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "CSM (Hàn Quốc)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, realtime_monitoring: true, smarthome_connect: true, dimension: "65 x 65 x 160 (cm)", color: "Trắng", weight: "200 - 250 kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Ngoài trời, trong nhà, dưới mái che" },
//   { id: 10, name: "Máy R1000S", price: 923890000, price_a: 554334000, price_p: 646723000, price_c: 785306500, water_source: "Nước sinh hoạt, ao, hồ, sông, suối, giếng", water_certificate: "QCVN 01/2018/BYT\nQCVN 06/2010/BYT", made_in: "Việt Nam", capacity: "1000 lít/giờ", technology: "RO, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", monitoring_system: "Mitsubishi (Nhật Bản)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "DOW Filmtec (Hoa Kỳ)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, realtime_monitoring: true, smarthome_connect: true, dimension: "65 x 65 x 160 (cm)", color: "Trắng", weight: "200 - 250 kg", guarantee: "90 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Ngoài trời, trong nhà, dưới mái che" },
//   { id: 11, name: "Máy M600I", price: 278173500, price_a: 166904100, price_p: 194721450, price_c: 236447475, water_source: "Nước sinh hoạt, ao, hồ, sông, suối, giếng", water_certificate: "QCVN 01/2018/BYT\nQCVN 06/2010/BYT", made_in: "Việt Nam", capacity: "600 lít/giờ", technology: "Nano, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "CSM (Hàn Quốc)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, dimension: "65 x 65 x 160 (cm)", color: "Trắng", weight: "200 - 250 kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Ngoài trời, trong nhà, dưới mái che" },
//   { id: 12, name: "Máy M1300I", price: 505873500, price_a: 303524100, price_p: 354111450, price_c: 429992475, water_source: "Nước sinh hoạt, ao, hồ, sông, suối, giếng", water_certificate: "Nước uống trực tiếp PUB Singapore\nQCVN 01/2018/BYT\nQCVN 06/2010/BYT", made_in: "Việt Nam", capacity: "1300 lít/giờ", technology: "Nano, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "CSM (Hàn Quốc)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, dimension: "65 x 65 x 160 (cm)", color: "Trắng", weight: "200 - 250 kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Ngoài trời, trong nhà, dưới mái che" },
//   { id: 13, name: "Máy M1300S", price: 956890000, price_a: 574134000, price_p: 669823000, price_c: 813356500, water_source: "Nước sinh hoạt, ao, hồ, sông, suối, giếng", water_certificate: "Nước uống trực tiếp PUB Singapore\nQCVN 01/2018/BYT\nQCVN 06/2010/BYT", made_in: "Việt Nam", capacity: "1300 lít/giờ", technology: "Nano, UF, MF, v.v.", control_system: "Siemens (CHLB Đức)", monitoring_system: "Mitsubishi (Nhật Bản)", electric_requirement: "220 Vac / 50-60Hz", using_electric_capacity: "1,5 kW", electric_capacity: "5 W", pipe_material: "PA", pipe_original: "DOW Filmtec (Hoa Kỳ)", pipe_diameter: "25 mm", drain_pipe_diameter: "20 mm", drain_water: "8 - 15%", has_music: true, has_cip: true, auto_detect: true, auto_trigger: true, has_bypass: true, realtime_monitoring: true, smarthome_connect: true, dimension: "65 x 65 x 160 (cm)", color: "Trắng", weight: "200 - 250 kg", guarantee: "06 tháng (với màng lọc)\n24 tháng (với linh kiện điện tử)", recommend_location: "Ngoài trời, trong nhà, dưới mái che" },
// ];

const NAV_ITEMS = [
  { key: 'home', label: 'TRANG CHỦ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'order', label: 'ĐƠN HÀNG', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'customer', label: 'KHÁCH HÀNG', icon: 'people-outline', activeIcon: 'people' },
  { key: 'service', label: 'DỊCH VỤ', icon: 'build-outline', activeIcon: 'build' },
  { key: 'leaderboard', label: 'BXH', icon: 'trophy-outline', activeIcon: 'trophy' },
];

const WEB_NAV_ITEMS = [
  { key: 'home', label: 'TRANG CHỦ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'order', label: 'ĐƠN HÀNG', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'customer', label: 'KHÁCH HÀNG', icon: 'people-outline', activeIcon: 'people' },
  { key: 'service', label: 'DỊCH VỤ', icon: 'build-outline', activeIcon: 'build' },
  { key: 'leaderboard', label: 'BXH', icon: 'trophy-outline', activeIcon: 'trophy' },
];

function getInitials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const isAdmin = (userDetail) =>
  userDetail?.role === 'admin' || userDetail?.member === 'admin';

// ── Web Sidebar ──────────────────────────────────────────────
function WebSidebar({ activeTab, onNavigate, userDetail, collapsed, onToggle, router }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncOk, setSyncOk] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/auth/signIn');
          } catch (e) {
            Alert.alert('Lỗi', e.message);
          }
        },
      },
    ]);
    setShowLogout(false);
  };

  const handleSyncProducts = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncOk(false);
    try {
      const batch = writeBatch(db);
      PRODUCTS_DATA.forEach(product => {
        batch.set(doc(db, 'products', String(product.id)), {
          ...product,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      setLastSync(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      setSyncOk(true);
      Alert.alert('✅ Thành công', `Đã cập nhật ${PRODUCTS_DATA.length} sản phẩm lên Firestore!`);
    } catch (e) {
      console.error('❌ Lỗi sync:', e);
      Alert.alert('❌ Lỗi', 'Không thể cập nhật: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={[S.sidebar, collapsed && S.sidebarCollapsed]}>

      {/* Workspace */}
      <View style={S.workspaceRow}>
        {!collapsed && (
          <View style={S.workspaceName}>
            <View style={S.workspaceLogo}>
              <Ionicons name="storefront" size={14} color={Colors.White} />
            </View>
            <Text style={S.workspaceText}>SWD Seller</Text>
          </View>
        )}
        <Pressable onPress={onToggle} style={S.collapseBtn}>
          <Ionicons name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'} size={14} color="#64748B" />
        </Pressable>
      </View>

      {/* Search */}
      {!collapsed && (
        <Pressable style={S.searchBar}>
          <Ionicons name="search-outline" size={14} color="#64748B" />
          <Text style={S.searchText}>Search...</Text>
        </Pressable>
      )}

      {/* Nav */}
      <View style={S.navSection}>
        {!collapsed && <Text style={S.navSectionLabel}>WORKSPACE</Text>}
        {WEB_NAV_ITEMS.map(item => {
          const isActive = activeTab === item.key;
          return (
            <Pressable key={item.key} style={[S.navItem, isActive && S.navItemActive]} onPress={() => onNavigate(item.key)}>
              <Ionicons name={isActive ? item.activeIcon : item.icon} size={16} color={isActive ? '#F8FAFC' : '#64748B'} style={S.navIcon} />
              {!collapsed && <Text style={[S.navLabel, isActive && S.navLabelActive]}>{item.label}</Text>}
            </Pressable>
          );
        })}
      </View>

      {/* Quick add */}
      {!collapsed && (
        <View style={S.navSection}>
          <Text style={S.navSectionLabel}>QUICK ADD</Text>
          {[
            { label: 'New Order', icon: 'add-circle-outline', route: '/addOrder' },
            { label: 'New Customer', icon: 'person-add-outline', route: '/addCustomer' },
          ].map(a => (
            <Pressable key={a.label} style={S.navItem} onPress={() => router.push(a.route)}>
              <Ionicons name={a.icon} size={16} color="#64748B" style={S.navIcon} />
              <Text style={S.navLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ✅ Admin — Cập nhật giá sản phẩm */}
      {isAdmin(userDetail) && (
        <View style={S.navSection}>
          {!collapsed && (
            <View style={S.adminSectionHeader}>
              <Text style={S.navSectionLabel}>ADMIN</Text>
              <View style={S.adminBadge}>
                <Text style={S.adminBadgeText}>ADMIN</Text>
              </View>
            </View>
          )}

          {/* Nút sync */}
          <Pressable
            style={[
              S.syncBtn,
              collapsed && S.syncBtnCollapsed,
              syncing && S.syncBtnLoading,
            ]}
            onPress={handleSyncProducts}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={syncOk ? 'checkmark-circle' : 'cloud-upload-outline'}
                size={16}
                color="#FFFFFF"
              />
            )}
            {!collapsed && (
              <Text style={S.syncBtnText}>
                {syncing ? 'Đang cập nhật...' : 'Cập nhật giá'}
              </Text>
            )}
          </Pressable>

          {/* Thông tin sau khi sync */}
          {!collapsed && (
            <View style={S.syncMeta}>
              {lastSync ? (
                <View style={S.syncMetaRow}>
                  <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                  <Text style={[S.syncMetaText, { color: '#10B981' }]}>Cập nhật lúc {lastSync}</Text>
                </View>
              ) : (
                <View style={S.syncMetaRow}>
                  <Ionicons name="information-circle-outline" size={11} color="#475569" />
                  <Text style={S.syncMetaText}>Chưa cập nhật</Text>
                </View>
              )}
              <View style={S.syncMetaRow}>
                <Ionicons name="cube-outline" size={11} color="#475569" />
                <Text style={S.syncMetaText}>{PRODUCTS_DATA.length} sản phẩm</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={{ flex: 1 }} />

      {/* User row + logout popup */}
      <View>
        {showLogout && (
          <View style={S.logoutPopup}>
            <TouchableOpacity style={S.logoutItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={15} color="#F87171" />
              <Text style={S.logoutItemText}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        )}
        <Pressable
          style={[S.userRow, collapsed && { justifyContent: 'center' }]}
          onPress={() => !collapsed && setShowLogout(p => !p)}
        >
          <View style={S.userAvatar}>
            <Text style={S.userAvatarText}>{getInitials(userDetail?.name)}</Text>
          </View>
          {!collapsed && (
            <>
              <View style={{ flex: 1 }}>
                <Text style={S.userName} numberOfLines={1}>{userDetail?.name || 'User'}</Text>
                <Text style={S.userRole}>{userDetail?.email || ''}</Text>
              </View>
              <Ionicons
                name={showLogout ? 'chevron-down' : 'ellipsis-horizontal'}
                size={16}
                color="#64748B"
              />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Mobile Tab Bar (dùng cho cả native + mobile web) ────────
function CustomTabBar({ state, descriptors, navigation, isMobileWeb }) {
  const router = useRouter();
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  const handleLogout = async () => {
    try {
      console.log("Đã Log Out")
      await signOut(auth);
      router.replace('./auth/signIn');
    } catch (e) {
      Alert.alert('Lỗi', e.message);
    }
    // Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
    //   { text: 'Huỷ', style: 'cancel' },
    //   {
    //     text: 'Đăng xuất',
    //     style: 'destructive',
    //     onPress: async () => {
    //       try {
    //         console.log("Đã Log Out")
    //         await signOut(auth);
    //         router.replace('/auth/signIn');
    //       } catch (e) {
    //         Alert.alert('Lỗi', e.message);
    //       }
    //     },
    //   },
    // ]);
    setShowLogoutMenu(false);
  };

  return (
    <View style={[M.tabBarWrap, isMobileWeb && M.tabBarWrapWeb]}>
      {/* Logout popup */}
      {showLogoutMenu && (
        <View style={M.logoutPopup}>
          <TouchableOpacity style={M.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={M.logoutBtnText}>Đăng xuất</Text>
          </TouchableOpacity>
          <TouchableOpacity style={M.logoutCancel} onPress={() => setShowLogoutMenu(false)}>
            <Text style={M.logoutCancelText}>Huỷ</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={M.tabBar}>
        {state.routes.map((route, index) => {
          const tab = NAV_ITEMS[index];
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TouchableOpacity key={route.key} style={[M.tabItem, isFocused && M.activeTabItem]} onPress={onPress} activeOpacity={0.8}>
              <Ionicons name={tab?.icon} size={22} color={isFocused ? Colors.LightBlue : Colors.LightGray} style={M.icon} />
              <Text style={[M.tabLabel, isFocused && M.activeTabLabel]}>{tab?.label}</Text>
            </TouchableOpacity>
          );
        })}
        {/* Nút 3 chấm logout */}
        <TouchableOpacity
          style={M.tabItem}
          onPress={() => setShowLogoutMenu(p => !p)}
          activeOpacity={0.8}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.LightGray} style={M.icon} />
          <Text style={M.tabLabel}>Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Root ─────────────────────────────────────────────────────
export default function TabLayout() {
  const { userDetail } = useContext(UserDetailContext);
  const router = useRouter();
  const segments = useSegments();
  const [collapsed, setCollapsed] = useState(false);

  // ✅ Reactive window size — cập nhật khi resize browser
  const { width: winWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winWidth >= DESKTOP_BREAKPOINT;
  const isMobileWeb = Platform.OS === 'web' && winWidth < DESKTOP_BREAKPOINT;

  const activeTab = segments[segments.length - 1] || 'home';
  const pageLabel = WEB_NAV_ITEMS.find(n => n.key === activeTab)?.label || 'Overview';

  const handleNavigate = (key) => router.push(`/(tabs)/${key}`);

  const tabScreens = (
    <>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="order" />
      <Tabs.Screen name="customer" />
      <Tabs.Screen name="service" />
      <Tabs.Screen name="leaderboard" />
    </>
  );

  // ── Desktop Web → Sidebar layout ────────────────────────────
  if (isDesktopWeb) {
    return (
      <View style={S.root}>
        <WebSidebar
          activeTab={activeTab}
          onNavigate={handleNavigate}
          userDetail={userDetail}
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          router={router}
        />
        <View style={S.mainArea}>
          <View style={S.topBar}>
            <View style={S.breadcrumb}>
              <Text style={S.breadcrumbRoot}>SWD Seller</Text>
              <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
              <Text style={S.breadcrumbCurrent}>{pageLabel}</Text>
            </View>
            <View style={S.topBarActions}>
              <Pressable style={S.topBarBtn}><Ionicons name="notifications-outline" size={18} color="#64748B" /></Pressable>
              <Pressable style={S.topBarBtn}><Ionicons name="help-circle-outline" size={18} color="#64748B" /></Pressable>
              <View style={S.topBarDivider} />
              <View style={S.topBarAvatar}>
                <Text style={S.topBarAvatarText}>{getInitials(userDetail?.name)}</Text>
              </View>
            </View>
          </View>
          <View style={S.contentArea}>
            <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
              {tabScreens}
            </Tabs>
          </View>
        </View>
      </View>
    );
  }

  // ── Mobile Web + Native → Tab bar layout ─────────────────────
  // isMobileWeb hoặc native đều dùng tab bar giống nhau
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} isMobileWeb={isMobileWeb} />}
      screenOptions={{ headerShown: false }}
    >
      {tabScreens}
    </Tabs>
  );
}

// ── Web Styles ───────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC', height: '100vh' },
  sidebar: { width: 240, backgroundColor: '#0F172A', paddingTop: 16, paddingBottom: 12, paddingHorizontal: 12, flexDirection: 'column', borderRightWidth: 1, borderRightColor: '#1E293B' },
  sidebarCollapsed: { width: 60, paddingHorizontal: 10 },
  workspaceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  workspaceName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  workspaceLogo: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  workspaceText: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  collapseBtn: { width: 24, height: 24, borderRadius: 5, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E293B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 16 },
  searchText: { flex: 1, color: '#64748B', fontSize: 13 },
  searchShortcut: { color: '#334155', fontSize: 11, fontWeight: '600' },
  navSection: { marginBottom: 16 },
  navSectionLabel: { color: '#334155', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, paddingHorizontal: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 7, marginBottom: 1 },
  navItemActive: { backgroundColor: '#1E293B' },
  navIcon: { marginRight: 8 },
  navLabel: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  navLabelActive: { color: '#F8FAFC', fontWeight: '600' },

  // ── Admin section ──
  adminSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 6 },
  adminBadge: { backgroundColor: '#1E3A8A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: '#93C5FD', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // ── Sync button ──
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1D4ED8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6, borderWidth: 1, borderColor: '#2563EB' },
  syncBtnCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  syncBtnLoading: { backgroundColor: '#1E40AF', borderColor: '#1D4ED8', opacity: 0.85 },
  syncBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Sync meta ──
  syncMeta: { paddingHorizontal: 4, gap: 3 },
  syncMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  syncMetaText: { color: '#475569', fontSize: 10 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', cursor: 'pointer' },
  userAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#F8FAFC', fontSize: 11, fontWeight: '800' },
  userName: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  userRole: { color: '#475569', fontSize: 10, marginTop: 1 },

  // Logout popup
  logoutPopup: { backgroundColor: '#1E293B', borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  logoutItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  logoutItemText: { color: '#F87171', fontSize: 13, fontWeight: '600' },
  mainArea: { flex: 1, flexDirection: 'column', backgroundColor: '#F8FAFC' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbRoot: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  breadcrumbCurrent: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topBarBtn: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  topBarDivider: { width: 1, height: 20, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
  topBarAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  topBarAvatarText: { color: '#F8FAFC', fontSize: 11, fontWeight: '800' },
  contentArea: { flex: 1, overflow: 'hidden' },
});

// ── Mobile Styles ────────────────────────────────────────────
const M = StyleSheet.create({
  tabBarWrap: { backgroundColor: 'transparent' },
  tabBarWrapWeb: { paddingBottom: 8, backgroundColor: '#F8FAFC' },
  tabBar: { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10, backgroundColor: Colors.White, paddingVertical: 6, borderRadius: 50, borderWidth: 10, borderColor: Colors.White, shadowColor: Colors.Black, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 50 },
  activeTabItem: { borderWidth: 2, borderColor: Colors.LightBlue, backgroundColor: Colors.BlueSky },
  tabLabel: { color: Colors.LightGray, fontWeight: '600', textAlign: 'center', fontSize: 10, marginTop: 2 },
  activeTabLabel: { color: Colors.Blue },
  icon: { marginBottom: 2 },

  // Logout popup (mobile)
  logoutPopup: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logoutBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  logoutCancel: { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  logoutCancelText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
});