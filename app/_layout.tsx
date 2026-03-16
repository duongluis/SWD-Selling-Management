import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useState } from "react";
import { UserDetailContext } from '../context/UserDetailContext';
export default function RootLayout() {

  useFonts({
    'outfit': require('./../assets/fonts/Oswald-Regular.ttf'),
    'outfit-bold': require('./../assets/fonts/Oswald-Bold.ttf'),
    'outfit-light': require('./../assets/fonts/Oswald-Bold.ttf')

  })
  
  const [userDetail, setUserDetail] = useState();


  return (
    <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
      <Stack screenOptions={{
        headerShown: false
      }}>
        <Stack.Screen name="index" />
      </Stack>
    </UserDetailContext.Provider>
  )
}