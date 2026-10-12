import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Paleta de cores profissionais para as barras de progresso
const coresGrafico = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#f15bb5', '#00bbf9', '#00f5d4', '#fb5607', '#ff006e'];

export default function RelatoriosScreen() {
  const [todosLancamentos, setTodosLancamentos] = useState<any[]>([]);
  const [dadosAgrupados, setDadosAgrupados] = useState<any[]>([]);
  const [totalMes, setTotalMes] = useState(0);
  const [dataFiltro, setDataFiltro] = useState(new Date());

  // 1. Ouve os lançamentos do utilizador
  useEffect(() => {
    const uid = auth?.currentUser?.uid || 'usuario-anonimo';
    const q = query(collection(db, 'lancamentos'), where('uid', '==', uid));

    const unsub = onSnapshot(q, (snap) => {
      const lista: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodosLancamentos(lista);
    });
    return () => unsub();
  }, []);

  // 2. Filtra o mês atual e faz a matemática das categorias
  useEffect(() => {
    const mesFiltro = dataFiltro.getMonth();
    const anoFiltro = dataFiltro.getFullYear();

    const categoriasMap: { [key: string]: number } = {};
    let totalDespesas = 0;

    todosLancamentos.forEach((item) => {
      if (!item.dataVencimento) return;
      
      // No relatório de gastos, olhamos apenas para as despesas
      if (item.tipo !== 'despesa') return;

      const partes = item.dataVencimento.split('/');
      if (partes.length !== 3) return;

      const vencMesOrigem = parseInt(partes[1]) - 1;
      const vencAnoOrigem = parseInt(partes[2]);

      const diferencaMeses = (anoFiltro - vencAnoOrigem) * 12 + (mesFiltro - vencMesOrigem);

      // Regra para saber se a conta "cai" neste mês (fixa, parcelada ou normal)
      let pertenceAoMes = false;
      if (diferencaMeses === 0) {
        pertenceAoMes = true;
      } else if (item.recorrencia === 'fixa' && diferencaMeses > 0) {
        pertenceAoMes = true;
      } else if (item.recorrencia === 'parcelada' && diferencaMeses > 0 && item.totalParcelas) {
        const parcelaAtualProjetada = (item.parcelaAtual || 1) + diferencaMeses;
        if (parcelaAtualProjetada <= item.totalParcelas) {
          pertenceAoMes = true;
        }
      }

      if (pertenceAoMes) {
        totalDespesas += item.valor;

        // A MÁGICA DOS DESMEMBRAMENTOS ACONTECE AQUI:
        // Se a fatura do cartão tiver detalhes, ele soma o valor exato de cada detalhe na sua categoria
        if (item.detalhes && item.detalhes.length > 0) {
          item.detalhes.forEach((det: any) => {
            const cat = det.categoria || 'Outros';
            categoriasMap[cat] = (categoriasMap[cat] || 0) + det.valor;
          });
        } else {
          // Se for uma despesa simples (ex: CPFL = Moradia), soma direto
          const cat = item.categoria || 'Outros';
          categoriasMap[cat] = (categoriasMap[cat] || 0) + item.valor;
        }
      }
    });

    // Converte o objeto em uma lista (array) e calcula as percentagens
    const arrayAgrupado = Object.keys(categoriasMap).map(key => ({
      categoria: key,
      valor: categoriasMap[key],
      percentual: totalDespesas > 0 ? (categoriasMap[key] / totalDespesas) * 100 : 0
    })).sort((a, b) => b.valor - a.valor); // Ordena de quem gastou MAIS para quem gastou MENOS

    setTotalMes(totalDespesas);
    setDadosAgrupados(arrayAgrupado);
  }, [todosLancamentos, dataFiltro]);

  const alterarMes = (delta: number) => {
    const nova = new Date(dataFiltro);
    nova.setMonth(nova.getMonth() + delta);
    setDataFiltro(nova);
  };

  const formatarDinheiro = (numero: number) => {
    return `R$ ${numero.toFixed(2).replace('.', ',')}`;
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.botaoVoltar}>
            <Text style={styles.textoVoltar}>{"< Voltar"}</Text>
          </TouchableOpacity>
          <ThemedText type="subtitle">Análise de Gastos</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.seletorMes}>
          <TouchableOpacity onPress={() => alterarMes(-1)} style={styles.botaoMes}>
            <Text style={styles.setaMes}>{"<"}</Text>
          </TouchableOpacity>
          <ThemedText style={styles.textoMes}>{nomesMeses[dataFiltro.getMonth()]} de {dataFiltro.getFullYear()}</ThemedText>
          <TouchableOpacity onPress={() => alterarMes(1)} style={styles.botaoMes}>
            <Text style={styles.setaMes}>{">"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cartaoTotal}>
          <Text style={styles.tituloTotal}>Total Gasto no Mês</Text>
          <Text style={styles.valorTotal}>{formatarDinheiro(totalMes)}</Text>
        </View>

        <ScrollView style={styles.listaRelatorio} showsVerticalScrollIndicator={false}>
          
          <ThemedText style={styles.tituloSecao}>Gastos por Categoria</ThemedText>
          
          {dadosAgrupados.length === 0 && (
            <Text style={styles.textoVazio}>Nenhuma despesa registada neste mês.</Text>
          )}

          {dadosAgrupados.map((item, index) => {
            const corDaBarra = coresGrafico[index % coresGrafico.length];

            return (
              <View style={styles.itemCategoria} key={item.categoria}>
                <View style={styles.linhaTexto}>
                  <Text style={styles.nomeCategoria}>{item.categoria}</Text>
                  <Text style={styles.valorCategoria}>
                    {formatarDinheiro(item.valor)} <Text style={{ color: '#777', fontSize: 12 }}>({item.percentual.toFixed(1)}%)</Text>
                  </Text>
                </View>
                
                {/* Construção da barra de progresso nativa */}
                <View style={styles.barraFundo}>
                  <View style={[styles.barraPreenchida, { width: `${item.percentual}%`, backgroundColor: corDaBarra }]} />
                </View>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>

      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  botaoVoltar: { paddingVertical: 10, width: 60 },
  textoVoltar: { color: '#007AFF', fontSize: 16 },
  
  seletorMes: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  botaoMes: { padding: 5, paddingHorizontal: 15 },
  setaMes: { fontSize: 20, color: '#007AFF', fontWeight: 'bold' },
  textoMes: { fontSize: 16, fontWeight: 'bold', minWidth: 140, textAlign: 'center' },

  cartaoTotal: { backgroundColor: '#fce8e6', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 25 },
  tituloTotal: { fontSize: 14, color: '#555', marginBottom: 5 },
  valorTotal: { fontSize: 32, fontWeight: 'bold', color: '#dc3545' },

  listaRelatorio: { flex: 1 },
  tituloSecao: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  textoVazio: { textAlign: 'center', color: '#999', marginTop: 20 },

  itemCategoria: { marginBottom: 18 },
  linhaTexto: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, alignItems: 'flex-end' },
  nomeCategoria: { fontSize: 16, fontWeight: 'bold', color: '#444' },
  valorCategoria: { fontSize: 15, fontWeight: '600', color: '#333' },
  
  barraFundo: { height: 10, backgroundColor: '#e9ecef', borderRadius: 5, overflow: 'hidden' },
  barraPreenchida: { height: 10, borderRadius: 5 }
});