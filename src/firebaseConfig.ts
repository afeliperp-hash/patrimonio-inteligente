import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Ferramenta do Banco de Dados

// As tuas chaves secretas do Património Inteligente
const firebaseConfig = {
  apiKey: "AIzaSyCNNngR92NtUyPeyR-_9hNYzKIYeQ2xW_c",
  authDomain: "patrimonio-inteligente-7a056.firebaseapp.com",
  projectId: "patrimonio-inteligente-7a056",
  storageBucket: "patrimonio-inteligente-7a056.firebasestorage.app",
  messagingSenderId: "457249894382",
  appId: "1:457249894382:web:a637d0d4d7368c79cf28ff"
};

// Inicializa a ligação ao Firebase
const app = initializeApp(firebaseConfig);

// Exporta o banco de dados para podermos gravar as despesas/receitas noutros ecrãs
export const db = getFirestore(app);