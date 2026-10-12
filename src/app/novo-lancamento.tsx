import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Button, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TipoLancamento, TipoRecorrencia } from '@/types/lancamento';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import DateTimePicker from '@react-native-community/datetimepicker';

const CATEGORIAS_RECEITA_PADRAO = ['Salário', 'Vendas', 'Investimentos'];
const CATEGORIAS_DESPESA_PADRAO = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Impostos'];
const RECORRENCIAS = ['Nenhuma', 'Fixa (Mensal)', 'Parcelada'];

export default function NovoLancamentoScreen() {
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  
  const [detalhes, setDetalhes] = useState<any[]>([]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Outros');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [categoriasFirebase, setCategoriasFirebase] = useState<any[]>([]);
  
  const [contasFirebase, setContasFirebase] = useState<any[]>([]);
  const [contaSelecionada, setContaSelecionada] = useState('Carteira');
  
  const hojeFormatoSimples = new Date().toLocaleDateString('pt-BR');
  const [dataVencimento, setDataVencimento] = useState(hojeFormatoSimples);
  const [dataPagamento, setDataPagamento] = useState('');
  
  const [estaPago, setEstaPago] = useState(false);
  
  const [mostrarCalendarioVenc, setMostrarCalendarioVenc] = useState(false);
  const [mostrarCalendarioPag, setMostrarCalendarioPag] = useState(false);

  const [recorrenciaSelecionada, setRecorrenciaSelecionada] = useState('Nenhuma');
  const [totalParcelas, setTotalParcelas] = useState('');
  const [linkComprovante, setLinkComprovante] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const buscarCategorias = async () => {
      try {
        const q = query(collection(db, 'categorias'), where('tipo', '==', tipo));
        const querySnapshot = await getDocs(q);
        const cats = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        setCategoriasFirebase(cats);
      } catch (error) {}
    };
    buscarCategorias();
  }, [tipo]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid || 'usuario-anonimo';
    const q = query(collection(db, 'contas'), where('uid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const accs = snap.docs.map(d => ({ id: d.id, nome: d.data().nome }));
      if(accs.length === 0) {
        accs.push({ id: 'padrao', nome: 'Carteira' });
      }
      setContasFirebase(accs);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (contasFirebase.length > 0) {
      const existe = contasFirebase.find(c => c.nome === contaSelecionada);
      if (!existe) {
        setContaSelecionada(contasFirebase[0].nome);
      }
    }
  }, [contasFirebase]);

  useEffect(() => {
    if (detalhes.length > 0) {
      const soma = detalhes.reduce((acc, d) => {
        let valLimpo = d.valor.replace(/\./g, '').replace(',', '.');
        let valNum = parseFloat(valLimpo) || 0;
        return acc + valNum;
      }, 0);
      
      let vDec = soma.toFixed(2);
      let vForm = vDec.replace('.', ',');
      vForm = vForm.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      setValor(vForm);
    }
  }, [detalhes]);

  const confirmarDeletarCategoria = (nomeCat: string) => {
    const catDb = categoriasFirebase.find(c => c.nome === nomeCat);
    if (!catDb) return; 

    const apagar = async () => {
      try {
        await deleteDoc(doc(db, 'categorias', catDb.id));
        setCategoriasFirebase(prev => prev.filter(c => c.id !== catDb.id));
        if (categoriaSelecionada === nomeCat) setCategoriaSelecionada('Outros');
      } catch (e) {}
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja excluir a categoria '${nomeCat}'?`)) apagar();
    } else {
      Alert.alert("Excluir", `Deseja excluir a categoria '${nomeCat}'?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: apagar }
      ]);
    }
  };

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

  const adicionarDetalhe = () => {
    setDetalhes([...detalhes, { id: Date.now().toString(), descricao: '', valor: '', categoria: '' }]);
  };

  const removerDetalhe = (id: string) => {
    setDetalhes(detalhes.filter(d => d.id !== id));
  };

  const atualizarDetalhe = (id: string, campo: string, texto: string) => {
    setDetalhes(detalhes.map(d => {
      if (d.id === id) {
        if (campo === 'valor') {
          let apenasNumeros = texto.replace(/\D/g, '');
          if (apenasNumeros === '') return { ...d, valor: '' };
          let vDec = (parseInt(apenasNumeros, 10) / 100).toFixed(2);
          let vForm = vDec.replace('.', ',');
          vForm = vForm.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
          return { ...d, valor: vForm };
        }
        return { ...d, [campo]: texto };
      }
      return d;
    }));
  };

  const salvarLancamento = async () => {
    if (descricao === '' || valor === '') {
      alert("Por favor, preencha a descrição e o valor (ou 0, se for variável)."); return;
    }
    if (estaPago && dataPagamento === '') {
      alert("Por favor, preencha a Data do Pagamento Efetivo ou desmarque a opção 'Pago'."); return;
    }

    if (detalhes.length > 0) {
      const temVazio = detalhes.some(d => d.descricao === '' || d.valor === '' || d.categoria === '');
      if (temVazio) {
        alert("Preencha todos os campos do detalhamento ou remova a linha vazia."); return;
      }
    }

    setCarregando(true);
    let valorLimpo = valor.replace(/\./g, '').replace(',', '.');
    const valorNumerico = parseFloat(valorLimpo);

    if (isNaN(valorNumerico)) {
      alert("O valor digitado não é um número válido.");
      setCarregando(false); return;
    }

    let tipoRec: TipoRecorrencia = 'nenhuma';
    if (recorrenciaSelecionada === 'Fixa (Mensal)') tipoRec = 'fixa';
    if (recorrenciaSelecionada === 'Parcelada') tipoRec = 'parcelada';

    let categoriaFinal = categoriaSelecionada;
    if (categoriaSelecionada === 'Outros') {
      if (novaCategoria.trim() === '') {
        alert("Por favor, digite o nome da nova categoria.");
        setCarregando(false); return;
      }
      categoriaFinal = novaCategoria.trim();
      try {
        await addDoc(collection(db, 'categorias'), { nome: categoriaFinal, tipo: tipo, criadoEm: new Date().toISOString() });
      } catch (e) {}
    }

    const detalhesParaSalvar = detalhes.map(d => {
      let vLimpo = d.valor.replace(/\./g, '').replace(',', '.');
      return { descricao: d.descricao, valor: parseFloat(vLimpo) || 0, categoria: d.categoria };
    });

    const grupoId = Date.now().toString();

    // Molde base do lançamento
    const baseLancamento: any = {
      uid: auth?.currentUser?.uid || 'usuario-anonimo',
      tipo: tipo,
      descricao: descricao,
      categoria: categoriaFinal,
      contaBancaria: contaSelecionada,
      recorrencia: tipoRec,
      grupoRecorrenciaId: grupoId,
      linkComprovante: linkComprovante || '',
      observacoes: observacoes || '',
      dataCriacao: new Date().toISOString()
    };

    try {
      const partes = dataVencimento.split('/');
      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10);
      const ano = parseInt(partes[2], 10);

      if (tipoRec === 'fixa') {
        // 1. Guarda o primeiro mês com o valor real introduzido
        await addDoc(collection(db, 'lancamentos'), {
          ...baseLancamento,
          valor: valorNumerico,
          status: estaPago ? 'pago' : 'pendente',
          dataVencimento: dataVencimento,
          dataPagamento: estaPago ? dataPagamento : null,
          detalhes: detalhesParaSalvar.length > 0 ? detalhesParaSalvar : null
        });

        // 2. Cria os próximos 12 meses zerados
        for (let i = 1; i <= 12; i++) {
          let pMes = mes + i;
          let pAno = ano;
          if (pMes > 12) {
            pAno += Math.floor((pMes - 1) / 12);
            pMes = ((pMes - 1) % 12) + 1;
          }
          
          let dt = new Date(pAno, pMes - 1, dia);
          if (dt.getMonth() !== pMes - 1) dt = new Date(pAno, pMes, 0); // Ajuste para finais de mês (ex: 31 de Fev não existe)

          const dataStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;

          await addDoc(collection(db, 'lancamentos'), {
            ...baseLancamento,
            valor: 0, // <-- Aqui garantimos que os próximos meses aparecem zerados
            status: 'pendente',
            dataVencimento: dataStr,
            dataPagamento: null,
            detalhes: detalhesParaSalvar.length > 0 ? detalhesParaSalvar.map((d: any) => ({ ...d, valor: 0 })) : null
          });
        }
      } 
      else if (tipoRec === 'parcelada') {
        const qtd = parseInt(totalParcelas) || 1;
        // Cria todas as parcelas projetando os meses para a frente
        for (let i = 0; i < qtd; i++) {
          let pMes = mes + i;
          let pAno = ano;
          if (pMes > 12) {
            pAno += Math.floor((pMes - 1) / 12);
            pMes = ((pMes - 1) % 12) + 1;
          }
          
          let dt = new Date(pAno, pMes - 1, dia);
          if (dt.getMonth() !== pMes - 1) dt = new Date(pAno, pMes, 0);

          const dataStr = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;

          await addDoc(collection(db, 'lancamentos'), {
            ...baseLancamento,
            valor: valorNumerico,
            status: i === 0 && estaPago ? 'pago' : 'pendente',
            dataVencimento: dataStr,
            dataPagamento: i === 0 && estaPago ? dataPagamento : null,
            detalhes: detalhesParaSalvar.length > 0 ? detalhesParaSalvar : null,
            totalParcelas: qtd,
            parcelaAtual: i + 1
          });
        }
      } 
      else {
        // Sem recorrência (Lançamento Único)
        await addDoc(collection(db, 'lancamentos'), {
          ...baseLancamento,
          valor: valorNumerico,
          status: estaPago ? 'pago' : 'pendente',
          dataVencimento: dataVencimento,
          dataPagamento: estaPago ? dataPagamento : null,
          detalhes: detalhesParaSalvar.length > 0 ? detalhesParaSalvar : null
        });
      }

      router.back(); 
    } catch (erro) {
      alert("Erro ao guardar o lançamento.");
      setCarregando(false);
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
  const categoriasExibicao = Array.from(new Set([...basePadrao, ...nomesFirebase, 'Outros']));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.botaoVoltar}>
            <Text style={styles.textoVoltar}>{"< Voltar"}</Text>
          </TouchableOpacity>
          <ThemedText type="subtitle">Novo Lançamento</ThemedText>
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

          <ThemedText style={styles.label}>Descrição Geral</ThemedText>
          <TextInput style={styles.input} placeholder="Ex: Fatura Cartão de Crédito" placeholderTextColor="#999" value={descricao} onChangeText={setDescricao} />

          <ThemedText style={styles.label}>Categoria Geral</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
            {categoriasExibicao.map((cat) => {
              const isCustom = categoriasFirebase.find(c => c.nome === cat);
              return (
                <TouchableOpacity key={cat} style={[styles.chip, categoriaSelecionada === cat ? styles.chipAtivo : null]} onPress={() => setCategoriaSelecionada(cat)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={categoriaSelecionada === cat ? styles.textoBranco : styles.textoEscuro}>{cat}</Text>
                    {isCustom && (
                      <TouchableOpacity style={styles.botaoApagarCategoria} onPress={() => confirmarDeletarCategoria(cat)}>
                        <Text style={{ color: categoriaSelecionada === cat ? '#ffcccc' : '#ff4444', fontWeight: 'bold' }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {categoriaSelecionada === 'Outros' && (
            <View style={{ marginBottom: 15, marginTop: -5 }}>
              <TextInput style={styles.input} placeholder="Qual o nome da nova categoria?" placeholderTextColor="#999" value={novaCategoria} onChangeText={setNovaCategoria} />
            </View>
          )}

          <ThemedText style={styles.label}>Valor Total (R$)</ThemedText>
          <TextInput 
            style={[styles.input, detalhes.length > 0 && { backgroundColor: '#e9ecef', color: '#666' }]} 
            placeholder="0,00" 
            placeholderTextColor="#999" 
            value={valor} 
            onChangeText={aplicarMascaraMoeda} 
            keyboardType="numeric" 
            editable={detalhes.length === 0} 
          />
          {detalhes.length > 0 && <Text style={styles.textoAviso}>Valor calculado automaticamente pelos itens abaixo.</Text>}

          {detalhes.length > 0 && (
            <View style={styles.boxDetalhes}>
              <ThemedText style={{fontWeight: 'bold', marginBottom: 15, color: '#333'}}>Itens Desmembrados:</ThemedText>
              {detalhes.map((det, index) => (
                <View key={det.id} style={styles.linhaDetalhe}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{fontWeight: 'bold', color: '#555'}}>Item {index + 1}</Text>
                    <TouchableOpacity onPress={() => removerDetalhe(det.id)}>
                      <Text style={{color: '#ff4444', fontWeight: 'bold'}}>✕ Remover</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput style={[styles.input, {marginBottom: 8, padding: 10, minHeight: 45}]} placeholder="O que comprou? (Ex: Gasolina)" placeholderTextColor="#999" value={det.descricao} onChangeText={(txt) => atualizarDetalhe(det.id, 'descricao', txt)} />
                  
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                    <TextInput style={[styles.input, {flex: 1, padding: 10, minHeight: 45}]} placeholder="Valor (R$)" placeholderTextColor="#999" keyboardType="numeric" value={det.valor} onChangeText={(txt) => atualizarDetalhe(det.id, 'valor', txt)} />
                    <TextInput style={[styles.input, {flex: 1, padding: 10, minHeight: 45}]} placeholder="Categoria" placeholderTextColor="#999" value={det.categoria} onChangeText={(txt) => atualizarDetalhe(det.id, 'categoria', txt)} />
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
                    {categoriasExibicao.filter(c => c !== 'Outros').map((cat) => (
                      <TouchableOpacity key={cat} style={[styles.chipPequeno, det.categoria === cat ? styles.chipPequenoAtivo : null]} onPress={() => atualizarDetalhe(det.id, 'categoria', cat)}>
                        <Text style={det.categoria === cat ? styles.textoPequenoAtivo : styles.textoPequeno}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.botaoDetalhe} onPress={adicionarDetalhe}>
            <Text style={styles.textoBotaoDetalhe}>+ Adicionar Detalhamento (Opcional)</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 8 }}>
            <ThemedText style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>Conta Bancária / Origem</ThemedText>
            <TouchableOpacity onPress={() => router.push('/gerir-contas' as any)}>
              <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>⚙️ Gerir Contas</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
            {contasFirebase.map((conta) => (
              <TouchableOpacity key={conta.id} style={[styles.chip, contaSelecionada === conta.nome ? styles.chipAtivo : null]} onPress={() => setContaSelecionada(conta.nome)}>
                <Text style={contaSelecionada === conta.nome ? styles.textoBranco : styles.textoEscuro}>{conta.nome}</Text>
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
          <Button title={carregando ? "A SALVAR..." : "SALVAR LANÇAMENTO"} onPress={salvarLancamento} color="#007AFF" />
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
  botaoApagarCategoria: { marginLeft: 8, paddingHorizontal: 5 },
  
  botaoDetalhe: { backgroundColor: '#e3f2fd', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 10, borderWidth: 1, borderColor: '#90caf9' },
  textoBotaoDetalhe: { color: '#1976d2', fontWeight: 'bold' },
  boxDetalhes: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e9ecef', marginTop: 10 },
  linhaDetalhe: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  textoAviso: { fontSize: 12, color: '#666', marginTop: 4, marginLeft: 2 },

  chipPequeno: { backgroundColor: '#e9ecef', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: '#dee2e6' },
  chipPequenoAtivo: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  textoPequeno: { fontSize: 12, color: '#495057' },
  textoPequenoAtivo: { fontSize: 12, color: '#fff', fontWeight: 'bold' },

  row: { flexDirection: 'row', alignItems: 'center' },
  chipStatus: { padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statusPago: { backgroundColor: '#34a853' },
  statusPendente: { backgroundColor: '#fbbc05' },
  textoBranco: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  textoEscuro: { color: '#555', fontSize: 14 },
  rodape: { paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff' }
});