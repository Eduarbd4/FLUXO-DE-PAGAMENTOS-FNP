export type Tipo = "orcamento" | "pagamento";

export const ETAPAS: Record<Tipo, string[]> = {
  pagamento: ["Recebido", "Aguardando aprovação", "Aprovado", "Lançado no ERP", "Agendado", "Pago", "Devolvido"],
  orcamento: ["Recebido", "Em análise", "Aguardando aprovação", "Aprovado", "Recusado"],
};

export const TIPO_ROTULO: Record<Tipo, string> = {
  orcamento: "Orçamento",
  pagamento: "Pagamento",
};

export const FORMAS_PAGAMENTO = ["Boleto", "PIX", "TED", "Guia", "Débito automático"];

export const STATUS_FINAIS = ["Pago", "Devolvido", "Recusado"];

export type Solicitacao = {
  id: string;
  protocolo: number;
  tipo: Tipo;
  status: string;
  origem: "portal" | "email";
  solicitante_email: string;
  solicitante_nome: string | null;
  setor: string | null;
  centro_custo: string | null;
  categoria: string | null;
  fornecedor: string | null;
  cnpj: string | null;
  numero_documento: string | null;
  pedido_compra: string | null;
  descricao: string | null;
  valor: number | null;
  vencimento: string | null;
  forma_pagamento: string | null;
  dados_pagamento: string | null;
  gestor_email: string | null;
  aprovacao_token: string | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  fora_do_prazo: boolean;
  justificativa_prazo: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type Mensagem = {
  id: string;
  solicitacao_id: string;
  autor_email: string | null;
  autor_nome: string | null;
  autor_tipo: "solicitante" | "financeiro" | "gestor" | "sistema";
  texto: string;
  origem: "portal" | "email";
  interna: boolean;
  criado_em: string;
};

export type Anexo = {
  id: string;
  solicitacao_id: string;
  mensagem_id: string | null;
  nome: string;
  caminho: string;
  tamanho: number | null;
  tipo_mime: string | null;
  enviado_por: string | null;
  criado_em: string;
};

/** Anexo já enviado ao Storage pelo navegador, ainda na pasta temporária do usuário. */
export type AnexoEnviado = { caminho: string; nome: string; tamanho: number; tipo_mime: string };
