// components/Help/HelpButton.jsx
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useLayout } from '../Main/TabScreenLayout';
import HelpModal from './helpModal';

export default function HelpButton({ screenKey }) {
    const { isDesktop } = useLayout();
    const [visible, setVisible] = useState(false);

    if (!isDesktop) return null;

    return (
        <>
            <TouchableOpacity style={S.btn} onPress={() => setVisible(true)}>
                <Ionicons name="help-circle-outline" size={20} color="#2C5282" />
            </TouchableOpacity>
            <HelpModal
                visible={visible}
                screenKey={screenKey}
                onClose={() => setVisible(false)}
            />
        </>
    );
}

const S = StyleSheet.create({
    btn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#EFF6FF',
        borderWidth: 1, borderColor: '#BFDBFE',
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 8,
    },
});
