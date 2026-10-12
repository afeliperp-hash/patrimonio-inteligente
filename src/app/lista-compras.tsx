import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ListaComprasScreen() {
  const [itens, setItens] = useState<any[]>([]);
  const [novoItem, setNovoItem] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Lê a lista de compras em tempo real do Firebase
  useEffect(() => {
    const uid = auth?.currentUser?.uid || 'usuario-anonimo';
    const q = query(collection(db, 'compras'), where('uid', '==', uid));
    
    const unsub = onSnapshot(q, (snap) => {
      // Adicionamos : any[] para avisar que é uma lista dinâmica
      const lista: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Adicionamos : any no 'a' e no 'b' para o TypeScript parar de reclamar
      lista.sort((a: any, b: any) => {
        if (a.comprado === b.comprado) {
          return b.criadoEm.localeCompare(a.criadoEm); // Mais recentes primeiro
        }
        return a.comprado ? 1 : -1;
      });
      
      setItens(lista);
    });
    
    return () => unsub();
  }, []);

  const adicionarItem = async () => {
    if (novoItem.trim() === '') return;

    setCarregando(true);
    try {
      await addDoc(collection(db, 'compras'), {
        uid: auth?.currentUser?.uid || 'usuario-anonimo',
        nome: novoItem.trim(),
        comprado: false,
        criadoEm: new Date().toISOString()
      });
      setNovoItem(''); // Limpa o campo
    } catch (error) {
      alert('Erro ao adicionar item.');
    } finally {
      setCarregando(false);
    }
  };

  const alternarStatus = async (id: string, statusAtual: boolean) => {
    try {
      await updateDoc(doc(db, 'compras', id), { comprado: !statusAtual });
    } catch (error) {
      alert('Erro ao atualizar item.');
    }
  };

  const apagarItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'compras', id));
    } catch (e) {
      alert('Erro ao apagar.');
    }
  };

  const limparLista = () => {
    const apagarTudo = async () => {
      try {
        const itensComprados = itens.filter(i => i.comprado);
        for (const item of itensComprados) {
          await deleteDoc(doc(db, 'compras', item.id));
        }
      } catch (e) {
        alert('Erro ao limpar a lista.');
      }
    };

    const msg = "Deseja apagar todos os itens que já foram marcados como comprados?";
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) apagarTudo();
    } else {
      Alert.alert("Limpar Lista", msg, [
        { text: "Cancelar", style: "cancel" },
        { text: "Limpar", style: "destructive", onPress: apagarTudo }
      ]);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.botaoVoltar}>
            <Text style={styles.textoVoltar}>{"< Voltar"}</Text>
          </TouchableOpacity>
          <ThemedText type="subtitle">Lista de Compras</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="O que precisa comprar? (Ex: Leite)" 
            placeholderTextColor="#999" 
            value={novoItem} 
            onChangeText={setNovoItem}
            onSubmitEditing={adicionarItem} // Permite adicionar apertando o "Enter" no teclado
          />
          <TouchableOpacity style={styles.botaoAdicionar} onPress={adicionarItem} disabled={carregando}>
            <Text style={styles.textoBotaoAdicionar}>+</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={itens}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.itemCard, item.comprado && styles.itemCompradoBg]}>
              <TouchableOpacity style={styles.areaTexto} onPress={() => alternarStatus(item.id, item.comprado)}>
                <View style={[styles.checkbox, item.comprado && styles.checkboxAtivo]}>
                  {item.comprado && <Text style={styles.checkIcon}>✓</Text>}
                </View>
                <Text style={[styles.textoItem, item.comprado && styles.textoRiscado]}>
                  {item.nome}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => apagarItem(item.id)} style={styles.botaoApagar}>
                <Text style={styles.iconeApagar}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <ThemedText style={styles.listaVazia}>A sua lista está vazia. Adicione os itens acima!</ThemedText>
          }
        />

        {itens.some(i => i.comprado) && (
          <TouchableOpacity style={styles.botaoLimpar} onPress={limparLista}>
            <Text style={styles.textoBotaoLimpar}>🗑️ Limpar Itens Comprados</Text>
          </TouchableOpacity>
        )}

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 15, paddingTop: 10 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  botaoVoltar: { paddingVertical: 10, width: 60 },
  textoVoltar: { color: '#007AFF', fontSize: 16 },
  
  inputContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 16, color: '#333' },
  botaoAdicionar: { backgroundColor: '#007AFF', width: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  textoBotaoAdicionar: { color: '#fff', fontSize: 24, fontWeight: 'bold' },

  lista: { flex: 1 },
  
  itemCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  itemCompradoBg: { backgroundColor: '#f8f9fa', borderColor: '#f1f3f5' },
  
  areaTexto: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ccc', marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  checkboxAtivo: { backgroundColor: '#34a853', borderColor: '#34a853' },
  checkIcon: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  
  textoItem: { fontSize: 16, color: '#333', flex: 1 },
  textoRiscado: { color: '#999', textDecorationLine: 'line-through' },
  
  botaoApagar: { padding: 5, paddingLeft: 15 },
  iconeApagar: { fontSize: 18, color: '#ff4444', fontWeight: 'bold' },

  listaVazia: { textAlign: 'center', color: '#999', marginTop: 30 },
  
  botaoLimpar: { backgroundColor: '#ffe3e3', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  textoBotaoLimpar: { color: '#dc3545', fontWeight: 'bold', fontSize: 15 }
});