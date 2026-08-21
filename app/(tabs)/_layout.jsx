// app/(tabs)/_layout.jsx
import NotificationPanel from '@/components/Main/notificationPanel';
import { showAlert } from '@/components/Main/showAlert';
import { showInfo } from '@/components/Main/showInfo';
import { useLayout } from '@/components/Main/TabScreenLayout';
import { getRole, getRoleLabel, isAdminOrGD } from '@/components/Utils/roleHelper';
import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image, Platform, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity,
  View
} from 'react-native';
import auth, { db } from '../../config/firebaseConfig';

// ── Help imports ──────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import FirstTimeHelpTooltip from '../../components/Help/firstTimeHelp';
import HelpModal from '../../components/Help/helpModal';

const HELP_SEEN_KEY = '@swd_help_tooltip_seen';
const BANNER_IMAGE = require('../../assets/images/layout-img.png');


function getInitials(name) {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Nav config ─────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'CHÍNH',
    items: [
      { key: 'home', link: '(tabs)/home', label: 'Trang chủ', icon: 'home-outline', activeIcon: 'home', visible: () => true },
      { key: 'customer', link: '(tabs)/customer', label: 'Khách hàng', icon: 'people-outline', activeIcon: 'people', visible: (r) => r !== 'ctv' },
      { key: 'consult', link: '(tabs)/customerctv', label: 'Giới thiệu khách', icon: 'person-add-outline', activeIcon: 'person-add', visible: (r) => r !== 'sale' },
      { key: 'order', link: '(tabs)/order', label: 'Đơn hàng', icon: 'receipt-outline', activeIcon: 'receipt', visible: () => true },
      { key: 'service', link: '(tabs)/service', label: 'Dịch vụ', icon: 'build-outline', activeIcon: 'build', visible: (r) => r !== 'ctv' },
      { key: 'team', link: '(tabs)/team', label: 'Đội ngũ', icon: 'people-outline', activeIcon: 'people', },
    ],
  },
  {
    label: 'TIỆN ÍCH',
    items: [
      { key: 'leaderboard', link: '(tabs)/leaderboard', label: 'Bảng xếp hạng', icon: 'trophy-outline', activeIcon: 'trophy', visible: (r) => r === 'admin' },
      { key: 'commission', link: '(tabs)/commission', label: 'Hoa hồng', icon: 'cash-outline', activeIcon: 'cash' },
      { key: 'revenue', link: '(tabs)/analytics', label: 'Báo cáo doanh thu', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
      { key: 'region', link: '(tabs)/regionAnalytics', label: 'Báo cáo khu vực', icon: 'map-outline', activeIcon: 'map' },
      { key: 'news', link: '(tabs)/news', label: 'Tin tức', icon: 'newspaper-outline', activeIcon: 'newspaper', visible: () => true },
      { key: 'information', link: '(tabs)/information', label: 'Bảng giá', icon: 'pricetag-outline', activeIcon: 'pricetag', visible: () => true },
      { key: 'quotation', link: 'orderContract?mode=template', label: 'Form báo giá', icon: 'document-text-outline', activeIcon: 'document-text', visible: () => true },
      { key: 'calculator', link: '(tabs)/calculator', label: 'Tính toán', icon: 'calculator-outline', activeIcon: 'calculator' },
    ],
  },
  {
    label: 'HỖ TRỢ',
    items: [
      { key: 'chatList', link: '(tabs)/chatList', label: 'Phòng Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', visible: (r) => r !== 'giamdoc' },
      { key: 'profile', link: '(tabs)/editProfile', label: 'Thông tin cá nhân', icon: 'person-circle-outline', activeIcon: 'person-circle', visible: () => true },
    ],
  },
];

const MOBILE_BOTTOM_TABS = [
  { key: 'home', link: '(tabs)/home', label: 'TRANG CHỦ', icon: 'home-outline', activeIcon: 'home' },
  { key: 'order', link: '(tabs)/order', label: 'ĐƠN HÀNG', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'customer', link: '(tabs)/customer', label: 'KHÁCH', icon: 'people-outline', activeIcon: 'people' },
  { key: 'service', link: '(tabs)/service', label: 'DỊCH VỤ', icon: 'build-outline', activeIcon: 'build' },
];

// ── useHelpGuide hook ─────────────────────────────────────────
// Quản lý toàn bộ state của hệ thống hướng dẫn
function useHelpGuide(activeTab) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  // Ref để tránh tooltip hiện lại trong cùng session sau khi đã dismiss
  const tooltipDismissedThisSession = useRef(false);

  // Kiểm tra lần đầu mở app
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const seen = await AsyncStorage.getItem(HELP_SEEN_KEY);
        if (!seen) {
          // Delay nhỏ để layout ổn định trước khi hiện tooltip
          setTimeout(() => setTooltipVisible(true), 1200);
        }
      } catch (_) {
        // AsyncStorage lỗi → bỏ qua, không crash app
      }
    };
    checkFirstTime();
  }, []);

  const openHelp = useCallback(() => {
    setHelpVisible(true);
  }, []);

  const closeHelp = useCallback(() => {
    setHelpVisible(false);
  }, []);

  const dismissTooltip = useCallback(async () => {
    if (tooltipDismissedThisSession.current) return;
    tooltipDismissedThisSession.current = true;
    setTooltipVisible(false);
    try {
      await AsyncStorage.setItem(HELP_SEEN_KEY, '1');
    } catch (_) { }
  }, []);

  return { helpVisible, openHelp, closeHelp, tooltipVisible, dismissTooltip };
}

// ── Shared NavItem ────────────────────────────────────────────
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

// ── Shared sidebar content ────────────────────────────────────
function SidebarContent({ activeTab, role, userDetail, collapsed, onNavigate, isAdvisor, router, onClose }) {
  const [showLogout, setShowLogout] = useState(false);
  const roleLabel = getRoleLabel(role);

  const shouldShowItem = (item) => {
    const gd = role === 'giamdoc';
    const admin = role === 'admin';

    if (item.visible) return item.visible(role);

    if (item.key === 'commission' || item.key === 'calculator') {
      if (gd) return true;
      if (userDetail?.advisor) return false;
      if (role === 'daily') return false;
      return role === 'admin' || role === 'phantan' || role === 'ctv' || role === 'sale';
    }

    if (item.key === 'team') {
      if (gd) return true;
      if (userDetail?.advisor) return true;
      if (isAdvisor) return true;
      if (admin) return true;
      return false;
    }

    if (item.key === 'leaderboard') {
      if (gd) return true;
      if (userDetail?.advisor) return false;
      return true;
    }

    if (item.key === 'revenue') {
      if (gd) return true;
      if (userDetail?.advisor) return false;
      return true;
    }

    if (item.key === 'region') {
      return role === 'admin' || gd;
    }

    return role === 'admin' || gd;
  };

  const handleNav = (item) => {
    onClose?.();
    if (item.link.startsWith('(tabs)/')) onNavigate(item.link);
    else if (item.link.includes('?')) router.push(`/${item.link.split('?')[0]}?${item.link.split('?')[1]}`);
    else router.push(`/${item.link}`);
  };

  const handleLogout = () => {
    showAlert('Đăng xuất', 'Bạn có chắc muốn đăng xuất ?', async () => {
      try { await signOut(auth); router.replace('/auth/signIn'); }
      catch (e) { showInfo('Lỗi', e.message); }
    });
    setShowLogout(false);
  };

  return (
    <>
      <View style={S.workspaceRow}>
        {!collapsed && (
          <View style={S.workspaceName}>
            <Image style={S.icon} source={require('../../assets/images/logo-dark.png')} resizeMode="contain" />
            <Text style={S.workspaceText}>SWD CRM</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(shouldShowItem);
          if (!visibleItems.length) return null;
          return (
            <View key={section.label} style={S.navSection}>
              {!collapsed && <Text style={S.navSectionLabel}>{section.label}</Text>}
              {visibleItems.map(item => (
                <NavItem
                  key={item.key}
                  item={item}
                  isActive={activeTab === item.key}
                  collapsed={collapsed}
                  onPress={() => handleNav(item)}
                />
              ))}
            </View>
          );
        })}

        {isAdminOrGD(role) && (
          <View style={S.navSection}>
            {!collapsed && (
              <View style={S.adminSectionHeader}>
                <Text style={S.navSectionLabel}>QUẢN TRỊ</Text>
                <View style={S.adminBadge}><Text style={S.adminBadgeText}>ADMIN</Text></View>
              </View>
            )}
            <NavItem
              item={{ key: 'user', link: '(tabs)/user', label: 'Danh sách người dùng', icon: 'people-circle-outline', activeIcon: 'people-circle' }}
              isActive={activeTab === 'user'}
              collapsed={collapsed}
              onPress={() => { onClose?.(); router.push('/(tabs)/user'); }}
            />
          </View>
        )}
      </ScrollView>

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
                <Text style={S.userRoleText} numberOfLines={1}>{roleLabel}</Text>
              </View>
              <Ionicons name={showLogout ? 'chevron-up' : 'arrow-forward'} size={14} color="rgba(255,255,255,0.5)" />
            </>
          )}
        </Pressable>
      </View>
    </>
  );
}

// ── Desktop Sidebar ───────────────────────────────────────────
function DesktopSidebar({ activeTab, role, userDetail, collapsed, onToggle, isAdvisor, onNavigate, router }) {
  return (
    <View style={[S.sidebar, collapsed && S.sidebarCollapsed]}>
      <Pressable onPress={onToggle} style={S.collapseBtn}>
        <Ionicons name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'} size={20} color="rgba(255,255,255,0.5)" />
      </Pressable>
      <SidebarContent
        activeTab={activeTab}
        role={role}
        userDetail={userDetail}
        collapsed={collapsed}
        onNavigate={onNavigate}
        isAdvisor={isAdvisor}
        router={router}
      />
    </View>
  );
}

// ── Mobile Drawer ─────────────────────────────────────────────
function MobileDrawer({ visible, activeTab, role, userDetail, onNavigate, isAdvisor, router, onClose }) {
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 100, flexDirection: 'row' }]}>
      <Pressable style={MD.overlay} onPress={onClose} />
      <View style={MD.drawer}>
        <SidebarContent
          activeTab={activeTab}
          role={role}
          userDetail={userDetail}
          collapsed={false}
          onNavigate={onNavigate}
          isAdvisor={isAdvisor}
          router={router}
          onClose={onClose}
        />
      </View>
    </View>
  );
}

const MD = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 240,
    backgroundColor: '#2C5282',
    paddingHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 0,
    flexDirection: 'column',
    zIndex: 101,
  },
});

// ── Mobile Top Bar ────────────────────────────────────────────
// Không còn nút Help ở đây — Help Modal chỉ dành cho desktop
function MobileTopBar({ pageLabel, userDetail, onMenuPress, router, role }) {
  return (
    <View style={MB.topBar}>
      <Image source={BANNER_IMAGE} style={MB.topBarBanner} resizeMode="cover" />
      <View style={MB.topBarLeft}>
        <TouchableOpacity style={MB.menuBtn} onPress={onMenuPress}>
          <Ionicons name="menu-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={MB.topBarTitle} numberOfLines={1}>{pageLabel}</Text>
      </View>
      <View style={MB.topBarRight}>
        {role !== 'giamdoc' && (
          <>
            <TouchableOpacity style={MB.topBarBtn} onPress={() => router.push('/(tabs)/chatList')}>
              <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <NotificationPanel bellColor="#fff" bellSize={18} />
          </>
        )}

        <View style={MB.topBarAvatar}>
          <Text style={MB.topBarAvatarText}>{getInitials(userDetail?.name)}</Text>
        </View>
      </View>
    </View>
  );
}

const MB = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12,
    overflow: 'hidden', minHeight: 52,
    backgroundColor: '#40668d',
  },
  topBarBanner: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%', opacity: 1 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  menuBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  topBarTitle: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topBarBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  topBarAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  topBarAvatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

// ── Mobile Tab Bar ─────────────────────────────────────────────
function MobileTabBar({ state, navigation, activeKey }) {
  return (
    <View style={BT.wrap}>
      <View style={BT.bar}>
        {MOBILE_BOTTOM_TABS.map((tab) => {
          const route = state.routes.find(r => r.name === tab.key || r.name === tab.link.replace('(tabs)/', ''));
          const routeIndex = state.routes.findIndex(r => r.name === route?.name);
          const isFocused = activeKey === tab.key || state.index === routeIndex;

          const onPress = () => {
            if (route) {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={tab.key}
              style={[BT.item, isFocused && BT.itemActive]}
              onPress={onPress}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFocused ? tab.activeIcon : tab.icon}
                size={20}
                color={isFocused ? Colors.LightBlue || '#fff' : Colors.LightGray || '#94A3B8'}
                style={BT.icon}
              />
              <Text style={[BT.label, isFocused && BT.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const BT = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 16 : 0 },
  bar: {
    flexDirection: 'row', marginHorizontal: 10, marginVertical: 6,
    backgroundColor: Colors.White || '#fff',
    paddingVertical: 4, borderRadius: 50,
    borderWidth: 8, borderColor: Colors.White || '#fff',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 50 },
  itemActive: { borderWidth: 2, borderColor: Colors.Black || '#0F172A', backgroundColor: Colors.Black || '#0F172A' },
  icon: { marginBottom: 2 },
  label: { color: Colors.LightGray || '#94A3B8', fontWeight: '600', textAlign: 'center', fontSize: 9, marginTop: 1, letterSpacing: 0.3 },
  labelActive: { color: '#F8FAFC' },
});

// ── Tab Screens ────────────────────────────────────────────────
const TAB_SCREENS = [
  'home', 'order', 'customer', 'service', 'leaderboard', 'user',
  'customerctv', 'analytics', 'commission', 'regionAnalytics',
  'news', 'information', 'chatList', 'editProfile', 'calculator', 'team',
];

const SEGMENT_KEY_MAP = {
  customerctv: 'consult', analytics: 'revenue', regionreport: 'region',
  regionAnalytics: 'region', commission: 'commission', users: 'users',
  chatlist: 'chatList', chatList: 'chatList', information: 'information',
  news: 'news', editprofile: 'profile', editProfile: 'profile',
  orderContract: 'quotation', ordercontract: 'quotation',
};

// ── Root Layout ────────────────────────────────────────────────
export default function TabLayout() {
  const { userDetail } = useContext(UserDetailContext);
  const router = useRouter();
  const segments = useSegments();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const width = Dimensions.get('window').width;
  const { isDesktop } = useLayout();
  const role = getRole(userDetail);

  const rawTab = segments[segments.length - 1] || 'home';
  const activeTab = SEGMENT_KEY_MAP[rawTab] || rawTab;
  const pageLabel = NAV_SECTIONS.flatMap(s => s.items).find(n => n.key === activeTab)?.label || 'Tổng quan';
  const [isAdvisor, setIsAdvisor] = useState(false);

  // ── Help state ────────────────────────────────────────────────
  const { helpVisible, openHelp, closeHelp, tooltipVisible, dismissTooltip } = useHelpGuide(activeTab);

  const handleNavigate = (link) => router.push(`/${link}`);

  const tabScreens = TAB_SCREENS.map(name => (
    <Tabs.Screen key={name} name={name} />
  ));

  useEffect(() => {
    if (!userDetail?.email) return;
    const q = query(collection(db, 'users'), where('advisor', '==', userDetail.email));
    const unsub = onSnapshot(q, (snap) => setIsAdvisor(!snap.empty));
    return () => unsub();
  }, [userDetail?.email]);

  return (
    <View style={isDesktop ? S.root : { flex: 1 }}>

      {/* Sidebar desktop */}
      {isDesktop && (
        <DesktopSidebar
          activeTab={activeTab}
          role={role}
          userDetail={userDetail}
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          onNavigate={handleNavigate}
          isAdvisor={isAdvisor}
          router={router}
        />
      )}

      <View style={isDesktop ? S.mainArea : { flex: 1 }}>

        {/* ── Desktop topbar ── */}
        {isDesktop && (
          <View style={S.topBar}>
            <Image source={BANNER_IMAGE} style={[S.topBarBanner, { width }]} resizeMode="cover" />
            <View style={S.breadcrumb}>
              <Text style={S.breadcrumbRoot}> SWD CRM</Text>
              <Ionicons name="chevron-forward" size={12} color="#fff" />
              <Text style={S.breadcrumbCurrent}>{pageLabel}</Text>
            </View>
            <View style={S.topBarActions}>
              {role !== 'giamdoc' && (
                <>
                  <Pressable style={S.topBarBtn} onPress={() => router.push('/(tabs)/chatList')}>
                    <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
                  </Pressable>
                  <NotificationPanel bellColor="#fff" bellSize={22} />
                </>
              )}

              {/* ── Nút Help (desktop) — wrap bằng View để định vị tooltip ── */}
              <View style={{ position: 'relative' }}>
                <Pressable style={S.topBarBtn} onPress={openHelp}>
                  <Ionicons name="help-circle-outline" size={18} color="#fff" />
                </Pressable>
                {/* Tooltip lần đầu — chỉ hiện trên desktop */}
                <FirstTimeHelpTooltip visible={tooltipVisible} onDismiss={dismissTooltip} />
              </View>

              <View style={S.topBarDivider} />
              <View style={S.topBarAvatar}>
                <Text style={S.topBarAvatarText}>{getInitials(userDetail?.name)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Mobile drawer */}
        {!isDesktop && (
          <MobileDrawer
            visible={drawerOpen}
            activeTab={activeTab}
            role={role}
            userDetail={userDetail}
            onNavigate={handleNavigate}
            isAdvisor={isAdvisor}
            router={router}
            onClose={() => setDrawerOpen(false)}
          />
        )}

        {/* Tabs */}
        <Tabs
          tabBar={(props) =>
            isDesktop ? null : <MobileTabBar {...props} activeKey={activeTab} />
          }
          screenOptions={{ headerShown: false }}
        >
          {tabScreens}
        </Tabs>

        {/* ── Mobile topbar float ── */}
        {!isDesktop && (
          <View style={[S.mobileTopBarWrap, { pointerEvents: 'box-none' }]}>
            <MobileTopBar
              pageLabel={pageLabel}
              userDetail={userDetail}
              onMenuPress={() => setDrawerOpen(true)}
              router={router}
              role={role}
            />
          </View>
        )}

      </View>

      {/* ── Help Modal — render ngoài cùng để nổi lên trên tất cả ── */}
      <HelpModal
        visible={helpVisible}
        screenKey={activeTab}
        onClose={closeHelp}
      />

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC', height: '100vh' },
  icon: { width: 28, height: 28, marginRight: 8 },

  sidebar: { width: 240, backgroundColor: '#2C5282', paddingTop: 0, paddingBottom: 0, paddingHorizontal: 12, flexDirection: 'column', borderRightWidth: 1, borderRightColor: 'rgba(0,0,0,0.15)' },
  sidebarCollapsed: { width: 64, paddingHorizontal: 8 },
  collapseBtn: { position: 'absolute', top: 15, right: 25, width: 25, height: 25, borderRadius: 15, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  workspaceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 10 },
  workspaceName: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  workspaceText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },

  navSection: { marginBottom: 8 },
  navSectionLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4, paddingHorizontal: 8, marginTop: 6 },
  navItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, marginBottom: 1 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  navIconWrap: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  navIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  navLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500', flex: 1 },
  navLabelActive: { color: '#fff', fontWeight: '700' },

  adminSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 4, marginTop: 6 },
  adminBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  bottomSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8, paddingBottom: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.2)' },
  userAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  userName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  userRoleText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  logoutPopup: { backgroundColor: '#1E293B', borderRadius: 9, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  logoutItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  logoutItemText: { color: '#F87171', fontSize: 13, fontWeight: '600' },

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

  mobileTopBarWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
  },
});