import { router } from 'expo-router';
import {
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Colors from '../constant/Colors';

export default function Index() {
  const { height, width } = Dimensions.get('screen');

  return (
    <ImageBackground
      source={require('./../assets/images/background_img.png')}
      style={{
        resizeMode: 'cover',
        flex: 1,
        height: height,
        width: width,
      }}
    >
      <View style={styles.logo}>
        <Image
          source={require('./../assets/images/logo-dark.png')}
          style={{
            height: 500,
            width: '100%',
            resizeMode: 'center',
          }}
        />
      </View>

      <View
        style={{
          padding: 25,
          height: '100%',
          borderTopLeftRadius: 35,
          borderTopRightRadius: 35,
        }}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            console.log('Move to Sign In screen');
            router.push('/auth/signIn');
          }}
        >
          <Text style={styles.buttonText}>Bắt đầu</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 15,
    marginTop: 20,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: Colors.White,
  },
  logo: {
    marginTop: 50,
    height: 500,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});