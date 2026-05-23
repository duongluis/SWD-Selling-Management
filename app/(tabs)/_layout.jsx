// app/(tabs)/_layout.jsx

import NotificationPanel from '@/components/Main/notificationPanel';
import { showAlert } from '@/components/Main/showAlert';
import { showInfo } from '@/components/Main/showInfo';
import { getRole, getRoleLabel } from '@/components/Utils/roleHelper';
import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useContext, useState } from 'react';
import {
  Image, Platform, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity,
  useWindowDimensions, View
} from 'react-native';
import auth from '../../config/firebaseConfig';

const DESKTOP_BREAKPOINT = 768;
const BANNER_IMAGE = require('../../assets/images/layout-img.png');

function getInitials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Nav config theo section ───────────────────────────────────
// visible: fn(role) => boolean
const NAV_SECTIONS = [
  {
    label: 'CHÍNH',
    items: [
      { key: 'home', link: '(tabs)/home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home', visible: () => true },
      { key: 'customer', link: '(tabs)/customer', label: 'Khách hàng', icon: 'people-outline', activeIcon: 'people', visible: (r) => r !== 'ctv' },
      { key: 'consult', link: '(tabs)/customerctv', label: 'Giới thiệu khách', icon: 'person-add-outline', activeIcon: 'person-add', visible: (r) => r === 'ctv' || r === 'admin' },
      { key: 'order', link: '(tabs)/order', label: 'Đơn hàng', icon: 'receipt-outline', activeIcon: 'receipt', visible: () => true },
      { key: 'service', link: '(tabs)/service', label: 'Dịch vụ', icon: 'build-outline', activeIcon: 'build', visible: (r) => r !== 'ctv' },
      { key: 'team', link: '(tabs)/team', label: 'Đội ngũ', icon: 'people-outline', activeIcon: 'people', visible: () => true },
    ],
  },
  {
    label: 'TIỆN ÍCH',
    items: [
      { key: 'leaderboard', link: '(tabs)/leaderboard', label: 'Bảng xếp hạng', icon: 'trophy-outline', activeIcon: 'trophy', visible: () => true },
      { key: 'commission', link: '(tabs)/commission', label: 'Hoa hồng', icon: 'cash-outline', activeIcon: 'cash', visible: (r) => r !== 'daily' },
      { key: 'revenue', link: '(tabs)/analytics', label: 'Báo cáo doanh thu', icon: 'bar-chart-outline', activeIcon: 'bar-chart', visible: () => true },
      { key: 'region', link: '(tabs)/regionAnalytics', label: 'Báo cáo khu vực', icon: 'map-outline', activeIcon: 'map', visible: () => true },
      { key: 'news', link: '(tabs)/news', label: 'Tin tức', icon: 'newspaper-outline', activeIcon: 'newspaper', visible: () => true },
      { key: 'information', link: '(tabs)/information', label: 'Bảng giá', icon: 'pricetag-outline', activeIcon: 'pricetag', visible: () => true },
      { key: 'quotation', link: 'orderContract?mode=template', label: 'Form báo giá', icon: 'document-text-outline', activeIcon: 'document-text', visible: () => true },
      { key: 'calculator', link: '(tabs)/calculator', label: 'Tính toán', icon: 'calculator-outline', activeIcon: 'calculator', visible: () => true },
    ],
  },
  {
    label: 'HỖ TRỢ',
    items: [
      { key: 'chatList', link: '(tabs)/chatList', label: 'Phòng Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', visible: () => true },
      { key: 'profile', link: '(tabs)/editProfile', label: 'Thông tin cá nhân', icon: 'person-circle-outline', activeIcon: 'person-circle', visible: () => true },
    ],
  },
];

// Mobile bottom tab items
const MOBILE_TABS = [
  { key: 'home', link: '(tabs)/home', label: 'TRANG CHỦ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'order', link: '(tabs)/order', label: 'ĐƠN HÀNG', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'customer', link: '(tabs)/customer', label: 'KHÁCH HÀNG', icon: 'people-outline', activeIcon: 'people' },
  { key: 'service', link: '(tabs)/service', label: 'DỊCH VỤ', icon: 'build-outline', activeIcon: 'build' },
  { key: 'leaderboard', link: '(tabs)/leaderboard', label: 'BXH', icon: 'trophy-outline', activeIcon: 'trophy' },
  { key: 'information', link: 'information', label: 'BẢNG GIÁ', icon: 'cash-outline', activeIcon: 'cash' },
  { key: 'team', link: '(tabs)/team', label: 'ĐỘI NGŨ', icon: 'people-outline', activeIcon: 'people' },
];

// ── NavItem ───────────────────────────────────────────────────
function NavItem({ item, isActive, collapsed, onPress }) {
  return (
    <Pressable style={[S.navItem, isActive && S.navItemActive]} onPress={onPress}>
      <View style={[S.navIconWrap, isActive && S.navIconWrapActive]}>
        <Ionicons name={isActive ? item.activeIcon : item.icon} size={15}
          color={isActive ? '#fff' : 'rgba(255,255,255,0.7)'} />
      </View>
      {!collapsed && (
        <Text style={[S.navLabel, isActive && S.navLabelActive]} numberOfLines={1}>
          {item.label}
        </Text>
      )}
    </Pressable>
  );
}

// ── Web Sidebar ───────────────────────────────────────────────
function WebSidebar({ activeTab, onNavigate, userDetail, collapsed, onToggle, router }) {
  const [showLogout, setShowLogout] = useState(false);

  const role = getRole(userDetail);
  const roleLabel = getRoleLabel(role);

  const handleLogout = () => {
    showAlert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', async () => {
      try { await signOut(auth); router.replace('/auth/signIn'); }
      catch (e) { showInfo('Lỗi', e.message); }
    });
    setShowLogout(false);
  };


  const isUsersActive = activeTab === 'users' || activeTab === 'user';

  return (
    <View style={[S.sidebar, collapsed && S.sidebarCollapsed]}>

      {/* ── Logo + collapse btn ── */}
      <View style={S.workspaceRow}>
        {!collapsed && (
          <View style={S.workspaceName}>
            <Image style={S.icon} source={require('../../assets/images/logo-dark.png')} resizeMode="contain" />
            <Text style={S.workspaceText}>SWD Seller Manager</Text>
          </View>
        )}
        <Pressable onPress={onToggle} style={S.collapseBtn}>
          <Ionicons name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'} size={13} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Nav sections */}
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.visible(role));
          if (!visibleItems.length) return null;
          return (
            <View key={section.label} style={S.navSection}>
              {!collapsed && <Text style={S.navSectionLabel}>{section.label}</Text>}
              {visibleItems.map(item => {
                // ✅ calculator và quotation cùng link nhưng key khác nhau
                const isActive = activeTab === item.key;
                const handlePress = () => {
                  if (item.link.startsWith('(tabs)/')) onNavigate(item.link);
                  else if (item.link.includes('?')) router.push(`/${item.link.split('?')[0]}?${item.link.split('?')[1]}`);
                  else router.push(`/${item.link}`);
                };
                return (
                  <NavItem key={item.key} item={item} isActive={isActive}
                    collapsed={collapsed} onPress={handlePress} />
                );
              })}
            </View>
          );
        })}

        {/* Admin section */}
        {role === 'admin' && (
          <View style={S.navSection}>
            {!collapsed && (
              <View style={S.adminSectionHeader}>
                <Text style={S.navSectionLabel}>QUẢN TRỊ</Text>
                <View style={S.adminBadge}><Text style={S.adminBadgeText}>ADMIN</Text></View>
              </View>
            )}
            <NavItem item={{ key: 'users', link: '(tabs)/users', label: 'Danh sách người dùng', icon: 'people-circle-outline', activeIcon: 'people-circle' }}
              isActive={isUsersActive} collapsed={collapsed}
              onPress={() => router.push('/(tabs)/user')} />
          </View>
        )}
      </ScrollView>

      {/* Bottom — User logout (giống profile card ở trên) */}
      <View style={S.bottomSection}>
        {showLogout && (
          <View style={S.logoutPopup}>
            <TouchableOpacity style={S.logoutItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={14} color="#F87171" />
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.userName} numberOfLines={1}>{userDetail?.name || 'User'}</Text>
                {/* ✅ Hiển thị role thay vì email */}
                <Text style={S.userRoleText} numberOfLines={1}>{roleLabel}</Text>
              </View>
              <Ionicons
                name={showLogout ? 'chevron-up' : 'ellipsis-horizontal'}
                size={14} color="rgba(255,255,255,0.5)"
              />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Mobile Tab Bar ────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation, isMobileWeb }) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    showAlert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', async () => {
      try { await signOut(auth); router.replace('/auth/signIn'); }
      catch (e) { showInfo('Lỗi', e.message); }
    });
    setShowMenu(false);
  };

  return (
    <View style={[M.tabBarWrap, isMobileWeb && M.tabBarWrapWeb]}>
      {showMenu && (
        <View style={M.logoutPopup}>
          <TouchableOpacity style={M.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={M.logoutBtnText}>Đăng xuất</Text>
          </TouchableOpacity>
          <TouchableOpacity style={M.logoutCancel} onPress={() => setShowMenu(false)}>
            <Text style={M.logoutCancelText}>Huỷ</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={M.tabBar}>
        {state.routes.map((route, index) => {
          const tab = MOBILE_TABS[index];
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          if (!tab) return null;
          return (
            <TouchableOpacity key={route.key}
              style={[M.tabItem, isFocused && M.activeTabItem]}
              onPress={onPress} activeOpacity={0.8}>
              <Ionicons name={isFocused ? tab.activeIcon : tab.icon} size={20}
                color={isFocused ? Colors.LightBlue : Colors.LightGray} style={M.icon} />
              <Text style={[M.tabLabel, isFocused && M.activeTabLabel]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={M.tabItem} onPress={() => setShowMenu(p => !p)} activeOpacity={0.8}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.LightGray} style={M.icon} />
          <Text style={M.tabLabel}>Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Root Layout ───────────────────────────────────────────────
export default function TabLayout() {
  const { userDetail } = useContext(UserDetailContext);
  const router = useRouter();
  const segments = useSegments();
  const [collapsed, setCollapsed] = useState(false);
  const { width } = useWindowDimensions();

  const { width: winWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winWidth >= DESKTOP_BREAKPOINT;
  const isMobileWeb = Platform.OS === 'web' && winWidth < DESKTOP_BREAKPOINT;

  const rawTab = segments[segments.length - 1] || 'home';

  // ✅ Map segment → nav key (tất cả đều trong tabs nên segment = tên file)
  const SEGMENT_KEY_MAP = {
    'customerctv': 'consult',
    'analytics': 'revenue',
    'regionreport': 'region',
    'regionAnalytics': 'region',
    'commission': 'commission',
    'users': 'users',
    'chatlist': 'chatList',
    'chatList': 'chatList',
    'information': 'information',
    'news': 'news',
    'editprofile': 'profile',
    'editProfile': 'profile',
    'orderContract': 'quotation',
    'ordercontract': 'quotation',
  };
  const activeTab = SEGMENT_KEY_MAP[rawTab] || rawTab;

  const pageLabel = NAV_SECTIONS.flatMap(s => s.items).find(n => n.key === activeTab)?.label || 'Tổng quan';
  const handleNavigate = (link) => router.push(`/${link}`);

  const tabScreens = [
    <Tabs.Screen key="home" name="home" />,
    <Tabs.Screen key="order" name="order" />,
    <Tabs.Screen key="customer" name="customer" />,
    <Tabs.Screen key="service" name="service" />,
    <Tabs.Screen key="leaderboard" name="leaderboard" />,
    <Tabs.Screen key="users" name="users" />,
    <Tabs.Screen key="customerctv" name="customerctv" />,
    <Tabs.Screen key="analytics" name="analytics" />,
    <Tabs.Screen key="commission" name="commission" />,
    <Tabs.Screen key="regionAnalytics" name="regionAnalytics" />,
    <Tabs.Screen key="news" name="news" />,
    <Tabs.Screen key="information" name="information" />,
    <Tabs.Screen key="chatList" name="chatList" />,
    <Tabs.Screen key="editProfile" name="editProfile" />,
    <Tabs.Screen key="calculator" name="calculator" />,
    <Tabs.Screen key="team" name="team" />,
  ];

  // ── Desktop Web ──────────────────────────────────────────
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
          {/* Topbar */}
          <View style={S.topBar}>
            <Image
              source={BANNER_IMAGE}
              style={[S.topBarBanner, { width: width }]}
              resizeMode="cover"
            />
            <View style={S.breadcrumb}>
              <Text style={S.breadcrumbRoot}>   SWD Seller</Text>
              <Ionicons name="chevron-forward" size={12} color="#fff" />
              <Text style={S.breadcrumbCurrent}>{pageLabel}</Text>
            </View>
            <View style={S.topBarActions}>
              <Pressable style={S.topBarBtn} onPress={() => router.push('/(tabs)/chatList')}>
                <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
              </Pressable>
              <NotificationPanel bellColor="#fff" bellSize={18} />
              <Pressable style={S.topBarBtn}>
                <Ionicons name="help-circle-outline" size={18} color="#fff" />
              </Pressable>
              <View style={S.topBarDivider} />
              <View style={S.topBarAvatar}>
                <Text style={S.topBarAvatarText}>{getInitials(userDetail?.name)}</Text>
              </View>
            </View>
          </View>
          {/* Content */}
          <View style={S.contentArea}>
            <Tabs tabBar={() => null} screenOptions={{ headerShown: false }}>
              {tabScreens}
            </Tabs>
          </View>
        </View>
      </View>
    );
  }

  // ── Mobile ───────────────────────────────────────────────
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} isMobileWeb={isMobileWeb} />}
      screenOptions={{ headerShown: false }}
    >
      {tabScreens}
    </Tabs>
  );
}

// ── Styles ────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC', height: '100vh' },
  icon: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  // Sidebar
  sidebar: { width: 240, backgroundColor: '#2C5282', paddingTop: 0, paddingBottom: 0, paddingHorizontal: 12, flexDirection: 'column', borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.15)' },
  sidebarCollapsed: { width: 64, paddingHorizontal: 8 },
  // Workspace row
  workspaceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 10 },
  workspaceName: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  workspaceText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  collapseBtn: { width: 22, height: 22, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Profile (unused at top, kept for reference)
  profileAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  profileAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  profileName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  profileRole: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  // Nav
  navSection: { marginBottom: 8 },
  navSectionLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, paddingHorizontal: 8, marginTop: 6 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, marginBottom: 1, gap: 0 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  navIconWrap: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  navIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  navLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', flex: 1 },
  navLabelActive: { color: '#fff', fontWeight: '700' },
  // Admin
  adminSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 4, marginTop: 6 },
  adminBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  // Bottom user
  bottomSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8, paddingBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.2)' },
  userAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  userName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  userRoleText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  logoutPopup: { backgroundColor: '#1E293B', borderRadius: 9, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  logoutItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  logoutItemText: { color: '#F87171', fontSize: 13, fontWeight: '600' },
  // Main area
  mainArea: { flex: 1, flexDirection: 'column', backgroundColor: '#F8FAFC' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)', overflow: 'hidden', paddingVertical: 10, paddingRight: 16 },
  topBarBanner: { position: 'absolute', height: 60, opacity: 1, backgroundColor: '#40668d' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbRoot: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  breadcrumbCurrent: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topBarBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  topBarDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 4 },
  topBarAvatar: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  topBarAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  contentArea: { flex: 1, overflow: 'hidden' },
});

const M = StyleSheet.create({
  tabBarWrap: { backgroundColor: 'transparent' },
  tabBarWrapWeb: { paddingBottom: 8, backgroundColor: '#F8FAFC' },
  tabBar: { flexDirection: 'row', marginHorizontal: 10, marginBottom: 10, backgroundColor: Colors.White, paddingVertical: 6, borderRadius: 50, borderWidth: 10, borderColor: Colors.White, shadowColor: Colors.Black, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 50 },
  activeTabItem: { borderWidth: 2, borderColor: Colors.Black, backgroundColor: Colors.Black },
  tabLabel: { color: Colors.LightGray, fontWeight: '600', textAlign: 'center', fontSize: 9, marginTop: 2 },
  activeTabLabel: { color: '#F8FAFC' },
  icon: { marginBottom: 2 },
  logoutPopup: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logoutBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  logoutCancel: { paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  logoutCancelText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
});