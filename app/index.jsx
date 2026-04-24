import Colors from "@/constant/Colors";
import { router } from "expo-router";
import { useEffect } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const backgroundImg = require("./../assets/images/background_img.png");
const logoImg = require("./../assets/images/logo-dark.png");

export default function Index() {
  const { height, width } = Dimensions.get("window");

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      });
    }
  }, []);

  if (Platform.OS === "web") {
    // ✅ Fix double assets
    const fixUri = (imgObj) => {
      const uri = typeof imgObj === "object" ? imgObj.uri : imgObj;
      return uri;
    };

    const bgUri = fixUri(backgroundImg);
    const logoUri = fixUri(logoImg);

    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundImage: `url(${bgUri})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <img
          src={logoUri}
          style={{
            width: 300,
            height: 300,
            objectFit: "contain",
            marginTop: 50,
          }}
        />
        <div
          style={{
            padding: 25,
            paddingBottom: 50,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => router.replace("/auth/signIn")}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: 10,
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 30,
              fontWeight: "bold",
              color: "white",
            }}
          >
            Bắt đầu
          </button>
        </div>
      </div>
    );
  }
  // Mobile giữ nguyên
  return (
    <ImageBackground
      source={backgroundImg}
      style={{ resizeMode: "cover", flex: 1, height, width }}
    >
      <View style={styles.logo}>
        <Image
          source={logoImg}
          style={{ height: 500, width: "100%", resizeMode: "center" }}
        />
      </View>
      <View
        style={{
          padding: 25,
          height: "100%",
          borderTopLeftRadius: 35,
          borderTopRightRadius: 35,
        }}
      >
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/auth/signIn")}
        >
          <Text style={styles.buttonText}>Bắt đầu</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  button: { padding: 15, marginTop: 20, borderRadius: 10 },
  buttonText: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    color: Colors.White,
  },
  logo: {
    marginTop: 50,
    height: 500,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
