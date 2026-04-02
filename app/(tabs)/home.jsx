import Colors from '@/constant/Colors';
import { UserDetailContext } from '@/context/UserDetailContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useEffect } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeView() {
  const router = useRouter();
  const { userDetail } = useContext(UserDetailContext);

  useEffect(() => { console.log('userDetail:', userDetail); }, []);

  const quickActions = [
    { name: 'New Order', icon: 'cart-outline', action: () => router.push('/addOrder') },
    { name: 'Customer', icon: 'person-add-outline', action: () => router.push('/addCustomer') },
    { name: 'Report', icon: 'podium-outline', action: () => console.log('Report') },
    { name: 'Staff', icon: 'people-outline', action: () => console.log('Staff') },
  ];

  const recentActivities = [
    { id: '1', icon: 'checkmark-circle', iconColor: Colors.Success, iconBg: Colors.SuccessLight, title: 'Order #8492 Paid', detail: 'Received $420.00 from Sarah J.', time: '2m ago' },
    { id: '2', icon: 'receipt-outline', iconColor: Colors.LightBlue, iconBg: Colors.PrimaryLight, title: 'New Order Received', detail: '3 items from Michael Chen', time: '15m ago' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={Colors.White} />
          </View>
          <View>
            <Text style={styles.dashboardLabel}>DASHBOARD</Text>
            <Text style={styles.userName}>{userDetail?.name}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={22} color={Colors.TextPrimary} />
        </TouchableOpacity>
      </View>

      {/* Daily Summary */}
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
          <Ionicons name="trending-up-outline" size={13} color={Colors.White} />
          <Text style={styles.percentText}> +12.4% vs yesterday</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { icon: 'receipt-outline', number: '48', label: 'NEW ORDERS' },
          { icon: 'people-outline', number: '12', label: 'NEW CUSTOMERS' },
        ].map((s, i) => (
          <View key={s.label} style={[styles.statBox, i > 0 && { marginLeft: 12 }]}>
            <Ionicons name={s.icon} size={18} color={Colors.LightBlue} style={styles.statIconWrap} />
            <Text style={styles.statNumber}>{s.number}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsRow}>
          {quickActions.map((action) => (
            <View key={action.name} style={styles.actionItem}>
              <TouchableOpacity style={styles.actionButton} onPress={action.action}>
                <Ionicons name={action.icon} size={22} color={Colors.LightBlue} />
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
          <TouchableOpacity><Text style={styles.viewAll}>View All</Text></TouchableOpacity>
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
  container: { flex: 1, width: Dimensions.get('window').width, backgroundColor: Colors.Background, paddingHorizontal: 16, paddingTop: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#B0BEC5', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dashboardLabel: { fontSize: 10, fontWeight: '600', color: Colors.Gray, letterSpacing: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: Colors.TextPrimary },
  bellButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.White, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.Black, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.Gray, letterSpacing: 1 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.Success, marginRight: 4 },
  liveText: { fontSize: 11, fontWeight: '700', color: Colors.Success, letterSpacing: 0.5 },
  salesCard: { backgroundColor: Colors.Primary, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: Colors.Primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  salesCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  salesCardLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  salesAmount: { color: Colors.White, fontSize: 32, fontWeight: '800', marginBottom: 12, letterSpacing: -0.5 },
  percentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  percentText: { color: Colors.White, fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: Colors.White, padding: 14, borderRadius: 12, shadowColor: Colors.Black, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statIconWrap: { marginBottom: 8 },
  statNumber: { fontSize: 26, fontWeight: '800', color: Colors.TextPrimary },
  statLabel: { fontSize: 10, fontWeight: '700', color: Colors.Gray, letterSpacing: 0.5, marginTop: 2 },
  section: { marginBottom: 20 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  actionItem: { flex: 1, alignItems: 'center', marginHorizontal: 4 },
  actionButton: { backgroundColor: Colors.White, width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.Black, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 6 },
  actionText: { fontSize: 10, fontWeight: '600', color: Colors.TextSecondary, textAlign: 'center' },
  viewAll: { fontSize: 12, fontWeight: '600', color: Colors.Primary },
  activityItem: { backgroundColor: Colors.White, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, shadowColor: Colors.Black, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  activityIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '700', color: Colors.TextPrimary, marginBottom: 2 },
  activityDetail: { fontSize: 12, color: Colors.Gray },
  activityTime: { fontSize: 11, color: Colors.Gray, fontWeight: '500' },
});