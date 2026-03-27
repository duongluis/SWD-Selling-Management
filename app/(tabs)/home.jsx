import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../../constant/Colors';

export default function HomeView() {
  const router = useRouter();
  const screenWidth = Dimensions.get('window').width;

  const { userDetail, setUserDetail } = useContext(UserDetailContext)

  useEffect(() =>{
    console.log("userDetail: ",userDetail)
  },[])

  const quickActions = [
    { name: 'New Order', icon: 'cart-outline', action: () => {console.log("Hello World")}},
    { name: 'Customer', icon: 'person-add-outline', action: () => {router.push("/addCustomer")} },
    { name: 'Report', icon: 'podium-outline', action: () => {console.log("Hello World")} },
    { name: 'Staff', icon: 'people-outline', action: () => {console.log("Hello World")}},
  ];

  const recentActivities = [
    {
      id: '1',
      icon: 'checkmark-circle',
      iconColor: '#4CAF50',
      iconBg: '#E8F5E9',
      title: 'Order #8492 Paid',
      detail: 'Received $420.00 from Sarah J.',
      time: '2m ago',
    },
    {
      id: '2',
      icon: 'receipt-outline',
      iconColor: Colors.LightBlue ?? '#4FC3F7',
      iconBg: '#E3F2FD',
      title: 'New Order Received',
      detail: '3 items from Michael Chen',
      time: '15m ago',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color="#fff" />
          </View>
          <View>
            <Text style={styles.dashboardLabel}>DASHBOARD</Text>
            <Text style={styles.userName}>{userDetail.name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Daily Summary Label */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>DAILY SUMMARY</Text>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE UPDATES</Text>
        </View>
      </View>

      {/* Sales Card */}
      <View style={styles.salesCard}>
        <View style={styles.salesCardTopRow}>
          <Text style={styles.salesCardLabel}>Total Sales Today</Text>
          <Ionicons name="stats-chart-outline" size={18} color="rgba(255,255,255,0.7)" />
        </View>
        <Text style={styles.salesAmount}>$12,840.50</Text>
        <View style={styles.percentBadge}>
          <Ionicons name="trending-up-outline" size={13} color="#fff" />
          <Text style={styles.percentText}> +12.4% vs yesterday</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={styles.statIconWrap}>
            <Ionicons name="receipt-outline" size={18} color={Colors.LightBlue ?? '#4FC3F7'} />
          </View>
          <Text style={styles.statNumber}>48</Text>
          <Text style={styles.statLabel}>NEW ORDERS</Text>
        </View>
        <View style={[styles.statBox, { marginLeft: 12 }]}>
          <View style={styles.statIconWrap}>
            <Ionicons name="people-outline" size={18} color={Colors.LightBlue ?? '#4FC3F7'} />
          </View>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>NEW CUSTOMERS</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          {quickActions.map((action) => (
            <View key={action.name} style={styles.actionItem}>
              <TouchableOpacity style={styles.actionButton}
               onPress = {action.action}
               >
                <Ionicons name={action.icon} size={22} color={Colors.LightBlue ?? '#4FC3F7'} />            
              </TouchableOpacity>
              <Text style={styles.actionText}>{action.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Activities */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITIES</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentActivities.map((item) => (
          <View key={item.id} style={styles.activityItem}>
            <View style={[styles.activityIconWrap, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.icon} size={20} color={item.iconColor} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityDetail}>{item.detail}</Text>
            </View>
            <Text style={styles.activityTime}>{item.time}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Dimensions.get('window').width,
    height:Dimensions.get('screen').height,
    flex: 1,
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 16,
    paddingTop: 30,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#B0BEC5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dashboardLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9E9E9E',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 0.5,
  },

  // Sales Card
  salesCard: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#2196F3',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  salesCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  salesCardLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  salesAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  percentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  percentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Quick Actions
  section: {
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButton: {
    backgroundColor: '#fff',
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
  },

  // Recent Activities
  viewAll: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  activityItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  activityDetail: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  activityTime: {
    fontSize: 11,
    color: '#9E9E9E',
    fontWeight: '500',
  },
});
