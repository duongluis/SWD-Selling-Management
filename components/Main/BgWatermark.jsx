import { Image, StyleSheet } from 'react-native';

const LOGO = require('../../assets/images/logo-light.png');

export default function BgWatermark() {
    return (
        <Image source={LOGO} style={S.img} resizeMode="contain" pointerEvents="none" />
    );
}

const S = StyleSheet.create({
    img: {
        position: 'absolute',
        width: '80%',
        height: '60%',
        top: '20%',
        left: '10%',
        opacity: 0.04,
        zIndex: 0,
    },
});
