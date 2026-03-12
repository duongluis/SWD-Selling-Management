import React, { useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

//data user
const topEmployees = [
  { id: '1', name: 'Alex Johnson', earnings: '$15,820', image: 'https://via.placeholder.com/80' },
  { id: '2', name: 'Sarah Smith', earnings: '$12,450', image: 'https://via.placeholder.com/80' },
  { id: '3', name: 'Mike Ross', earnings: '$10,100', image: 'https://via.placeholder.com/80' },
];

const otherEmployees = [
  { id: '4', name: 'Emily Davis', earnings: '$9,840', orders: 42 },
  { id: '5', name: 'James Wilson', earnings: '$8,920', orders: 38 },
  { id: '6', name: 'Lisa Chen', earnings: '$7,650', orders: 35 },
  { id: '7', name: 'Robert Taylor', earnings: '$6,120', orders: 31 },
];

export default function leaderboardView() {
  const [filter, setFilter] = useState('This Month');

  const renderOther = ({ item, index }) => (
    <View style={styles.row}>
      <Text style={styles.rank}>{index + 4}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.orders}>{item.orders} Orders completed</Text>
      </View>
      <Text style={styles.earnings}>{item.earnings}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employee Leaderboard</Text>

      {/* Filter Tabs */}
      <View style={styles.filters}>
        {['This Month', 'Last Month', 'All Time'].map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.activeFilter]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Top 3 Employees */}
      <View style={styles.topContainer}>
        {topEmployees.map((emp, idx) => (
          <View key={emp.id} style={styles.topCard}>
            <Image source={{ uri: emp.image }} style={styles.avatar} />
            <Text style={styles.name}>{emp.name}</Text>
            <Text style={styles.earnings}>{emp.earnings}</Text>
            <Text style={styles.rank}>#{idx + 1}</Text>
          </View>
        ))}
      </View>

      {/* Other Employees */}
      <FlatList
        data={otherEmployees}
        renderItem={renderOther}
        keyExtractor={item => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 16,width:Dimensions.get('screen').width, marginTop:30},
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  filters: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  filterText: { fontSize: 16, color: '#555' },
  activeFilter: { fontWeight: 'bold', color: '#000' },
  topContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  topCard: { alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  earnings: { fontSize: 14, color: '#333' },
  rank: { fontSize: 14, color: '#888', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  orders: { fontSize: 12, color: '#666' },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  navText: { fontSize: 16, color: '#444' },
});