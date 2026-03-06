import { UserDetailContext } from '@/context/UserDetailContext';
import AntDesign from '@expo/vector-icons/AntDesign';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useContext } from 'react';

export default function TabLayout() {
    const { userDetail, setUserDetail } = useContext(UserDetailContext);
    if (Platform.OS === 'web') {
        // Use a basic custom layout on web.
        return (
            <div style={{ flex: 1 }}>
                <header>
                    <Link href="/">Home</Link>
                    <Link href="/settings">Settings</Link>
                </header>
                <Slot />
            </div>
        );
    }

    return (
        <Tabs>
            <Tabs.Screen name="home"
                options={{
                    title: "Trang chủ",
                    headerShown: false,
                    tabBarIcon: (color, size) => (
                        <Ionicons name="home" size={24} color={color} />
                    )
                }} />
            <Tabs.Screen name="order"
                options={{
                    title: "Đơn hàng",
                    headerShown: false,
                    tabBarIcon: (color, size) => (
                        <ion-icon name="receipt-outline" size={24} color={color} />
                    )
                }} />
            <Tabs.Screen name="customer"
                options={{
                    title: "Khách hàng",
                    headerShown: false,
                    tabBarIcon: (color, size) => (
                        <AntDesign name="people-outline" size={24} color={color} />
                    )
                }} />

            <Tabs.Screen name="laderboard"
                options={{
                    title: "Xếp hạng",
                    headerShown: false,
                    tabBarIcon: (color, size) => (
                        <AntDesign name="trophy" size={24} color={color} />
                    )
                }} />
            {/* {userDetail?.member=="true"?
    <Tabs.Screen name="member"
        options={{
          tabBarIcon: (color,size) => (
            <AntDesign name="user" size={24} color={color} />
          )
        }} />:console.log("no permission")} */}
        </Tabs>

    )
}