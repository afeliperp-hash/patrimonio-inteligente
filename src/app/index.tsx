import { useState } from 'react';
import { Alert, Button, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Ferramentas do Firebase para adicionar dados
import { addDoc, collection } from 'firebase/firestore';

// O nosso ficheiro de ligação ao cofre
import { db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  // Uma variável para sabermos se está a carregar (a gravar)
  const [estaAGravar, setEstaAGravar] = useState(false);

  // A função mágica que envia os dados para o Firebase
  const gravarPrimeiraCategoria = async () => {
    setEstaAGravar(true); // O botão vai mostrar que está a pensar...
    
    try {
      // Aqui dizemos: "Vai ao banco de dados (db), na pasta 'categorias', e adiciona este documento"
      await addDoc(collection(db, "categorias"), {
        nome: "Alimentação",
        tipo: "Despesa",
        criadoEm: new Date()
      });
      
      // Se der certo, mostra um alerta no telemóvel
      Alert.alert("Sucesso!", "A categoria foi guardada no Firebase!");
      
    } catch (erro) {
      console.error(erro);
      Alert.alert("Erro", "Não foi possível gravar.");
    } finally {
      setEstaAGravar(false); // Volta o botão ao normal
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <ThemedText type="title" style={styles.title}>
          Património Inteligente
        </ThemedText>

        <ThemedText style={styles.texto}>
          O teu banco de dados está ligado! Clica no botão abaixo para testar o primeiro envio.
        </ThemedText>

        <Button 
          title={estaAGravar ? "A gravar..." : "Criar Categoria 'Alimentação'"} 
          onPress={gravarPrimeiraCategoria} 
        />

      </SafeAreaView>
    </ThemedView>
  );
}

// O design do nosso ecrã
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  safeArea: {
    alignItems: 'center',
    gap: 20,
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
  },
  texto: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  }
});