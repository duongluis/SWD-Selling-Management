// components/Utils/useStyles.js

import { useLayout } from '@/components/Main/TabScreenLayout';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

export function useScreenStyles() {
    const { isDesktop } = useLayout();
    return useMemo(() => StyleSheet.create({
        // ── Dùng chung cho mọi màn ──
        pageTitle: { fontSize: isDesktop ? 24 : 20, fontWeight: '800', color: '#0F172A' },
        topBar: { paddingHorizontal: isDesktop ? 32 : 16, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
        tableWrap: { flex: 1, margin: isDesktop ? 16 : 0, borderRadius: isDesktop ? 14 : 0, borderWidth: isDesktop ? 1 : 0, borderColor: '#E2E8F0', overflow: 'hidden' },
        summaryBar: { flexDirection: isDesktop ? 'row' : 'column', paddingHorizontal: isDesktop ? 32 : 20, gap: isDesktop ? 0 : 12 },
        card: { flex: 1, backgroundColor: '#fff', borderRadius: isDesktop ? 12 : 0, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', margin: isDesktop ? 16 : 0, marginTop: 0 },
        wrapBase: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: isDesktop ? 20 : 14 },
    }), [isDesktop]);
}