// Import the functions you need from the SDKs you need
import { getAnalytics } from "@firebase/analytics";
import { initializeApp } from '@firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from "@firebase/auth";
import { getFirestore } from "@firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB3JsxwcCr1grDZFNkQsO4hRtHGWp1Po3s",
  authDomain: "swd-seller-management.firebaseapp.com",
  databaseURL: "https://swd-seller-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "swd-seller-management",
  storageBucket: "swd-seller-management.firebasestorage.app",
  messagingSenderId: "920514678026",
  appId: "1:920514678026:web:67887e999a1d2f8ca5fef3",
  measurementId: "G-5ZRYJ3K72P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let auth;
if (Platform.OS == 'web') {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)

  })
};

export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default auth;
