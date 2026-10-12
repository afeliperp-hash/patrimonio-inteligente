import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function GerirContasScreen() {
  const [contas, setContas] = useState<any[]>([]);
  
  // Campos do formulário
  const [nome, setNome] = useState('');
  const [codigoBanco, setCodigoBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [chavePix, setChavePix] = useState('');
  
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Lê as contas em tempo real do Firebase
  useEffect(() => {
    const uid = auth?.currentUser?.uid || 'usuario-anonimo';
    const q = query(collection(db, 'contas'), where('uid', '==', uid));
    
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setContas(lista);
    });
    
    return () => unsub();
  }, []);

  const salvarConta = async () => {
    if (!nome) {
      alert('O nome da conta é obrigatório (ex: Nubank).');
      return;
    }

    setCarregando(true);
    const dadosConta = {
      uid: auth?.currentUser?.uid || 'usuario-anonimo',
      nome,
      codigoBanco,
      agencia,
      conta,
      chavePix,
      atualizadoEm: new Date().toISOString()
    };

    try {
      if (idEditando) {
        await updateDoc(doc(db, 'contas', idEditando), dadosConta);
        if (Platform.OS !== 'web') Alert.alert("Sucesso", "Conta atualizada!");
      } else {
        await addDoc(collection(db, 'contas'), { ...dadosConta, criadoEm: new Date().toISOString() });
        if (Platform.OS !== 'web') Alert.alert("Sucesso", "Conta criada!");
      }
      limparFormulario();
    } catch (error) {
      alert('Erro ao salvar a conta.');
    } finally {
      setCarregando(false);
    }
  };

  const limparFormulario = () => {
    setIdEditando(null);
    setNome('');
    setCodigoBanco('');
    setAgencia('');
    setConta('');
    setChavePix('');
  };

  const editarConta = (item: any) => {
    setIdEditando(item.id);
    setNome(item.nome || '');
    setCodigoBanco(item.codigoBanco || '');
    setAgencia(item.agencia || '');
    setConta(item.conta || '');
    setChavePix(item.chavePix || '');
  };

  const apagarConta = async (id: string, nomeConta: string) => {
    const msg = `Deseja realmente apagar a conta '${nomeConta}'?`;
    
    const confirmarApagar = async () => {
      try {
        await deleteDoc(doc(db, 'contas', id));
      } catch (e) {
        alert('Erro ao apagar.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) confirmarApagar();
    } else {
      Alert.alert("Apagar Conta", msg, [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: confirmarApagar }
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
          <ThemedText type="subtitle">Gerir Contas</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          
          <ThemedText style={styles.sectionTitle}>{idEditando ? 'Editar Conta Bancária' : 'Adicionar Nova Conta'}</ThemedText>
          
          <ThemedText style={styles.label}>Nome da Conta (Obrigatório)*</ThemedText>
          <TextInput style={styles.input} placeholder="Ex: Nubank, Itaú, Carteira" placeholderTextColor="#999" value={nome} onChangeText={setNome} />

          <View style={styles.row}>
             <View style={{ flex: 1, marginRight: 10 }}>
               <ThemedText style={styles.label}>Cód. do Banco</ThemedText>
               <TextInput style={styles.input} placeholder="Ex: 260" placeholderTextColor="#999" value={codigoBanco} onChangeText={setCodigoBanco} keyboardType="numeric" />
             </View>
             <View style={{ flex: 1, marginLeft: 10 }}>
               <ThemedText style={styles.label}>Agência</ThemedText>
               <TextInput style={styles.input} placeholder="Ex: 0001" placeholderTextColor="#999" value={agencia} onChangeText={setAgencia} keyboardType="numeric" />
             </View>
          </View>

          <ThemedText style={styles.label}>Número da Conta</ThemedText>
          <TextInput style={styles.input} placeholder="Ex: 1234567-8" placeholderTextColor="#999" value={conta} onChangeText={setConta} />

          <ThemedText style={styles.label}>Chave PIX</ThemedText>
          <TextInput style={styles.input} placeholder="Telefone, CPF, E-mail..." placeholderTextColor="#999" value={chavePix} onChangeText={setChavePix} />

          <View style={styles.botoesAcao}>
             {idEditando && (
               <TouchableOpacity style={styles.botaoCancelar} onPress={limparFormulario}>
                 <Text style={styles.textoCancelar}>Cancelar</Text>
               </TouchableOpacity>
             )}
             <TouchableOpacity style={styles.botaoSalvar} onPress={salvarConta}>
               <Text style={styles.textoSalvar}>{carregando ? 'A salvar...' : 'Salvar Conta'}</Text>
             </TouchableOpacity>
          </View>

          <View style={styles.divisor} />

          <ThemedText style={styles.sectionTitle}>As Minhas Contas</ThemedText>
          
          {contas.length === 0 && <Text style={{color: '#999', textAlign: 'center'}}>Nenhuma conta cadastrada.</Text>}
          
          {contas.map(item => (
            <View key={item.id} style={styles.cardConta}>
               <View style={{ flex: 1 }}>
                  <Text style={styles.nomeConta}>{item.nome}</Text>
                  {item.agencia || item.conta ? <Text style={styles.detalheConta}>Ag: {item.agencia || '--'} | Cta: {item.conta || '--'}</Text> : null}
                  {item.chavePix ? <Text style={styles.detalheConta}>PIX: {item.chavePix}</Text> : null}
               </View>
               <View style={{ flexDirection: 'row', gap: 15 }}>
                  <TouchableOpacity onPress={() => editarConta(item)}>
                     <Text style={{ fontSize: 18 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => apagarConta(item.id, item.nome)}>
                     <Text style={{ fontSize: 18, color: '#ff4444' }}>✕</Text>
                  </TouchableOpacity>
               </View>
            </View>
          ))}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  botaoVoltar: { paddingVertical: 10, width: 60 },
  textoVoltar: { color: '#007AFF', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  label: { fontSize: 14, color: '#555', marginBottom: 8, marginTop: 10, fontWeight: 'bold' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 16, color: '#333' },
  row: { flexDirection: 'row' },
  botoesAcao: { flexDirection: 'row', gap: 10, marginTop: 20 },
  botaoSalvar: { flex: 1, backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  textoSalvar: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  botaoCancelar: { flex: 1, backgroundColor: '#eee', padding: 15, borderRadius: 8, alignItems: 'center' },
  textoCancelar: { color: '#333', fontWeight: 'bold', fontSize: 16 },
  divisor: { height: 1, backgroundColor: '#ddd', marginVertical: 25 },
  cardConta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  nomeConta: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  detalheConta: { fontSize: 13, color: '#777', marginTop: 3 },
});