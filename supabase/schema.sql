-- Portal Financeiro · Solicitações de orçamento e pagamento
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > colar > Run.

create extension if not exists pgcrypto;

-- Quem é do Financeiro (vê todos os pedidos, muda etapa, responde como Financeiro)
create table if not exists financeiro_equipe (
  email text primary key,
  nome  text not null
);

create sequence if not exists protocolo_seq start 1001;

create table if not exists solicitacoes (
  id                uuid primary key default gen_random_uuid(),
  protocolo         integer unique not null default nextval('protocolo_seq'),
  tipo              text not null check (tipo in ('orcamento', 'pagamento')),
  status            text not null default 'Recebido',
  origem            text not null default 'portal' check (origem in ('portal', 'email')),

  solicitante_email text not null,
  solicitante_nome  text,
  setor             text,
  centro_custo      text,
  categoria         text,

  fornecedor        text,
  cnpj              text,
  numero_documento  text,
  pedido_compra     text,
  descricao         text,
  valor             numeric(14, 2),
  vencimento        date,
  forma_pagamento   text,
  dados_pagamento   text,

  gestor_email      text,
  aprovacao_token   uuid default gen_random_uuid(),
  aprovado_em       timestamptz,
  aprovado_por      text,

  fora_do_prazo     boolean not null default false,
  justificativa_prazo text,

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists solicitacoes_email_idx  on solicitacoes (lower(solicitante_email));
create index if not exists solicitacoes_status_idx on solicitacoes (status);

create table if not exists mensagens (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  autor_email    text,
  autor_nome     text,
  autor_tipo     text not null check (autor_tipo in ('solicitante', 'financeiro', 'gestor', 'sistema')),
  texto          text not null default '',
  origem         text not null default 'portal' check (origem in ('portal', 'email')),
  interna        boolean not null default false,   -- nota interna: só o Financeiro vê
  criado_em      timestamptz not null default now()
);
create index if not exists mensagens_sol_idx on mensagens (solicitacao_id, criado_em);

create table if not exists anexos (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  mensagem_id    uuid references mensagens(id) on delete set null,
  nome           text not null,
  caminho        text not null,      -- caminho no bucket "anexos"
  tamanho        bigint,
  tipo_mime      text,
  enviado_por    text,
  criado_em      timestamptz not null default now()
);
create index if not exists anexos_sol_idx on anexos (solicitacao_id);

create table if not exists eventos (
  id             uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  descricao      text not null,
  autor_email    text,
  criado_em      timestamptz not null default now()
);

-- Controle da integração com o Microsoft 365
create table if not exists graph_assinatura (
  pasta     text primary key,          -- 'inbox' ou 'sentitems'
  id        text not null,
  expira_em timestamptz not null
);
create table if not exists emails_processados (
  message_id text primary key,
  criado_em  timestamptz not null default now()
);

-- Segurança: o portal acessa o banco só pelo servidor (chave service_role).
-- Com RLS ligado e nenhuma política, ninguém lê nada direto pelo navegador.
alter table financeiro_equipe  enable row level security;
alter table solicitacoes       enable row level security;
alter table mensagens          enable row level security;
alter table anexos             enable row level security;
alter table eventos            enable row level security;
alter table graph_assinatura   enable row level security;
alter table emails_processados enable row level security;

-- Bucket privado para anexos (até 25 MB por arquivo; ajuste se quiser)
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 26214400)
on conflict (id) do nothing;

-- >>> Troque pelos e-mails reais da equipe do Financeiro <<<
insert into financeiro_equipe (email, nome) values
  ('maria.eduarda@suaempresa.com.br', 'Maria Eduarda'),
  ('guilherme.borges@suaempresa.com.br', 'Guilherme Borges')
on conflict (email) do nothing;
