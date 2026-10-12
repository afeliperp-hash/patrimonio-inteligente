import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function PainelScreen() {
  const [todosLancamentos, setTodosLancamentos] = useState<any[]>([]); 
  const [lancamentosFiltrados, setLancamentosFiltrados] = useState<any[]>([]); 
  
  const [totalReceitas, setTotalReceitas] = useState(0);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const saldoAtual = totalReceitas - totalDespesas;

  const [dataFiltro, setDataFiltro] = useState(new Date()); 

  useEffect(() => {
    const utilizadorAtual = auth?.currentUser;
    if (!utilizadorAtual) return;

    const consulta = query(collection(db, 'lancamentos'), where('uid', '==', utilizadorAtual.uid));

    const pararDeOuvir = onSnapshot(consulta, (resultados) => {
      const lista: any[] = [];
      resultados.forEach((documento) => {
        lista.push({ id: documento.id, ...documento.data() });
      });

      lista.sort((a, b) => {
        const dataA = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
        const dataB = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
        return dataB - dataA;
      });

      setTodosLancamentos(lista);
    });

    return () => pararDeOuvir();
  }, []);

  useEffect(() => {
    const mesFiltro = dataFiltro.getMonth(); 
    const anoFiltro = dataFiltro.getFullYear();

    let somaReceitas = 0;
    let somaDespesas = 0;
    const listaProjetada: any[] = [];

    todosLancamentos.forEach((item) => {
      if (!item.dataVencimento) return;

      const partes = item.dataVencimento.split('/');
      if (partes.length !== 3) return;

      const vencMesOrigem = parseInt(partes[1]) - 1;
      const vencAnoOrigem = parseInt(partes[2]);
      const diaVencimento = partes[0];

      const diferencaMeses = (anoFiltro - vencAnoOrigem) * 12 + (mesFiltro - vencMesOrigem);

      if (diferencaMeses === 0) {
        listaProjetada.push({ ...item });
      } 
      else if (item.recorrencia === 'fixa' && diferencaMeses > 0) {
        listaProjetada.push({ 
          ...item, 
          id: `${item.id}_proj_${mesFiltro}_${anoFiltro}`,
          dataVencimento: `${diaVencimento}/${String(mesFiltro + 1).padStart(2, '0')}/${anoFiltro}`,
          status: 'pendente',
          dataPagamento: null 
        });
      } 
      else if (item.recorrencia === 'parcelada' && diferencaMeses > 0 && item.totalParcelas) {
        const parcelaAtualProjetada = (item.parcelaAtual || 1) + diferencaMeses;
        if (parcelaAtualProjetada <= item.totalParcelas) {
          listaProjetada.push({ 
            ...item, 
            id: `${item.id}_proj_${mesFiltro}_${anoFiltro}`,
            dataVencimento: `${diaVencimento}/${String(mesFiltro + 1).padStart(2, '0')}/${anoFiltro}`,
            parcelaAtual: parcelaAtualProjetada,
            descricao: `${item.descricao} (${parcelaAtualProjetada}/${item.totalParcelas})`,
            status: 'pendente',
            dataPagamento: null
          });
        }
      }
    });

    listaProjetada.forEach((item) => {
      if (item.tipo === 'receita') somaReceitas += item.valor;
      if (item.tipo === 'despesa') somaDespesas += item.valor;
    });

    setTotalReceitas(somaReceitas);
    setTotalDespesas(somaDespesas);
    setLancamentosFiltrados(listaProjetada);
  }, [todosLancamentos, dataFiltro]);

  const fazerLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/'); 
    } catch (erro) {
      alert("Erro ao sair.");
    }
  };

  const apagarLancamento = async (idString: string, nomeDaConta: string) => {
    const partesId = idString.split('_proj_');
    const isProj = partesId.length > 1;
    const idReal = partesId[0];

    const mensagem = isProj 
      ? `Deseja apagar '${nomeDaConta}' deste mês em diante?\n(Os meses anteriores ficarão salvos no histórico)`
      : `Tem a certeza que quer apagar a raiz de '${nomeDaConta}'?\n(Isto apagará todos os meses futuros)`;

    const apagar = async () => {
      try {
        if (isProj) {
          const mesProjStr = partesId[1].split('_')[0];
          const anoProjStr = partesId[1].split('_')[1];
          const baseItem = todosLancamentos.find(l => l.id === idReal);
          
          if (baseItem) {
            const mesProj = parseInt(mesProjStr);
            const anoProj = parseInt(anoProjStr);
            const partesBase = baseItem.dataVencimento.split('/');
            const baseMes = parseInt(partesBase[1]) - 1;
            const baseAno = parseInt(partesBase[2]);
            const diferencaMeses = (anoProj - baseAno) * 12 + (mesProj - baseMes);

            const updateOriginal: any = {
              recorrencia: 'parcelada',
              totalParcelas: baseItem.recorrencia === 'parcelada' 
                ? (baseItem.parcelaAtual || 1) + diferencaMeses - 1 
                : diferencaMeses
            };
            if (baseItem.recorrencia !== 'parcelada') updateOriginal.parcelaAtual = 1;

            await updateDoc(doc(db, 'lancamentos', idReal), updateOriginal);
          }
        } else {
          await deleteDoc(doc(db, 'lancamentos', idReal));
        }
      } catch (error) {
        alert("Erro ao apagar o lançamento.");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(mensagem)) apagar();
    } else {
      Alert.alert("Apagar Lançamento", mensagem, [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: apagar }
      ]);
    }
  };

  const consultarLancamento = (item: any) => {
    let msg = `Detalhes Gerais:\nValor Total: R$ ${item.valor.toFixed(2).replace('.', ',')}\nVencimento: ${item.dataVencimento}\nCategoria: ${item.categoria}\nObservações: ${item.observacoes || 'Nenhuma'}`;
    
    if (item.detalhes && item.detalhes.length > 0) {
      msg += `\n\n--- ITENS DESMEMBRADOS ---\n`;
      item.detalhes.forEach((d: any) => {
        msg += `• ${d.descricao} | R$ ${d.valor.toFixed(2).replace('.', ',')} | ${d.categoria}\n`;
      });
    }

    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert("Consultar Lançamento", msg);
    }
  };

  const editarLancamento = (item: any) => {
    router.push(`/editar/${item.id}` as any);
  };

  const formatarDinheiro = (numero: number) => {
    return `R$ ${numero.toFixed(2).replace('.', ',')}`;
  };

  const alterarMes = (delta: number) => {
    const novaData = new Date(dataFiltro);
    novaData.setMonth(novaData.getMonth() + delta);
    setDataFiltro(novaData);
  };

  const getStatusInfo = (status: string, dataVencimento: string) => {
    if (status === 'pago') return { texto: 'Pago', corFundo: '#d4edda', corTexto: '#155724' };
    if (!dataVencimento) return { texto: 'Pendente', corFundo: '#fff3cd', corTexto: '#856404' };

    const partes = dataVencimento.split('/');
    if (partes.length === 3) {
      const dataVenc = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); 
      if (dataVenc < hoje) return { texto: 'Atrasado', corFundo: '#f8d7da', corTexto: '#721c24' }; 
    }
    return { texto: 'Pendente', corFundo: '#fff3cd', corTexto: '#856404' }; 
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          {/* Título com tamanho controlado e não gigantesco */}
          <Text style={styles.tituloPrincipal}>Visão Geral</Text>
          <View style={{ borderRadius: 8, overflow: 'hidden' }}>
            <Button title="Sair" onPress={fazerLogout} color="#ff4444" />
          </View>
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

        <View style={styles.cartaoSaldo}>
          <ThemedText style={styles.saldoTitulo}>Saldo Atual ({nomesMeses[dataFiltro.getMonth()]})</ThemedText>
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

        <ThemedText style={styles.tituloExtrato}>Recentes</ThemedText>
        
        <FlatList
          data={lancamentosFiltrados}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const statusInfo = getStatusInfo(item.status, item.dataVencimento);

            return (
              <View style={[styles.itemLista, { backgroundColor: statusInfo.corFundo, borderColor: statusInfo.corTexto, borderWidth: 1 }]}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemDescricao, { color: '#000' }]} numberOfLines={1}>{item.descricao}</Text>
                  <Text style={[styles.itemDetalhes, { color: statusInfo.corTexto }]}>
                    Vence em: {item.dataVencimento || 'N/A'} • {statusInfo.texto}
                  </Text>
                  <Text style={[styles.itemValor, item.tipo === 'receita' ? styles.textoReceita : styles.textoDespesa]}>
                    {item.tipo === 'receita' ? '+ ' : '- '}
                    {formatarDinheiro(item.valor)}
                  </Text>
                </View>

                <View style={styles.itemAcoes}>
                  <TouchableOpacity onPress={() => consultarLancamento(item)} style={styles.botaoAcao}>
                    <Text style={styles.iconeAcao}>👁️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => editarLancamento(item)} style={styles.botaoAcao}>
                    <Text style={styles.iconeAcao}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => apagarLancamento(item.id, item.descricao)} style={styles.botaoAcao}>
                    <Text style={styles.textoApagar}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<ThemedText style={styles.listaVazia}>Nenhum lançamento em {nomesMeses[dataFiltro.getMonth()]}.</ThemedText>}
        />

        <View style={styles.acoes}>
          {/* Botão Novo Lançamento ocupando a largura total */}
          <TouchableOpacity style={styles.botaoPrimario} onPress={() => router.push('/novo-lancamento' as any)}>
            <Text style={styles.textoBotaoAcao}>+ NOVO LANÇAMENTO</Text>
          </TouchableOpacity>
          
          {/* Compras e Relatórios lado a lado */}
          <View style={styles.linhaBotoes}>
            <TouchableOpacity style={[styles.botaoSecundario, { flex: 1 }]} onPress={() => router.push('/lista-compras' as any)}>
              <Text style={styles.textoBotaoAcao}>🛒 COMPRAS</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.botaoRelatorio, { flex: 1 }]} onPress={() => router.push('/relatorios' as any)}>
              <Text style={styles.textoBotaoAcao}>📊 RELATÓRIOS</Text>
            </TouchableOpacity>
          </View>
        </View>

      </SafeAreaView>
    </ThemedView>
  );
}

// ESTILOS TOTALMENTE COMPACTADOS PARA TELEMÓVEL
const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 15, paddingTop: 5 },
  
  // Cabeçalho mais elegante e não gigante
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  tituloPrincipal: { fontSize: 24, fontWeight: 'bold', color: '#111' },
  
  seletorMes: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  botaoMes: { padding: 5, paddingHorizontal: 15 },
  setaMes: { fontSize: 20, color: '#007AFF', fontWeight: 'bold' },
  textoMes: { fontSize: 16, fontWeight: 'bold', minWidth: 140, textAlign: 'center' },
  
  // Cartões mais compactos (Padding de 15 para 10)
  cartaoSaldo: { alignItems: 'center', padding: 10, backgroundColor: '#f0f4f8', borderRadius: 10, marginBottom: 10 },
  saldoTitulo: { fontSize: 12, color: '#555', marginBottom: 2 },
  saldoValor: { fontSize: 24, fontWeight: 'bold' },
  
  cardsContainer: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  cardReceita: { backgroundColor: '#e6f4ea' },
  cardDespesa: { backgroundColor: '#fce8e6' },
  cardTitulo: { fontSize: 12, color: '#555', marginBottom: 2 },
  cardValorPequeno: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  
  tituloExtrato: { marginTop: 15, marginBottom: 8, fontSize: 16, fontWeight: 'bold' },
  
  lista: { flex: 1 },
  // Lista compacta (padding 10, margins menores)
  itemLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8 },
  itemInfo: { flex: 1, paddingRight: 5 },
  itemDescricao: { fontSize: 15, fontWeight: 'bold' },
  itemDetalhes: { fontSize: 12, marginTop: 2, marginBottom: 2, fontWeight: '600' },
  itemValor: { fontSize: 15, fontWeight: 'bold' },
  textoReceita: { color: '#28a745' },
  textoDespesa: { color: '#dc3545' },
  
  itemAcoes: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botaoAcao: { padding: 4 },
  iconeAcao: { fontSize: 18 },
  textoApagar: { color: '#ff4444', fontSize: 18, fontWeight: 'bold' },
  
  listaVazia: { textAlign: 'center', color: '#999', marginTop: 20 },
  acoes: { marginTop: 10, marginBottom: 15, gap: 10 },
  linhaBotoes: { flexDirection: 'row', gap: 10 },
  botaoPrimario: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  botaoSecundario: { backgroundColor: '#34a853', padding: 12, borderRadius: 8, alignItems: 'center' },
  botaoRelatorio: { backgroundColor: '#ff9500', padding: 12, borderRadius: 8, alignItems: 'center' },
  textoBotaoAcao: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});