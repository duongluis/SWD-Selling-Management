import auth, { db } from "@/config/firebaseConfig";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { UserDetailContext } from "../context/UserDetailContext";

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
    const inPublic = PUBLIC_ROUTES.includes(segment);
    const isAdmin = userDetail?.role === 'admin' || userDetail?.member === 'admin';

    // ── Chưa đăng nhập ──────────────────────────────────────
    if (!userDetail) {
      if (!inPublic) router.replace('/auth/signIn');
      return;
    }

    // ── Có Auth nhưng chưa điền thông tin ───────────────────
    if (userDetail._incomplete) {
      router.replace('/auth/userInfo');
      return;
    }

    // ── Chưa xác thực (không phải admin) ────────────────────
    if (!userDetail.verified && !isAdmin) {
      if (segment !== 'auth') router.replace('/auth/pendingVerification');
      return;
    }

    // ── Chặn non-admin truy cập route admin ─────────────────
    const currentPath = segments.join('/');
    const accessingAdmin = ADMIN_ROUTES.some(r => currentPath.includes(r));
    if (accessingAdmin && !isAdmin) {
      console.warn('🚫 Truy cập trái phép:', currentPath);
      router.replace('/(tabs)/home');
      return;
    }

    // ── Đã xác thực đang ở trang auth → vào app ─────────────
    if (inPublic && segment === 'auth') {
      router.replace('/(tabs)/home');
    }

  }, [loaded, authChecked, userDetail, segments]);

  if (!loaded || !authChecked) return null;

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