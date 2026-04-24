import auth, { db } from "@/config/firebaseConfig";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from 'react-native';
import { UserDetailContext } from "../context/UserDetailContext";

SplashScreen.preventAutoHideAsync();

const PUBLIC_ROUTES = ['auth', 'index'];
const ADMIN_ROUTES = ['users'];

// 3 trạng thái rõ ràng thay vì null-ambiguous
// 'pending'        → chưa biết (Firebase đang kiểm tra)
// null             → chắc chắn chưa đăng nhập
// { ...userData }  → đã đăng nhập

export default function RootLayout() {
  const [userDetail, setUserDetail] = useState('pending'); // ← key change
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
            setUserDetail({ email: user.email, _incomplete: true });
          }
        } catch (e) {
          console.error("Lỗi lấy user:", e);
          setUserDetail(null);
        }
      } else {
        setUserDetail(null); // chắc chắn chưa đăng nhập
      }
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loaded || !authChecked) return;
    if (userDetail === 'pending') return;

    SplashScreen.hideAsync();

    const segment = segments[0] || '';

    // ✅ '' (root) cũng được coi là public
    const inPublic = !segment || PUBLIC_ROUTES.includes(segment);
    const isAdmin = userDetail?.role === 'admin' || userDetail?.member === 'admin';

    if (!userDetail) {
      if (!inPublic) router.replace('/auth/signIn');
      return;
    }

    if (userDetail._incomplete) {
      router.replace('/auth/userInfo');
      return;
    }

    if (!userDetail.verified && !isAdmin) {
      if (segment !== 'auth') router.replace('/auth/pendingVerification');
      return;
    }

    const currentPath = segments.join('/');
    const accessingAdmin = ADMIN_ROUTES.some(r => currentPath.includes(r));
    if (accessingAdmin && !isAdmin) {
      router.replace('/(tabs)/home');
      return;
    }

    if (inPublic) {
      router.replace('/(tabs)/home');
    }

  }, [loaded, authChecked, userDetail, segments]);

  // Loading screen — hiển thị khi font hoặc auth chưa xong
  if (!loaded || !authChecked || userDetail === 'pending') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

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