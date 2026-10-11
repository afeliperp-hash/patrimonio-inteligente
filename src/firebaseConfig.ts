import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from 'react-native'; // NOVO: Ferramenta para detetar o dispositivo

const firebaseConfig = {
  apiKey: "AIzaSyCNNngR92NtUyPeyR-_9hNYzKIYeQ2xW_c",
  authDomain: "patrimonio-inteligente-7a056.firebaseapp.com",
  projectId: "patrimonio-inteligente-7a056",
  storageBucket: "patrimonio-inteligente-7a056.firebasestorage.app",
  messagingSenderId: "457249894382",
  appId: "1:457249894382:web:a637d0d4d7368c79cf28ff"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// O nosso porteiro agora é inteligente: adapta-se ao telemóvel e à Web
let authParaExportar;

if (Platform.OS === 'web') {
  // Se estivermos a testar no navegador do computador (tecla 'w')
  authParaExportar = getAuth(app); 
} else {
  // Se estivermos a testar no telemóvel (Expo Go)
  authParaExportar = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export const auth = authParaExportar;