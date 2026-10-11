import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TipoLancamento, TipoRecorrencia } from '@/types/lancamento';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import DateTimePicker from '@react-native-community/datetimepicker';

const CATEGORIAS_RECEITA_PADRAO = ['Salário', 'Vendas', 'Investimentos'];
const CATEGORIAS_DESPESA_PADRAO = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Impostos'];
const CONTAS_BANCARIAS = ['Carteira', 'Nubank', 'Itaú', 'Inter', 'Bradesco'];
const RECORRENCIAS = ['Nenhuma', 'Fixa (Mensal)', 'Parcelada'];

export default function EditarLancamentoScreen() {
  const { id } = useLocalSearchParams();
  
  // LÓGICA DE IDENTIFICAÇÃO DE PROJEÇÃO
  const idString = (id as string) || '';
  const partesId = idString.split('_proj_');
  const isProj = partesId.length > 1;
  const idReal = partesId[0];

  const [baseLancamento, setBaseLancamento] = useState<any>(null); // Guarda a raiz

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [carregandoSalvar, setCarregandoSalvar] = useState(false);

  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Outros');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [categoriasFirebase, setCategoriasFirebase] = useState<any[]>([]);
  
  const [contaSelecionada, setContaSelecionada] = useState('Carteira');
  const [dataVencimento, setDataVencimento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [estaPago, setEstaPago] = useState(true);
  
  const [mostrarCalendarioVenc, setMostrarCalendarioVenc] = useState(false);
  const [mostrarCalendarioPag, setMostrarCalendarioPag] = useState(false);

  const [recorrenciaSelecionada, setRecorrenciaSelecionada] = useState('Nenhuma');
  const [totalParcelas, setTotalParcelas] = useState('');
  const [linkComprovante, setLinkComprovante] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    const buscarCategorias = async () => {
      try {
        const q = query(collection(db, 'categorias'), where('tipo', '==', tipo));
        const querySnapshot = await getDocs(q);
        const cats = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        setCategoriasFirebase(cats);
      } catch (error) { }
    };
    buscarCategorias();
  }, [tipo]);

  useEffect(() => {
    const buscarLancamento = async () => {
      if (!idReal) return;
      try {
        const docRef = doc(db, 'lancamentos', idReal);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const dados = docSnap.data();
          setBaseLancamento(dados);
          
          setTipo(dados.tipo);
          setDescricao(dados.descricao);
          setValor(dados.valor.toFixed(2).replace('.', ',')); 
          setContaSelecionada(dados.contaBancaria);
          setLinkComprovante(dados.linkComprovante || '');
          setObservacoes(dados.observacoes || '');

          const eCategoriaPadrao = CATEGORIAS_RECEITA_PADRAO.includes(dados.categoria) || CATEGORIAS_DESPESA_PADRAO.includes(dados.categoria);
          setCategoriaSelecionada(dados.categoria);

          if (dados.recorrencia === 'fixa') setRecorrenciaSelecionada('Fixa (Mensal)');
          else if (dados.recorrencia === 'parcelada') {
            setRecorrenciaSelecionada('Parcelada');
            setTotalParcelas(dados.totalParcelas?.toString() || '');
          } else {
            setRecorrenciaSelecionada('Nenhuma');
          }

          // MAGIA AQUI: Se for uma projeção, a tela carrega a data futura e desmarca o "Pago"
          if (isProj) {
            const mesProj = parseInt(partesId[1].split('_')[0]);
            const anoProj = parseInt(partesId[1].split('_')[1]);
            const diaVenc = dados.dataVencimento.split('/')[0];
            
            setDataVencimento(`${diaVenc}/${String(mesProj + 1).padStart(2, '0')}/${anoProj}`);
            setEstaPago(false);
            setDataPagamento('');
          } else {
            setDataVencimento(dados.dataVencimento || '');
            setDataPagamento(dados.dataPagamento || '');
            setEstaPago(dados.status === 'pago');
          }
        }
      } catch (error) {
        alert("Erro ao carregar os dados.");
      } finally {
        setCarregandoDados(false);
      }
    };
    buscarLancamento();
  }, [idReal]);

  const aplicarMascaraMoeda = (texto: string) => {
    let apenasNumeros = texto.replace(/\D/g, '');
    if (apenasNumeros === '') {
      setValor(''); return;
    }
    let valorDecimal = (parseInt(apenasNumeros, 10) / 100).toFixed(2);
    let valorFormatado = valorDecimal.replace('.', ',');
    valorFormatado = valorFormatado.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    setValor(valorFormatado);
  };

  const salvarEdicao = async () => {
    if (descricao === '' || valor === '') {
      alert("Por favor, preencha a descrição e o valor."); return;
    }
    if (estaPago && dataPagamento === '') {
      alert("Por favor, preencha a Data do Pagamento ou desmarque 'Pago'."); return;
    }

    setCarregandoSalvar(true);
    let valorLimpo = valor.replace(/\./g, '').replace(',', '.');
    const valorNumerico = parseFloat(valorLimpo);

    if (isNaN(valorNumerico)) {
      alert("O valor digitado não é um número válido.");
      setCarregandoSalvar(false); return;
    }

    let tipoRec: TipoRecorrencia = 'nenhuma';
    if (recorrenciaSelecionada === 'Fixa (Mensal)') tipoRec = 'fixa';
    if (recorrenciaSelecionada === 'Parcelada') tipoRec = 'parcelada';

    let categoriaFinal = categoriaSelecionada;
    if (categoriaSelecionada === 'Outros') {
      if (novaCategoria.trim() === '') {
        alert("Por favor, digite o nome da categoria.");
        setCarregandoSalvar(false); return;
      }
      categoriaFinal = novaCategoria.trim();
    }

    const dadosAtualizados: any = {
      tipo: tipo,
      descricao: descricao,
      valor: valorNumerico,
      categoria: categoriaFinal,
      contaBancaria: contaSelecionada,
      status: estaPago ? 'pago' : 'pendente', 
      dataVencimento: dataVencimento,
      dataPagamento: estaPago ? dataPagamento : null, 
      recorrencia: tipoRec,
      linkComprovante: linkComprovante || '',
      observacoes: observacoes || ''
    };

    if (tipoRec === 'parcelada') {
      dadosAtualizados.totalParcelas = parseInt(totalParcelas) || 1;
    }

    try {
      if (!isProj) {
        // Se a pessoa clicou no lançamento original, altera tudo normalmente
        const docRef = doc(db, 'lancamentos', idReal);
        await updateDoc(docRef, dadosAtualizados);
      } else {
        // SE FOR PROJEÇÃO: Divide o histórico (A MÁGICA FINAL!)
        const mesProj = parseInt(partesId[1].split('_')[0]);
        const anoProj = parseInt(partesId[1].split('_')[1]);
        const partesBase = baseLancamento.dataVencimento.split('/');
        const baseMes = parseInt(partesBase[1]) - 1;
        const baseAno = parseInt(partesBase[2]);
        
        const diferencaMeses = (anoProj - baseAno) * 12 + (mesProj - baseMes);

        // 1. Encerra a recorrência original no mês passado
        const updateOriginal: any = {
          recorrencia: 'parcelada',
          totalParcelas: baseLancamento.recorrencia === 'parcelada' 
            ? (baseLancamento.parcelaAtual || 1) + diferencaMeses - 1 
            : diferencaMeses
        };
        if (baseLancamento.recorrencia !== 'parcelada') updateOriginal.parcelaAtual = 1;
        await updateDoc(doc(db, 'lancamentos', idReal), updateOriginal);

        // 2. Cria o NOVO lançamento raiz a partir deste mês
        if (tipoRec === 'parcelada') {
          dadosAtualizados.parcelaAtual = baseLancamento.recorrencia === 'parcelada'
            ? (baseLancamento.parcelaAtual || 1) + diferencaMeses
            : 1;
        }
        dadosAtualizados.grupoRecorrenciaId = baseLancamento.grupoRecorrenciaId || Date.now().toString();
        dadosAtualizados.uid = auth?.currentUser?.uid || 'usuario-anonimo';
        dadosAtualizados.dataCriacao = new Date().toISOString();

        await addDoc(collection(db, 'lancamentos'), dadosAtualizados);
      }
      
      router.back(); 
    } catch (erro) {
      alert("Erro ao atualizar o lançamento.");
      setCarregandoSalvar(false);
    }
  };

  const mudarTipo = (novoTipo: TipoLancamento) => {
    setTipo(novoTipo);
    setCategoriaSelecionada('Outros');
    setNovaCategoria('');
  };

  const converterParaDataObj = (dataStr: string) => {
    if (!dataStr) return new Date();
    const partes = dataStr.split('/');
    if (partes.length !== 3) return new Date();
    return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
  };

  const formatarParaWeb = (dataStr: string) => {
    if (!dataStr) return '';
    const partes = dataStr.split('/');
    if (partes.length !== 3) return '';
    return `${partes[2]}-${partes[1]}-${partes[0]}`; 
  };

  const lerDataWeb = (dataStrWeb: string) => {
    if (!dataStrWeb) return '';
    const partes = dataStrWeb.split('-');
    if (partes.length !== 3) return '';
    return `${partes[2]}/${partes[1]}/${partes[0]}`; 
  };

  const basePadrao = tipo === 'receita' ? CATEGORIAS_RECEITA_PADRAO : CATEGORIAS_DESPESA_PADRAO;
  const nomesFirebase = categoriasFirebase.map(c => c.nome);
  
  const todasCats = [...basePadrao, ...nomesFirebase, 'Outros'];
  if (categoriaSelecionada !== 'Outros' && !todasCats.includes(categoriaSelecionada)) {
    todasCats.push(categoriaSelecionada);
  }
  const categoriasExibicao = Array.from(new Set(todasCats));

  if (carregandoDados) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10 }}>A carregar lançamento...</Text>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.botaoVoltar}>
            <Text style={styles.textoVoltar}>{"< Voltar"}</Text>
          </TouchableOpacity>
          <ThemedText type="subtitle">Editar Lançamento</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.formulario} showsVerticalScrollIndicator={false}>
          
          <ThemedText style={styles.label}>Tipo de Movimentação</ThemedText>
          <View style={styles.seletorTipo}>
            <TouchableOpacity style={[styles.botaoTipo, tipo === 'receita' ? styles.botaoReceitaAtivo : null]} onPress={() => mudarTipo('receita')}>
              <Text style={tipo === 'receita' ? styles.textoBranco : styles.textoEscuro}>Receita</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botaoTipo, tipo === 'despesa' ? styles.botaoDespesaAtivo : null]} onPress={() => mudarTipo('despesa')}>
              <Text style={tipo === 'despesa' ? styles.textoBranco : styles.textoEscuro}>Despesa</Text>
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.label}>Descrição</ThemedText>
          <TextInput style={styles.input} placeholder="Ex: Conta de Luz (CPFL)" placeholderTextColor="#999" value={descricao} onChangeText={setDescricao} />

          <ThemedText style={styles.label}>Valor (R$)</ThemedText>
          <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#999" value={valor} onChangeText={aplicarMascaraMoeda} keyboardType="numeric" />

          <ThemedText style={styles.label}>Categoria</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
            {categoriasExibicao.map((cat) => {
              return (
                <TouchableOpacity key={cat} style={[styles.chip, categoriaSelecionada === cat ? styles.chipAtivo : null]} onPress={() => setCategoriaSelecionada(cat)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={categoriaSelecionada === cat ? styles.textoBranco : styles.textoEscuro}>{cat}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {categoriaSelecionada === 'Outros' && (
            <View style={{ marginBottom: 15, marginTop: -5 }}>
              <TextInput style={styles.input} placeholder="Qual o nome da categoria?" placeholderTextColor="#999" value={novaCategoria} onChangeText={setNovaCategoria} />
            </View>
          )}

          <ThemedText style={styles.label}>Conta Bancária / Origem</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
            {CONTAS_BANCARIAS.map((conta) => (
              <TouchableOpacity key={conta} style={[styles.chip, contaSelecionada === conta ? styles.chipAtivo : null]} onPress={() => setContaSelecionada(conta)}>
                <Text style={contaSelecionada === conta ? styles.textoBranco : styles.textoEscuro}>{conta}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <ThemedText style={styles.label}>Vencimento</ThemedText>
              {Platform.OS === 'web' ? (
                <input type="date" value={formatarParaWeb(dataVencimento)} onChange={(e) => setDataVencimento(lerDataWeb(e.target.value))} style={{ backgroundColor: '#f9f9f9', border: '1px solid #ddd', padding: '14px', borderRadius: '8px', fontSize: '16px', color: '#333', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              ) : (
                <TouchableOpacity onPress={() => setMostrarCalendarioVenc(true)}>
                  <View style={[styles.input, { justifyContent: 'center' }]}>
                    <Text style={{ color: dataVencimento ? '#333' : '#999', fontSize: 16 }}>{dataVencimento || 'DD/MM/AAAA'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              {mostrarCalendarioVenc && Platform.OS !== 'web' && (
                <DateTimePicker value={converterParaDataObj(dataVencimento)} mode="date" display="default" onChange={(event, selectedDate) => { setMostrarCalendarioVenc(false); if (selectedDate) setDataVencimento(selectedDate.toLocaleDateString('pt-BR')); }} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={styles.label}>Situação</ThemedText>
              <TouchableOpacity style={[styles.chipStatus, estaPago ? styles.statusPago : styles.statusPendente]} onPress={() => setEstaPago(!estaPago)}>
                <Text style={styles.textoBranco}>{estaPago ? '✅ Pago' : '⏳ Pendente'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {estaPago ? (
            <View>
              <ThemedText style={styles.label}>Data do Pagamento Efetivo</ThemedText>
              {Platform.OS === 'web' ? (
                <input type="date" value={formatarParaWeb(dataPagamento)} onChange={(e) => setDataPagamento(lerDataWeb(e.target.value))} style={{ backgroundColor: '#f9f9f9', border: '1px solid #ddd', padding: '14px', borderRadius: '8px', fontSize: '16px', color: '#333', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
              ) : (
                <TouchableOpacity onPress={() => setMostrarCalendarioPag(true)}>
                  <View style={[styles.input, { justifyContent: 'center' }]}>
                    <Text style={{ color: dataPagamento ? '#333' : '#999', fontSize: 16 }}>{dataPagamento || 'Selecione a data...'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              {mostrarCalendarioPag && Platform.OS !== 'web' && (
                <DateTimePicker value={dataPagamento ? converterParaDataObj(dataPagamento) : new Date()} mode="date" display="default" onChange={(event, selectedDate) => { setMostrarCalendarioPag(false); if (selectedDate) setDataPagamento(selectedDate.toLocaleDateString('pt-BR')); }} />
              )}
            </View>
          ) : null}

          <ThemedText style={styles.label}>Recorrência</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
            {RECORRENCIAS.map((rec) => (
              <TouchableOpacity key={rec} style={[styles.chip, recorrenciaSelecionada === rec ? styles.chipAtivo : null]} onPress={() => setRecorrenciaSelecionada(rec)}>
                <Text style={recorrenciaSelecionada === rec ? styles.textoBranco : styles.textoEscuro}>{rec}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {recorrenciaSelecionada === 'Parcelada' ? (
            <View>
              <ThemedText style={styles.label}>Quantidade de Parcelas</ThemedText>
              <TextInput style={styles.input} placeholder="Ex: 12" placeholderTextColor="#999" value={totalParcelas} onChangeText={setTotalParcelas} keyboardType="numeric" />
            </View>
          ) : null}

          <ThemedText style={styles.label}>Link do Recibo (Google Drive, etc)</ThemedText>
          <TextInput style={styles.input} placeholder="Cole o link da fatura aqui..." placeholderTextColor="#999" value={linkComprovante} onChangeText={setLinkComprovante} />

          <ThemedText style={styles.label}>Observações Extras</ThemedText>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Detalhes adicionais..." placeholderTextColor="#999" value={observacoes} onChangeText={setObservacoes} multiline={true} />
          
          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.rodape}>
          <Button title={carregandoSalvar ? "A ATUALIZAR..." : "SALVAR ALTERAÇÕES"} onPress={salvarEdicao} color="#ff9500" />
        </View>

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
  formulario: { flex: 1 },
  label: { fontSize: 14, color: '#555', marginBottom: 8, marginTop: 15, fontWeight: 'bold' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, fontSize: 16, color: '#333', minHeight: 52 },
  seletorTipo: { flexDirection: 'row', gap: 10 },
  botaoTipo: { flex: 1, padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  botaoReceitaAtivo: { backgroundColor: '#34a853', borderColor: '#34a853' },
  botaoDespesaAtivo: { backgroundColor: '#ea4335', borderColor: '#ea4335' },
  scrollHorizontal: { flexDirection: 'row', marginBottom: 10 },
  chip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 10, borderWidth: 1, borderColor: '#ddd' },
  chipAtivo: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  row: { flexDirection: 'row', alignItems: 'center' },
  chipStatus: { padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusPago: { backgroundColor: '#34a853' },
  statusPendente: { backgroundColor: '#fbbc05' },
  textoBranco: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  textoEscuro: { color: '#555', fontSize: 14 },
  rodape: { paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' }
});