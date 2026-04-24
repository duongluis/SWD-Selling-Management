import auth, { db } from "@/config/firebaseConfig";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from 'react-native';
import { UserDetailContext } from "../context/UserDetailContext";

SplashScreen.preventAutoHideAsync();

// ── Session flag helpers (sessionStorage on web, module var on native) ──
// Cờ này bị XÓA khi reload trang → phân biệt "vừa đăng ký" vs "reload"
const SESSION_KEY = 'swd_reg_pending';
let _nativeRegPending = false; // fallback cho React Native

export const markRegistrationPending = () => {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, '1');
  } else {
    _nativeRegPending = true;
  }
};

export const clearRegistrationPending = () => {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    _nativeRegPending = false;
  }
};

const isRegistrationPending = () => {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }
  return _nativeRegPending;
};

SplashScreen.preventAutoHideAsync();

// ── Route groups ─────────────────────────────────────────────
const PUBLIC_ROUTES = ['auth', 'index'];          // ai cũng vào được
const ADMIN_ROUTES = ['users'];                   // chỉ admin
const APP_ROUTES = ['(tabs)', 'addOrder', 'addCustomer',
  'addService', 'CustomerView', 'ServiceView',
  'OrderView', 'revenue', 'information'];

export default function RootLayout() {
  const [userDetail, setUserDetail] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  const [loaded] = useFonts({
    Ionicons: require("./../assets/fonts/Ionicons.ttf"),
    outfit: require("./../assets/fonts/Oswald-Regular.ttf"),
    "outfit-bold": require("./../assets/fonts/Oswald-Bold.ttf"),
    "outfit-light": require("./../assets/fonts/Oswald-Bold.ttf"),
  });

  // ── Auth state listener ───────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.email));
          if (snap.exists()) {
            setUserDetail(snap.data());
          } else {
            // Auth có nhưng chưa điền thông tin (bỏ dở bước 2)
            setUserDetail({ email: user.email, _incomplete: true });
          }
        } catch (e) {
          console.error("Lỗi lấy user:", e);
          setUserDetail(null);
        }
      } else {
        setUserDetail(null);
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // ── Redirect logic ────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !authChecked) return;
    SplashScreen.hideAsync();

    const segment = segments[0] || '';
    const fullPath = segments.join('/');
    const isAdmin = userDetail?.role === 'admin' || userDetail?.member === 'admin';

    // Các route không cần redirect khi chưa đăng nhập
    const ALLOW_UNAUTHENTICATED = [
      'index', '',          // màn landing
      'auth/signIn',        // đăng nhập
      'auth/signUp',        // đăng ký
    ];
    const isAllowedUnauthenticated =
      ALLOW_UNAUTHENTICATED.includes(segment) ||
      ALLOW_UNAUTHENTICATED.includes(fullPath);

    // ── Chưa đăng nhập ──────────────────────────────────────
    // Luôn về index, trừ khi đang ở signIn/signUp
    if (!userDetail) {
      if (!isAllowedUnauthenticated) router.replace('/');
      return;
    }

    // ── Có Auth nhưng chưa điền thông tin ───────────────────
    if (userDetail._incomplete) {
      if (isRegistrationPending()) {
        // Vừa đăng ký trong session này → vào userInfo
        router.replace('/auth/userInfo');
      } else {
        // Reload trang / session cũ → navigate trước, signOut sau
        // (nếu signOut trước, guard sẽ chạy lại với null và override navigation)
        router.replace('/auth/signIn');
        signOut(auth);
      }
      return;
    }

    // ── Chưa xác thực (không phải admin) ────────────────────
    if (!userDetail.verified && !isAdmin) {
      if (segment !== 'auth') router.replace('/auth/pendingVerification');
      return;
    }

    // ── Chặn non-admin truy cập route admin ─────────────────
    const accessingAdmin = ADMIN_ROUTES.some(r => fullPath.includes(r));
    if (accessingAdmin && !isAdmin) {
      console.warn('🚫 Truy cập trái phép:', fullPath);
      router.replace('/(tabs)/home');
      return;
    }

    // ── Đã xác thực đang ở trang auth/index → vào app ───────
    if (segment === 'auth' || segment === 'index' || segment === '') {
      router.replace('/(tabs)/home');
    }

  }, [loaded, authChecked, userDetail, segments]);

  if (!loaded || !authChecked) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );

  return (
    <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </UserDetailContext.Provider>
  );
}