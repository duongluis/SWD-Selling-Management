import CustomerView from '@/app/(tabs)/customer';
import HomeView from '@/app/(tabs)/home';
import LeaderboardView from '@/app/(tabs)/leaderboard';
import OrderView from '@/app/(tabs)/order';
import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TabLayout() {

    const { userDetail, setUserDetail } = useContext(UserDetailContext);
    const router = useRouter()
    const tabs = [
        { key: 'home', label: 'HOME', icon: "home-outline" },
        { key: 'orders', label: 'ORDER', icon: "receipt-outline" },
        { key: 'customers', label: 'CUSTOMER', icon: "people-outline" },
        { key: 'leaderboard', label: 'LEADERBOARD', icon: "trophy-outline" },
    ];

    const [activeTab, setActiveTab] = useState('home');
    const { width } = Dimensions.get('window');

    const [translateX] = useState(new Animated.Value(0));

    const handlePress = (index, key) => {
        setActiveTab(key);
        Animated.spring(translateX, {
            toValue: index * (width / tabs.length),
            useNativeDriver: true,
        }).start();
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {activeTab === 'home' && <HomeView/>}
                {activeTab === 'orders' && <OrderView/>}
                {activeTab === 'customers' && <CustomerView/>}
                {activeTab === 'leaderboard' && <LeaderboardView/>}
            </View>

            <View style={styles.tabBar}>
                {tabs.map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tabItem,
                            activeTab === tab.key && styles.activeTabItem,
                        ]}
                        onPress={() => {
                            handlePress(index, tab.key)

                        }}>

                        <Ionicons
                            style={styles.icon}
                            name={tab.icon}
                            size={30}
                            color={activeTab === tab.key ? Colors.LightBlue : Colors.LightGray}
                        />
                        <Text
                            style={[
                                styles.tabLabel,
                                activeTab === tab.key && styles.activeTabLabel,
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignContent: 'center',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',

    },
    tabBar: {
        flexDirection: 'row',
        marginLeft: 10,
        marginRight: 10,
        backgroundColor: Colors.White,
        borderTopWidth: 1,
        borderColor: Colors.White,
        paddingVertical: 6,
        borderRadius: 50,
        borderWidth: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        flexDirection: 'column',
        paddingVertical: 5,
        borderRadius: 5,
        borderRadius: 50,
    },
    activeTabItem: {
        borderWidth: 2,
        borderColor: Colors.LightBlue,
        backgroundColor: Colors.BlueSky,
    },
    tabLabel: {
        color: Colors.LightGray,
        justifyContent: 'center',
        alignItems: 'center',
        fontWeight: '600',
        fontFamily: 'Arial',
        textAlign: 'center',
        fontSize: 10,
    },
    activeTabLabel: {
        color: Colors.Blue,
    },
    icon: {
        fontSize: 20,
        marginBottom: 2,
    },
});