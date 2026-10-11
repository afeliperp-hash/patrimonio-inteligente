// src/types/lancamento.ts

export type TipoLancamento = 'receita' | 'despesa';
export type StatusPagamento = 'pendente' | 'pago';
export type TipoRecorrencia = 'nenhuma' | 'fixa' | 'parcelada';

export interface Lancamento {
  id?: string; // O ID gerado pelo Firebase
  uid: string; // O ID do usuário dono do lançamento
  
  // Informações Básicas
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  
  // Categorização
  categoria: string;
  subcategoria?: string; // Opcional
  
  // Controle de Datas e Pagamento
  dataVencimento: Date | string; // Quando a conta vence
  dataPagamento?: Date | string | null; // Quando foi efetivamente paga (nulo se pendente)
  status: StatusPagamento;
  
  // Contas Bancárias (De onde saiu ou para onde foi o dinheiro)
  contaBancaria: string; 
  
  // Anexos Inteligentes (O seu link do Google Drive)
  linkComprovante?: string; 
  
  // Recorrência
  recorrencia: TipoRecorrencia;
  parcelaAtual?: number; // Ex: 1 (de 12)
  totalParcelas?: number; // Ex: 12
  
  // Extras
  observacoes?: string;
  dataCriacao: Date | string; 
}