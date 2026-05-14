import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

const isWeb = Platform.OS === 'web';

export default function FilterChips({ options = [], value, onChange }) {
    if (!options.length) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={[S.row, isWeb && S.rowWeb]}
        >
            {options.map(opt => {
                const active = opt.key === value;
                return (
                    <TouchableOpacity
                        key={opt.key}
                        style={[S.chip, active && S.chipActive]}
                        onPress={() => onChange && onChange(opt.key)}
                        activeOpacity={0.75}
                    >
                        <Text style={[S.label, active && S.labelActive]}>
                            {opt.label}{opt.count != null ? ` (${opt.count})` : ''}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const S = StyleSheet.create({
    row: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, flexDirection: 'row' },
    rowWeb: { paddingHorizontal: 32 },
    chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    label: { fontSize: 13, fontWeight: '500', color: '#475569' },
    labelActive: { color: '#fff', fontWeight: '600' },
});
