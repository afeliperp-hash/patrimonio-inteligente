import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as nodemailer from "nodemailer";

// Inicializa a ligação segura à tua base de dados
admin.initializeApp();

// Configuração do carteiro (Nodemailer) com o teu Gmail
// Terás de gerar uma "App Password" (Senha de Aplicação) na tua conta Google
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'afeliperp@gmail.com', // Substitui pelo teu e-mail
    pass: 'mtgpwvjqccyoxvbu'       // Não é a senha normal! É a Senha de App do Google
  }
});

// O Robô que acorda todos os dias às 08:00 no horário de Ribeirão Preto / Brasília
export const verificarVencimentosDiarios = onSchedule(
  {
    schedule: "0 8 * * *", 
    timeZone: "America/Sao_Paulo", 
  },
  async (event) => {
    const db = admin.firestore();
    const hoje = new Date();
    
    // Converte a data para o formato "DD/MM/AAAA" que estás a usar no teu banco de dados
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const dataHojeStr = `${dia}/${mes}/${ano}`;

    try {
      // 1. Procura as contas que vencem hoje e não foram pagas
      const snapshot = await db.collection('lancamentos')
        .where('status', '==', 'pendente')
        .where('dataVencimento', '==', dataHojeStr)
        .get();

      if (snapshot.empty) {
        console.log(`Nenhuma conta a vencer no dia ${dataHojeStr}.`);
        return;
      }

      // 2. Monta a lista de contas para o e-mail
      let linhasEmail = '';
      snapshot.forEach(doc => {
        const dados = doc.data();
        const valorFormatado = dados.valor.toFixed(2).replace('.', ',');
        linhasEmail += `<li style="margin-bottom: 10px;"><strong>${dados.descricao}</strong><br>Valor: R$ ${valorFormatado}</li>`;
      });

      // 3. Desenha o e-mail
      const conteudoHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <h2 style="color: #d93025; text-align: center;">🚨 Atenção aos Vencimentos de Hoje</h2>
          <p>Olá! Este é o teu aviso automático de vencimentos pendentes para a data de <strong>${dataHojeStr}</strong>:</p>
          <ul style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            ${linhasEmail}
          </ul>
          <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
            Não te esqueças de pagar para evitar multas e juros!<br>
            <i>Enviado automaticamente pelo teu sistema de Controlo Financeiro.</i>
          </p>
        </div>
      `;

      // 4. Envia o e-mail
      await transporter.sendMail({
        from: '"Controlo Financeiro" <afeliperp@gmail.com>',
        to: "afeliperp@gmail.com", // Podes colocar o e-mail que quiseres aqui! (Até vários separados por vírgula)
        subject: `🚨 Aviso de Vencimento - ${dataHojeStr}`,
        html: conteudoHtml,
      });

      console.log(`E-mail de alerta enviado com sucesso para ${snapshot.size} contas.`);
    } catch (error) {
      console.error('Erro ao verificar vencimentos ou ao enviar o e-mail:', error);
    }
  }
);