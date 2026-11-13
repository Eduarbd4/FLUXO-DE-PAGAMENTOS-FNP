# Portal Financeiro · Solicitações de orçamento e pagamento

Canal único entre os setores e o Financeiro:

- **O setor pede pelo portal ou por e-mail.** No portal ele preenche o formulário, anexa NF (PDF/XML), boleto, orçamentos e fotos, até 25 MB cada. Também pode só mandar um e-mail para a caixa do Financeiro (ex.: `financeiro@suaempresa.com.br`): o e-mail vira uma solicitação com protocolo, e os anexos entram junto.
- **O Financeiro responde pelo portal ou pelo Outlook.** As duas formas ficam registradas na mesma conversa do pedido:
  - pelo portal: o solicitante recebe a resposta por e-mail automático;
  - pelo Outlook da caixa compartilhada, respondendo normalmente: o portal captura a resposta e os anexos;
  - pelo próprio Outlook de cada pessoa da equipe, respondendo ao aviso que chega: o portal registra a resposta e repassa ao solicitante.
- **O gestor aprova sem login.** Ele recebe um e-mail com o botão *Aprovar ou recusar*, ou responde `APROVADO` / `RECUSADO`.
- **Etapas iguais às da planilha:** Recebido → Aguardando aprovação → Aprovado → Lançado no ERP → Agendado → Pago (ou Devolvido). Orçamentos usam Recebido → Em análise → Aguardando aprovação → Aprovado/Recusado. Cada mudança de etapa gera um e-mail ao solicitante.
- **Regra dos 3 dias úteis:** a regra do novo fluxo é verificada na hora. Se o pedido estiver fora do prazo, o portal pede uma justificativa.
- **Exportar para a planilha:** baixa um CSV no formato da aba **Vencimentos** de `Controles_Contas_a_Pagar.xlsx`.

Tecnologia: Next.js 15 + Supabase (banco, login e arquivos) + Microsoft Graph (e-mail do Microsoft 365), publicado no Vercel. É a mesma base do simulador de salário.

---

## Como colocar no ar (cerca de 1 hora, uma vez só)

Você vai precisar de: conta no GitHub, no Vercel e no Supabase, além de alguém com acesso de **administrador do Microsoft 365** da empresa (normalmente o TI) para os passos 2 e 3.

### 1. Supabase (banco, login e arquivos)
1. Crie um projeto em <https://supabase.com> (região São Paulo).
2. **SQL Editor → New query**: cole todo o arquivo `supabase/schema.sql` e clique em **Run**.
   - Antes de rodar, troque, no final do arquivo, os e-mails da equipe do Financeiro. Escreva os e-mails **em minúsculas**.
   - Para incluir alguém depois, rode: `insert into financeiro_equipe (email, nome) values ('nome@empresa.com.br', 'Nome');`
3. **Project Settings → API**: copie a `Project URL`, a chave `anon` e a chave `service_role` (esta última é secreta).
4. **Authentication → URL Configuration**:
   - em *Site URL*, coloque o endereço do portal (ex.: `https://portal-financeiro.vercel.app`);
   - em *Redirect URLs*, adicione `https://portal-financeiro.vercel.app/auth/callback`.

### 2. Microsoft 365: login com a conta da empresa (opcional, recomendado)
Se pular este passo, o login funciona por link enviado ao e-mail.
1. Abra o portal **Entra ID** (<https://entra.microsoft.com>) e vá em **Registros de aplicativo → Novo registro**. Nome: `Portal Financeiro`. Escolha *Contas somente neste diretório organizacional*.
2. Em *URI de redirecionamento (Web)*, coloque `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
3. Em **Certificados e segredos**, crie um *segredo do cliente* e anote o **valor** na hora.
4. No Supabase, vá em **Authentication → Providers → Azure** e ative. Preencha:
   - Client ID: o *ID do aplicativo*;
   - Secret: o valor anotado no item 3;
   - Azure Tenant URL: `https://login.microsoftonline.com/SEU_TENANT_ID`.

### 3. Microsoft 365: caixa de e-mail do Financeiro (envio e leitura automáticos)
1. Crie (ou use) uma **caixa compartilhada**, ex.: `financeiro@suaempresa.com.br`.
2. No mesmo registro de aplicativo, vá em **Permissões de API → Adicionar → Microsoft Graph → Permissões de aplicativo** e marque **Mail.Send** e **Mail.ReadWrite**.
3. Clique em **Conceder consentimento do administrador**.
4. **Segurança (importante):** limite o aplicativo a ler e enviar **só** pela caixa do Financeiro. No PowerShell do Exchange Online, o TI roda:
   ```powershell
   New-DistributionGroup -Name "Portal Financeiro - acesso" -Type Security -Members financeiro@suaempresa.com.br
   New-ApplicationAccessPolicy -AppId <ID_DO_APLICATIVO> -PolicyScopeGroupId "Portal Financeiro - acesso" -AccessRight RestrictAccess -Description "Portal Financeiro so na caixa do financeiro"
   ```
5. Anote o **ID do diretório (tenant)**, o **ID do aplicativo** e o **segredo**.

### 4. GitHub + Vercel
1. Crie um repositório no GitHub (ex.: `Eduarbd4/portal-financeiro`) e envie esta pasta.
2. No Vercel, clique em **Add New → Project**, escolha o repositório e, em **Environment Variables**, preencha todas as variáveis do arquivo `.env.example`:

| Variável | O que é |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Valores do passo 1 |
| `APP_URL` | Endereço do portal no Vercel, sem barra no final |
| `ALLOWED_EMAIL_DOMAINS` | Domínio do e-mail da empresa, ex.: `suaempresa.com.br`. Só esse domínio entra no portal e consegue abrir pedido por e-mail |
| `NOTIFICAR_EQUIPE` | `true`: cada pessoa do Financeiro recebe aviso no próprio e-mail. Use `false` se vocês trabalham só pela caixa compartilhada |
| `CRON_SECRET`, `GRAPH_CLIENT_STATE` | Dois textos longos e aleatórios, diferentes entre si |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MAILBOX_ADDRESS` | Valores do passo 3 |

3. Clique em **Deploy**.

### 5. Ligar a leitura automática dos e-mails
1. Entre no portal com um e-mail da equipe do Financeiro.
2. Clique em **Sincronizar e-mails**. Isso cria a assinatura no Microsoft 365: a partir daí, cada e-mail que chega ou sai da caixa do Financeiro entra no portal em segundos.
3. O Vercel roda `/api/cron/email` uma vez por dia (já configurado em `vercel.json`). Essa rotina renova a assinatura e confere se algum e-mail escapou. Se notar atraso, use o botão **Sincronizar e-mails**.

### 6. Teste antes de divulgar
- [ ] Abra uma solicitação de pagamento com anexo. Você deve receber a confirmação, e o gestor, o pedido de aprovação.
- [ ] Aprove pelo botão do e-mail do gestor.
- [ ] Responda o e-mail de confirmação com um anexo. A resposta e o anexo devem aparecer na conversa.
- [ ] Responda pelo portal como Financeiro. O solicitante deve receber o e-mail.
- [ ] Mande um e-mail novo (sem `[#número]` no assunto) para a caixa do Financeiro. Deve virar uma solicitação nova, com resposta automática.
- [ ] Clique em **Exportar para a planilha** e cole na aba Vencimentos. Cole as 12 primeiras colunas a partir da coluna A e as 5 últimas a partir da coluna N, porque a coluna M é fórmula.

---

## Como funciona o e-mail

- Todo e-mail do portal sai da caixa do Financeiro com o assunto `[#1234] Pagamento · Fornecedor · venc. 20/11`. **É o código `[#1234]` que liga a resposta ao pedido.** Se alguém apagar o código do assunto, a resposta vira um pedido novo.
- E-mails automáticos (férias, "não foi possível entregar") são ignorados.
- Remetentes de fora do domínio da empresa só entram em pedidos em que já são o solicitante ou o gestor.
- Imagens de assinatura (logos dentro do corpo do e-mail) não viram anexo.
- **Nota interna:** a equipe pode registrar no pedido algo que o solicitante não vê. Nota interna não gera e-mail.

## Rodar no computador (desenvolvimento)
```bash
cp .env.example .env.local   # preencha
npm install
npm run dev                  # http://localhost:3000
```
Sem as variáveis `MS_*`, o portal funciona normalmente, mas não envia e-mails: eles aparecem só no log do terminal. A leitura automática precisa de um endereço `https` público, então só funciona depois de publicado no Vercel.

## Onde mexer
- Feriados e prazo de 3 dias úteis: `lib/datas.ts`
- Etapas e formas de pagamento: `lib/tipos.ts`
- Textos dos e-mails: `lib/emails.ts`
- Regras de leitura dos e-mails (aprovação por resposta, pedidos novos): `lib/inbound.ts`
