import { router } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Importamos as funções do Firebase e o nosso porteiro (auth)
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Função para Entrar
  const fazerLogin = async () => {
    if (email === '' || senha === '') {
      alert("Preenche o email e a palavra-passe.");
      return;
    }
    
    setCarregando(true);
    console.log("PASSO 1: A tentar falar com o Firebase..."); // Espião 1
    
    try {
      const resposta = await signInWithEmailAndPassword(auth, email, senha);
      console.log("PASSO 2: O Firebase autorizou! Email:", resposta.user.email); // Espião 2
      
      console.log("PASSO 3: A dar a ordem de viagem para /painel..."); // Espião 3
      router.replace('/painel');
      console.log("PASSO 4: Ordem de viagem executada!"); // Espião 4
      
    } catch (erro: any) {
      console.error("PASSO ERRO: Ocorreu um problema no Firebase!", erro); // Espião de erro
      alert("Erro de Login: Verifica as tuas credenciais.");
      setCarregando(false);
    } 
  };

  // Função para Criar Conta
  const criarConta = async () => {
    if (email === '' || senha === '') {
      alert("Preenche o email e a palavra-passe para criar conta.");
      return;
    }
    
    setCarregando(true);
    console.log("CRIAR 1: A enviar dados ao Firebase...");
    
    try {
      const resposta = await createUserWithEmailAndPassword(auth, email, senha);
      console.log("CRIAR 2: Conta criada com sucesso!", resposta.user.email);
      router.replace('/painel');
    } catch (erro: any) {
      console.error("CRIAR ERRO:", erro);
      alert("Erro: Não foi possível criar a conta.");
      setCarregando(false);
    } 
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <ThemedText type="title" style={styles.title}>
          Património Inteligente
        </ThemedText>
        
        <ThemedText style={styles.subtitle}>
          Acede à tua conta para gerires as tuas finanças
        </ThemedText>

        <View style={styles.form}>
          <TextInput 
            style={styles.input}
            placeholder="O teu Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TextInput 
            style={styles.input}
            placeholder="A tua Palavra-passe"
            placeholderTextColor="#999"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
          />

          <View style={styles.botoes}>
            <Button 
              title={carregando ? "A processar..." : "ENTRAR"} 
              onPress={fazerLogin} 
            />
            <View style={{ height: 15 }} />
            <Button 
              title="CRIAR NOVA CONTA" 
              onPress={criarConta} 
              color="#555"
            />
          </View>
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  safeArea: { alignItems: 'center', width: '100%' },
  title: { textAlign: 'center', fontSize: 28, marginBottom: 5 },
  subtitle: { textAlign: 'center', marginBottom: 40, color: '#888' },
  form: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16, color: '#333' },
  botoes: { marginTop: 10 }
});