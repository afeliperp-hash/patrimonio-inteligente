import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Lancamento, TipoLancamento, TipoRecorrencia } from '@/types/lancamento';
import { addDoc, collection } from 'firebase/firestore';
// CORREÇÃO: Ajustado o caminho para apontar para a pasta constants conforme o seu print do VS Code
import { auth, db } from '../firebaseConfig';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const CATEGORIAS_RECEITA = ['Salário', 'Vendas', 'Investimentos', 'Outros'];
const CATEGORIAS_DESPESA = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Lazer', 'Impostos', 'Outros'];
const CONTAS_BANCARIAS = ['Carteira', 'Nubank', 'Itaú', 'Inter', 'Bradesco'];
const RECORRENCIAS = ['Nenhuma', 'Fixa (Mensal)', 'Parcelada'];

function NovoLancamentoScreen() {
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Outros');
  const [contaSelecionada, setContaSelecionada] = useState('Carteira');
  
  const hojeFormatoSimples = new Date().toLocaleDateString('pt-BR');
  const [dataVencimento, setDataVencimento] = useState(hojeFormatoSimples);
  const [dataPagamento, setDataPagamento] = useState(hojeFormatoSimples);
  const [estaPago, setEstaPago] = useState(true);
  
  const [recorrenciaSelecionada, setRecorrenciaSelecionada] = useState('Nenhuma');
  const [totalParcelas, setTotalParcelas] = useState('');

  const [linkComprovante, setLinkComprovante] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [carregando, setCarregando] = useState(false);

  const salvarLancamento = async () => {
    // 1. Verificação inicial
    if (descricao === '' || valor === '') {
      alert("Por favor, preencha a descrição e o valor.");
      return;
    }

    setCarregando(true);
    console.log("A preparar os dados...");

    // 2. Limpeza do Valor (Transformar "1.450,50" em número real para o Firebase)
    let valorLimpo = valor.replace(/\./g, '').replace(',', '.');
    const valorNumerico = parseFloat(valorLimpo);

    if (isNaN(valorNumerico)) {
      alert("O valor digitado não é um número válido.");
      setCarregando(false);
      return;
    }

    // 3. Preparar a Recorrência
    let tipoRec: TipoRecorrencia = 'nenhuma';
    if (recorrenciaSelecionada === 'Fixa (Mensal)') tipoRec = 'fixa';
    if (recorrenciaSelecionada === 'Parcelada') tipoRec = 'parcelada';

    // Se for parcelada, mas não digitaram o número, usamos 1 por defeito
    const numParcelas = tipoRec === 'parcelada' ? (parseInt(totalParcelas) || 1) : undefined;

    // 4. Construir o Objeto Exato
    const novoLancamento: Lancamento = {
      uid: auth?.currentUser?.uid || 'usuario-anonimo', // Adicionado fallback caso o auth não esteja pronto
      tipo: tipo,
      descricao: descricao,
      valor: valorNumerico,
      categoria: categoriaSelecionada, 
      contaBancaria: contaSelecionada,
      
      status: estaPago ? 'pago' : 'pendente', 
      dataVencimento: dataVencimento,
      dataPagamento: estaPago ? dataPagamento : null, 
      
      recorrencia: tipoRec,
      totalParcelas: numParcelas,
      parcelaAtual: tipoRec === 'parcelada' ? 1 : undefined,

      // Se não houver link ou observação, envia um texto vazio
      linkComprovante: linkComprovante || '',
      observacoes: observacoes || '',
      dataCriacao: new Date().toISOString()
    };

    console.log("A enviar para o Firebase:", novoLancamento);

    // 5. O Envio
    try {
      await addDoc(collection(db, 'lancamentos'), novoLancamento);
      console.log("Sucesso absoluto!");
      router.back(); 
    } catch (erro) {
      console.error("ERRO DO FIREBASE:", erro); 
      alert("Erro ao guardar o lançamento. Olha o Console para veres o motivo.");
      setCarregando(false);
    }
  };

  const mudarTipo = (novoTipo: TipoLancamento) => {
    setTipo(novoTipo);
    setCategoriaSelecionada('Outros');
  };

  const categoriasDisponiveis = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

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

          <ThemedText style={styles.label}>Descrição</ThemedText>
          <TextInput style={styles.input} placeholder="Ex: Conta de Luz (CPFL)" placeholderTextColor="#999" value={descricao} onChangeText={setDescricao} />

          <ThemedText style={styles.label}>Valor (R$)</ThemedText>
          <TextInput style={styles.input} placeholder="0,00" placeholderTextColor="#999" value={valor} onChangeText={setValor} keyboardType="numeric" />

          <ThemedText style={styles.label}>Categoria</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollHorizontal}>
            {categoriasDisponiveis.map((cat) => (
              <TouchableOpacity key={cat} style={[styles.chip, categoriaSelecionada === cat ? styles.chipAtivo : null]} onPress={() => setCategoriaSelecionada(cat)}>
                <Text style={categoriaSelecionada === cat ? styles.textoBranco : styles.textoEscuro}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
              <TextInput style={styles.input} placeholder="DD/MM/AAAA" placeholderTextColor="#999" value={dataVencimento} onChangeText={setDataVencimento} />
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
              <TextInput style={styles.input} placeholder="DD/MM/AAAA" placeholderTextColor="#999" value={dataPagamento} onChangeText={setDataPagamento} />
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

export default NovoLancamentoScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  botaoVoltar: { paddingVertical: 10, width: 60 },
  textoVoltar: { color: '#007AFF', fontSize: 16 },
  
  formulario: { flex: 1 },
  label: { fontSize: 14, color: '#555', marginBottom: 8, marginTop: 15, fontWeight: 'bold' },
  input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, fontSize: 16, color: '#333' },
  
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