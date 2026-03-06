import React from 'react';
import { Dimensions, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Colors from "../constant/Colors";

export default function Index() {

  const { height, width } = Dimensions.get('window');

  // const router = useRouter();
  // const { userDetail, setUserDetail } = useContext(UserDetailContext);
  // const [isCheckingAuth, setIsCheckingAuth] = useState(true);


  // // onAuthStateChanged(auth, async (users) => {
  // //   if (users) {
  // //     const result = await getDoc(doc(db, 'users', users?.email));
  // //     setUserDetail(result.data());
  // //     router.replace('/tabs/main');
  // //   }
  // // })

  // useEffect(() => {
  //   let isMounted = true;

  //   const unsubscribe = onAuthStateChanged(auth, async (user) => {
  //     if (!isMounted) return;

  //     try {
  //       if (user) {
  //         const result = await getDoc(doc(db, 'users', user.email));
  //         if (isMounted) {
  //           setUserDetail(result.data());

  //           if (router.canGoBack()) {
  //             router.replace('/tabs/home');
  //           } else {
  //             router.push('/tabs/home');
  //           }
  //         }
  //       } else {
  //         if (isMounted) {
  //           setIsCheckingAuth(false);
  //         }
  //       }
  //     } catch (error) {
  //       console.error("Error handling auth state:", error);
  //       if (isMounted) {
  //         setIsCheckingAuth(false);
  //       }
  //     }
  //   });

  //   return () => {
  //     isMounted = false;
  //     unsubscribe();
  //   };
  // }, [router, setUserDetail]);

  // if (isCheckingAuth) {
  //   return (
  //     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.White }}>
  //       <Text>Đang kiểm tra đăng nhập...</Text>
  //     </View>
  //   );
  // }


  return (
    <ImageBackground
      source={require('./../assets/images/background_img.png')}
      style={{
        resizeMode: 'cover',
        flex: 1,
        height: height,
        width: width
      }}>

      <View
        style={[styles.logo]}>
        <Image
          source={require('./../assets/images/logo-dark.png')}
          style={{
            height: 500,
            width: '100%',
            resizeMode: 'center'
          }}
        />
      </View>

      <View style={{
        padding: 25,
        height: '100%',
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35
      }}>
        <TouchableOpacity style={styles.button}
          // onPress={() => {
          //   console.log("Move to Sign In screen")
          //   router.push('/auth/signUp')
          // }}
          >
          <Text style={[styles.buttonText
          ]}>Bắt đầu</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 15,
    marginTop: 20,
    borderRadius: 10
  },
  buttonText: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color:Colors.White
  },
  logo: {
    marginTop: 50,
    height: 500,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  }
})