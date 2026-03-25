import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../../constant/Colors';

export default function homeView() {
  const router = useRouter();
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Good Morning</Text>
        <Text style={styles.userInfo}>DASHBOARD - Alex Harrison</Text>
      </View>

      {/* Daily Summary */}
      <View style={styles.summary}>
        <Text style={styles.sectionTitle}>LIVE UPDATES</Text>
        <Text style={styles.sales}>Total Sales Today: $12,840.50</Text>
        <Text style={styles.percent}>+12.4% vs yesterday</Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>48</Text>
          <Text style={styles.statLabel}>NEW ORDERS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>NEW CUSTOMERS</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[{ name: 'New Order', icon: 'cart-outline' },
          { name: 'Add Customer', icon: 'person-add-outline' },
          { name: 'Report', icon: 'podium-outline' },
          { name: 'Staff', icon: 'person-add-outline' }
          ].map(action => (
            <View
              key={action.name}
              style={{ alignItems: 'center', flex: 1 }} 
            >
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name={action.icon} size={22} style={{ color: Colors.LightBlue }} />
              </TouchableOpacity>
              <Text style={styles.actionText}>{action.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Activities */}
      <View style={styles.activities}>
        <Text style={styles.sectionTitle}>Recent Activities</Text>
        <View style={styles.activityItem}>
          <Text style={styles.activityTitle}>Order #8492 Paid</Text>
          <Text style={styles.activityDetail}>Received $420.00 from Sarah J. (2m ago)</Text>
        </View>
        <View style={styles.activityItem}>
          <Text style={styles.activityTitle}>New Order Received</Text>
          <Text style={styles.activityDetail}>3 items from Michael Chen (15m ago)</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 16, width: Dimensions.get('screen').width, marginTop: 30 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.Black },
  userInfo: {
    fontSize: 14,
    color: Colors.LightGray,
    marginTop: 4
  },
  summary: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.Black
  },
  sales: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.Blue
  },
  percent: {
    fontSize: 14,
    color: 'green',
    marginTop: 4
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.White,
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.Blue
  },
  statLabel: {
    fontSize: 12,
    color: Colors.LightGray,
    marginTop: 4
  },
  quickActions: {
    marginBottom: 20
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: Colors.White,
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },
  actionText: {
    color: Colors.Black,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 10,
    marginTop: 4,
  },

  activities: {
    marginBottom: 20
  },
  activityItem: {
    backgroundColor: Colors.White,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.Black
  },
  activityDetail: {
    fontSize: 12,
    color: Colors.LightGray,
    marginTop: 2
  },
});
