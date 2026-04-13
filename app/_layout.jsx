import auth, { db } from '@/config/firebaseConfig';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { UserDetailContext } from '../context/UserDetailContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [userDetail, setUserDetail] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  const [loaded] = useFonts({
    'Ionicons':     require('./../assets/fonts/Ionicons.ttf'),
    'outfit':       require('./../assets/fonts/Oswald-Regular.ttf'),
    'outfit-bold':  require('./../assets/fonts/Oswald-Bold.ttf'),
    'outfit-light': require('./../assets/fonts/Oswald-Bold.ttf'),
  });

  // ✅ Kiểm tra trạng thái đăng nhập khi app mở
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // ✅ Lấy thông tin user từ Firestore
          const snap = await getDoc(doc(db, 'users', user.email));
          if (snap.exists()) {
            setUserDetail(snap.data());
            console.log('✅ Đã đăng nhập:', snap.data().name);
          }
        } catch (e) {
          console.error('Lỗi lấy user:', e);
        }
      } else {
        
        setUserDetail(null);
        console.log('Chưa đăng nhập');
      }
      setAuthChecked(true);
    });

    return () => unsub(); // cleanup
  }, []);

 
  useEffect(() => {
    if (!loaded || !authChecked) return;

    SplashScreen.hideAsync();

    if (userDetail) {
      router.replace('/(tabs)/home'); 
        } else {
      // router.replace('/index');
      console.log("Chua co tai khoan")       ;
    }
  }, [loaded, authChecked, userDetail]);

  if (!loaded || !authChecked) return null;

  return (
    <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </UserDetailContext.Provider>
  );
}