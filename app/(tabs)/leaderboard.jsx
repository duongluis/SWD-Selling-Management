import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const topEmployees = [
  { id: '1', name: 'Alex Johnson', earnings: '$15,820', rank: 1, initials: 'AJ', color: '#2196F3' },
  { id: '2', name: 'Sarah Smith', earnings: '$12,450', rank: 2, initials: 'SS', color: '#9E9E9E' },
  { id: '3', name: 'Mike Ross', earnings: '$10,100', rank: 3, initials: 'MR', color: '#795548' },
];

const otherEmployees = [
  { id: '4', name: 'Emily Davis', earnings: '$9,840', orders: 42, trend: '+2', trendUp: true },
  { id: '5', name: 'James Wilson', earnings: '$8,920', orders: 38, trend: '—', trendUp: null },
  { id: '6', name: 'Lisa Chen', earnings: '$7,650', orders: 35, trend: '-2', trendUp: false },
  { id: '7', name: 'Robert Taylor', earnings: '$6,120', orders: 31, trend: '+4', trendUp: true },
];

const CROWN_COLORS = { 1: '#FFD700', 2: '#B0B0B0', 3: '#CD7F32' };
const RANK_BORDER = { 1: '#FFD700', 2: '#B0B0B0', 3: '#CD7F32' };

export default function LeaderboardView() {
  const [filter, setFilter] = useState('This Month');

  // Layout: 2nd left, 1st center (taller), 3rd right
  const podium = [topEmployees[1], topEmployees[0], topEmployees[2]];

  const renderTrend = (trend, trendUp) => {
    if (trendUp === null) return <Text style={styles.trendNeutral}>—</Text>;
    const color = trendUp ? '#4CAF50' : '#F44336';
    const icon = trendUp ? 'trending-up-outline' : 'trending-down-outline';
    return (
      <View style={styles.trendRow}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.trendText, { color }]}>{trend}</Text>
      </View>
    );
  };

  const renderOther = ({ item, index }) => (
    <View style={styles.rankRow}>
      <Text style={styles.rankNumber}>{index + 4}</Text>
      <View style={styles.rankAvatar}>
        <Text style={styles.rankAvatarText}>{item.name.split(' ').map(n => n[0]).join('')}</Text>
      </View>
      <View style={styles.rankInfo}>
        <Text style={styles.rankName}>{item.name}</Text>
        <Text style={styles.rankOrders}>{item.orders} Orders completed</Text>
      </View>
      <View style={styles.rankRight}>
        <Text style={styles.rankEarnings}>{item.earnings}</Text>
        {renderTrend(item.trend, item.trendUp)}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Leaderboard</Text>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="reorder-three-outline" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['This Month', 'Last Month', 'All Time'].map(f => (
          <TouchableOpacity key={f} style={styles.filterItem} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>{f}</Text>
            {filter === f && <View style={styles.filterUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Podium — 2nd | 1st | 3rd */}
      <View style={styles.podiumContainer}>
        {podium.map((emp) => {
          const isFirst = emp.rank === 1;
          return (
            <View key={emp.id} style={[styles.podiumItem, isFirst && styles.podiumItemCenter]}>
              {/* Crown for #1 */}
              {isFirst && (
                <View style={styles.crownWrap}>
                  <Ionicons name="trophy" size={20} color="#FFD700" />
                </View>
              )}
              {/* Avatar */}
              <View style={[
                styles.podiumAvatar,
                isFirst && styles.podiumAvatarLarge,
                { borderColor: RANK_BORDER[emp.rank], backgroundColor: emp.color }
              ]}>
                <Text style={[styles.podiumAvatarText, isFirst && styles.podiumAvatarTextLarge]}>
                  {emp.initials}
                </Text>
                {/* Rank badge */}
                <View style={[styles.rankBadge, { backgroundColor: CROWN_COLORS[emp.rank] }]}>
                  <Text style={styles.rankBadgeText}>{emp.rank}</Text>
                </View>
              </View>
              <Text style={[styles.podiumName, isFirst && styles.podiumNameLarge]} numberOfLines={1}>
                {emp.name}
              </Text>
              <Text style={[styles.podiumEarnings, isFirst && styles.podiumEarningsHighlight]}>
                {emp.earnings}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Rankings List */}
      <View style={styles.rankingsContainer}>
        <Text style={styles.rankingsLabel}>RANKINGS</Text>
        <FlatList
          data={otherEmployees}
          renderItem={renderOther}
          keyExtractor={item => item.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    width: Dimensions.get('screen').width,
    paddingTop: 30,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 24,
  },
  filterItem: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  activeFilterText: {
    color: '#2196F3',
    fontWeight: '700',
  },
  filterUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
    marginTop: 4,
  },

  // Podium
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 28,
    gap: 12,
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
  },
  podiumItemCenter: {
    marginBottom: 0,
    flex: 1.2,
  },
  crownWrap: {
    marginBottom: 4,
  },
  podiumAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  podiumAvatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  podiumAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  podiumAvatarTextLarge: {
    fontSize: 20,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5F7FA',
  },
  rankBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumNameLarge: {
    fontSize: 14,
  },
  podiumEarnings: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  podiumEarningsHighlight: {
    color: '#2196F3',
    fontSize: 13,
  },

  // Rankings
  rankingsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  rankingsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
    marginBottom: 12,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  rankNumber: {
    width: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#9E9E9E',
    textAlign: 'center',
  },
  rankAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2196F3',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  rankOrders: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  rankRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rankEarnings: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2196F3',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  trendNeutral: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '700',
  },
});