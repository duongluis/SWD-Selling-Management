import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Colors from "../constant/Colors";

export default function Index() {

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
    <View
      style={{
        backgroundColor: Colors.White
      }}>

      <Image 
      // source={require('./../assets/images/LDcode.png')}
        style={{
          width: '100%',
          height: 300,
          marginTop: 70
        }} />

      <View style={{
        padding: 25,
        backgroundColor: Colors.Default,
        height: '100%',
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35
      }}>

        <Text style={{
          fontSize: 25,
          fontFamily: 'outfit-bold',
          color: Colors.White,
          textAlign: 'center'
        }}>Chào mừng đến với LDCode</Text>

        <Text style={{
          paddingTop: 100,
          fontSize: 25,
          fontFamily: 'outfit-bold',
          color: Colors.White,
          textAlign: 'center',
          marginBottom: 50
        }}>Vui lòng nhấn nút bên dưới để bắt đầu </Text>

        <TouchableOpacity style={styles.button}
          onPress={() => {
            console.log("Move to Sign In screen")
            router.push('/auth/signUp')
          }}>
          <Text style={[styles.buttonText, {
            color: Colors.Default,
          }]}>Bắt đầu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, {

          backgroundColor: Colors.Default,
          borderWidth: 1,
          borderColor: Colors.White
        }]}
          onPress={() => router.push('/auth/signIn')}
        >
          <Text style={[styles.buttonText, { color: Colors.White }]}>Bạn đã từng sử dụng app trước đây?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 15,
    backgroundColor: Colors.White,
    marginTop: 20,
    borderRadius: 10
  },
  buttonText: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center'
  }
})