import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
// CORREÇÃO: Ajustado o caminho para a pasta constants
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PainelScreen() {
  const [totalReceitas, setTotalReceitas] = useState(0);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [lancamentos, setLancamentos] = useState<any[]>([]);

  const saldoAtual = totalReceitas - totalDespesas;

  useEffect(() => {
    const utilizadorAtual = auth?.currentUser;
    if (!utilizadorAtual) return;

    // Busca apenas os lançamentos de quem está logado
    const consulta = query(collection(db, 'lancamentos'), where('uid', '==', utilizadorAtual.uid));

    const pararDeOuvir = onSnapshot(consulta, (resultados) => {
      let somaReceitas = 0;
      let somaDespesas = 0;
      const listaTemporaria: any[] = [];

      resultados.forEach((documento) => {
        const dados = documento.data();
        listaTemporaria.push({ id: documento.id, ...dados });
        if (dados.tipo === 'receita') somaReceitas += dados.valor;
        if (dados.tipo === 'despesa') somaDespesas += dados.valor;
      });

      // Ordena do mais recente para o mais antigo usando a dataCriacao
      listaTemporaria.sort((a, b) => {
        const dataA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
        const dataB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
        return dataB - dataA;
      });

      setTotalReceitas(somaReceitas);
      setTotalDespesas(somaDespesas);
      setLancamentos(listaTemporaria);
    });

    return () => pararDeOuvir();
  }, []);

  const fazerLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/'); 
    } catch (erro) {
      alert("Erro ao sair.");
    }
  };

  const apagarLancamento = async (id: string, nomeDaConta: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Tem a certeza que quer apagar '${nomeDaConta}'?`)) {
        await deleteDoc(doc(db, 'lancamentos', id));
      }
    } else {
      Alert.alert(
        "Apagar Lançamento",
        `Tem a certeza que quer apagar '${nomeDaConta}'?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Apagar", style: "destructive", onPress: async () => await deleteDoc(doc(db, 'lancamentos', id)) }
        ]
      );
    }
  };

  const formatarDinheiro = (numero: number) => {
    return `R$ ${numero.toFixed(2).replace('.', ',')}`;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <ThemedText type="title">Visão Geral</ThemedText>
          <Button title="Sair" onPress={fazerLogout} color="#ff4444" />
        </View>

        <View style={styles.cartaoSaldo}>
          <ThemedText style={styles.saldoTitulo}>Saldo Atual</ThemedText>
          <ThemedText style={[styles.saldoValor, saldoAtual >= 0 ? styles.textoReceita : styles.textoDespesa]}>
            {formatarDinheiro(saldoAtual)}
          </ThemedText>
        </View>

        <View style={styles.cardsContainer}>
          <View style={[styles.card, styles.cardReceita]}>
            <ThemedText style={styles.cardTitulo}>Receitas</ThemedText>
            <ThemedText style={styles.cardValorPequeno}>{formatarDinheiro(totalReceitas)}</ThemedText>
          </View>
          <View style={[styles.card, styles.cardDespesa]}>
            <ThemedText style={styles.cardTitulo}>Despesas</ThemedText>
            <ThemedText style={styles.cardValorPequeno}>{formatarDinheiro(totalDespesas)}</ThemedText>
          </View>
        </View>

        <ThemedText type="subtitle" style={styles.tituloExtrato}>Recentes</ThemedText>
        
        <FlatList
          data={lancamentos}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          renderItem={({ item }) => (
            <View style={styles.itemLista}>
              <View style={styles.itemInfo}>
                <ThemedText style={styles.itemDescricao}>{item.descricao}</ThemedText>
                <ThemedText style={[styles.itemValor, item.tipo === 'receita' ? styles.textoReceita : styles.textoDespesa]}>
                  {item.tipo === 'receita' ? '+ ' : '- '}
                  {formatarDinheiro(item.valor)}
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => apagarLancamento(item.id, item.descricao)} style={styles.botaoApagar}>
                <Text style={styles.textoApagar}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<ThemedText style={styles.listaVazia}>Nenhum lançamento encontrado.</ThemedText>}
        />

        <View style={styles.acoes}>
          {/* O botão agora viaja para a nova tela */}
          <Button title="+ NOVO LANÇAMENTO" onPress={() => router.push('/novo-lancamento')} />
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  cartaoSaldo: { alignItems: 'center', padding: 20, backgroundColor: '#f0f4f8', borderRadius: 12, marginBottom: 15 },
  saldoTitulo: { fontSize: 16, color: '#555', marginBottom: 5 },
  saldoValor: { fontSize: 32, fontWeight: 'bold' },
  cardsContainer: { flexDirection: 'row', gap: 15 },
  card: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center' },
  cardReceita: { backgroundColor: '#e6f4ea' },
  cardDespesa: { backgroundColor: '#fce8e6' },
  cardTitulo: { fontSize: 13, color: '#555', marginBottom: 5 },
  cardValorPequeno: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  tituloExtrato: { marginTop: 25, marginBottom: 10, fontSize: 18 },
  lista: { flex: 1 },
  itemLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  itemInfo: { flex: 1 },
  itemDescricao: { fontSize: 16, color: '#333' },
  itemValor: { fontSize: 16, fontWeight: 'bold' },
  textoReceita: { color: '#34a853' },
  textoDespesa: { color: '#ea4335' },
  botaoApagar: { padding: 10, marginLeft: 10 },
  textoApagar: { color: '#ff4444', fontSize: 18, fontWeight: 'bold' },
  listaVazia: { textAlign: 'center', color: '#999', marginTop: 20 },
  acoes: { marginTop: 15, marginBottom: 20 }
});