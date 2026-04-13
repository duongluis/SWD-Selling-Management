import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useContext } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

function CustomTabBar({ state, descriptors, navigation }) {
  const tabs = [
    { key: 'home',        label: 'TRANG CHỦ',    icon: 'home-outline'    },
    { key: 'order',       label: 'ĐƠN HÀNG',     icon: 'receipt-outline' },
    { key: 'customer',    label: 'KHÁCH HÀNG',   icon: 'people-outline'  },
    { key: 'leaderboard', label: 'BẢNG XẾP HẠNG', icon: 'trophy-outline' },
  ];

  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const tab = tabs[index];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={[styles.tabItem, isFocused && styles.activeTabItem]}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab?.icon}
              size={22}
              color={isFocused ? Colors.LightBlue : Colors.LightGray}
              style={styles.icon}
            />
            <Text style={[styles.tabLabel, isFocused && styles.activeTabLabel]}>
              {tab?.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { userDetail } = useContext(UserDetailContext);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="order" />
      <Tabs.Screen name="customer" />
      <Tabs.Screen name="leaderboard" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 10,
    marginBottom: 10,
    backgroundColor: Colors.White,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: Colors.White,
    shadowColor: Colors.Black,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 50,
  },
  activeTabItem: {
    borderWidth: 2,
    borderColor: Colors.LightBlue,
    backgroundColor: Colors.BlueSky,
  },
  tabLabel: {
    color: Colors.LightGray,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 10,
  },
  activeTabLabel: {
    color: Colors.Blue,
  },
  icon: {
    marginBottom: 2,
  },
});