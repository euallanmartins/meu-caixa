# Meu Caixa Premium - Documentacao Completa

Atualizado em: 9 de maio de 2026

## Visao geral

O **Meu Caixa Premium** e uma plataforma web para barbearias, com dois grandes ambientes:

- **Portal publico**: cliente encontra barbearias, ve perfil publico, agenda horarios, acompanha agendamentos e envia avaliacoes.
- **Painel profissional**: proprietarios e funcionarios gerenciam agenda, clientes, caixa/PDV, financeiro, equipe, relatorios, avaliacoes e configuracoes.

O sistema e multiestabelecimento: os dados sao vinculados a `barbearia_id` e protegidos por politicas RLS no Supabase.

## Stack atual

- **Framework**: Next.js `16.2.3`, App Router, React `19.2.4`
- **Linguagem**: TypeScript `5`
- **Estilo**: Tailwind CSS `4` com CSS global customizado
- **Banco/Auth/Storage**: Supabase, `@supabase/supabase-js` e `@supabase/ssr`
- **Graficos**: Chart.js, React Chart.js 2, Recharts e Lightweight Charts
- **PDF/Exportacao**: jsPDF e jsPDF AutoTable
- **Icones**: Lucide React
- **Deploy previsto**: Vercel

Observacao importante do projeto: este repositorio usa Next.js 16. Conforme a documentacao local em `node_modules/next/dist/docs`, o arquivo de interceptacao de requisicoes agora e `proxy.ts`, substituindo a antiga convencao `middleware.ts`.

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de producao
npm run start    # servidor Next em producao apos build
npm run lint     # ESLint
```

## Variaveis de ambiente

O projeto depende de Supabase no frontend e no servidor:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

As chaves ficam em `.env.local`, que esta ignorado pelo Git.

## Estrutura principal

```text
src/
  app/
    layout.tsx
    page.tsx
    login/page.tsx
    register/page.tsx
    (portal)/
      agendar/page.tsx
      avaliar/page.tsx
      barbearia/[id]/page.tsx
      cliente/page.tsx
    (painel)/
      layout.tsx
      gestao/
        agenda/page.tsx
        caixa/page.tsx
        clientes/page.tsx
        configuracoes/page.tsx
        equipe/page.tsx
        financeiro/page.tsx
        avaliacoes/page.tsx
        suporte/page.tsx
        relatorios/
  components/
  hooks/
  lib/
    supabase.ts
    supabase/client.ts
    supabase/server.ts
    supabase/middleware.ts
supabase/migrations/
schema.sql
proxy.ts
next.config.ts
```

## Roteamento

O App Router usa pastas para URLs e route groups para organizar layouts sem afetar o caminho publico:

- `(portal)` agrupa paginas publicas e de cliente.
- `(painel)` agrupa o painel profissional.
- `/gestao` redireciona para `/gestao/agenda`.
- `/gestao/relatorios` redireciona para `/gestao/relatorios/painel`.

Rotas principais:

| Rota | Funcao |
| --- | --- |
| `/` | landing/listagem de barbearias publicas |
| `/barbearia/[id]` | perfil publico da barbearia |
| `/agendar?id=BARBEARIA_ID` | fluxo publico de agendamento |
| `/avaliar?id=BARBEARIA_ID` | envio publico de avaliacao |
| `/cliente?id=BARBEARIA_ID` | portal do cliente |
| `/login` | acesso profissional e redirecionamento por perfil |
| `/register` | cadastro inicial de proprietario/barbearia |
| `/gestao/agenda` | agenda profissional |
| `/gestao/caixa` | PDV/checkout |
| `/gestao/clientes` | CRM de clientes |
| `/gestao/financeiro` | fluxo financeiro e caixa diario |
| `/gestao/equipe` | profissionais/barbeiros |
| `/gestao/configuracoes` | configuracoes da barbearia |
| `/gestao/avaliacoes` | moderacao de avaliacoes |
| `/gestao/relatorios/*` | relatorios operacionais e financeiros |

## Autenticacao e autorizacao

O Supabase Auth e usado para profissionais e clientes.

Fluxo profissional:

- `/login` autentica por e-mail/senha.
- Se o usuario tem registro em `profiles`, ele e profissional.
- `role = admin` redireciona para `/gestao/caixa`.
- Outros perfis profissionais redirecionam para `/gestao/agenda`.
- Usuarios sem perfil profissional, mas vinculados a `cliente_accounts`, sao enviados para `/cliente`.

Controle de acesso:

- `proxy.ts` chama `updateSession` em `src/lib/supabase/middleware.ts`.
- Rotas `/gestao/*` exigem usuario autenticado.
- Clientes autenticados nao podem acessar `/gestao`.
- Rotas administrativas, como caixa, financeiro, equipe e relatorios, exigem `role = admin`.
- Barbeiros acessam o conjunto reduzido de navegacao: agenda e clientes.

## Clientes e portal publico

### Landing `/`

A pagina inicial lista barbearias ativas, com busca por nome, cidade, servico e status. Ela consulta:

- `barbearias`
- `horarios_funcionamento`
- `servicos`

Quando o banco nao retorna dados, usa fallback local em `src/lib/publicBarbearia.ts`.

### Perfil `/barbearia/[id]`

Mostra:

- capa, logo, descricao e contato
- status de funcionamento do dia
- servicos ativos
- equipe ativa
- portfolio da barbearia ou fotos de servicos
- avaliacoes aprovadas
- horarios de funcionamento
- CTA para agendar e avaliar

### Agendamento `/agendar?id=...`

Fluxo em seis etapas, controlado por `useAgendamento`:

1. Identificacao do cliente
2. Selecao de servicos
3. Selecao de profissional ou qualquer disponivel
4. Data e horario
5. Confirmacao
6. Sucesso

Recursos importantes:

- pre-selecao de servico por `?servico=ID` ou `?service=ID`
- cadastro direto de cliente por e-mail/senha
- criacao/vinculo de conta de cliente
- persistencia local segura de dados nao sensiveis no `localStorage`
- disponibilidade via RPC `rpc_get_disponibilidade`
- confirmacao atomica via `rpc_confirmar_agendamento_multi`
- suporte a varios servicos no mesmo agendamento
- validacao de que servico e barbeiro pertencem a barbearia atual

### Portal do cliente `/cliente?id=...`

Permite:

- login por e-mail/senha
- vinculo automatico com cliente salvo localmente
- consulta de proximos agendamentos
- historico de agendamentos
- logout

Usa a RPC `rpc_cliente_meus_agendamentos_auth`.

### Avaliacoes `/avaliar?id=...`

Permite enviar:

- nome do cliente
- nota de 1 a 5
- depoimento
- ate 4 fotos de ate 5 MB cada

As fotos vao para o bucket `barber-photos`. O envio final usa `rpc_criar_avaliacao`. Avaliacoes ficam pendentes ate aprovacao pela barbearia.

## Painel profissional

O layout profissional usa `src/components/layout/Layout.tsx`, com sidebar desktop e bottom navigation mobile.

### Agenda

Arquivo principal: `src/components/ScheduleView.tsx`.

Funcionalidades:

- visualizacao diaria por profissional
- navegacao entre datas
- criacao manual de agendamentos
- criacao de bloqueios de horario ou dia
- drag and drop para mudar horario/profissional
- aceite ou recusa profissional de agendamento pendente
- edicao de observacoes internas
- atalho para checkout de um agendamento
- carregamento de agenda, bloqueios e horarios de funcionamento

Status usados:

- `pendente`
- `aceito` / `confirmado`
- `recusado`
- `cancelado`
- `concluido` / `realizado` / `atendido`

### AIDA

Componente: `src/components/AIAssistant.tsx`.

A AIDA processa lancamentos rapidos em linguagem natural, por exemplo:

```text
Diego fez barba 25 pix
```

Ela chama a RPC `rpc_aida_lancamento_rapido`, passando o `barbearia_id` e o texto. Quando a RPC retorna sucesso, a tela atualiza dados financeiros e agenda.

### Caixa / PDV

Componente: `src/components/CheckoutPOS.tsx`.

Funcionalidades:

- catalogo unificado de servicos e produtos
- busca por item
- filtro por todos, servicos ou produtos
- carrinho com quantidade
- selecao opcional de cliente
- desconto manual
- pagamento por dinheiro, cartao ou pix
- exige sessao de caixa aberta
- cria transacoes e pagamentos
- baixa estoque em vendas de produtos
- calcula comissao de produto
- conclui agendamento quando a venda veio de `?agendamentoId=...`
- calcula dinheiro em gaveta considerando saldo inicial e entradas em dinheiro do dia

Tabelas relacionadas:

- `caixa_sessoes`
- `transacoes`
- `transacao_pagamentos`
- `venda_produtos`
- `produtos`
- `servicos`
- `clientes`
- `barbeiros`

### Financeiro

Pagina: `/gestao/financeiro`.

Usa `DailyCashView` e `useDashboardData` para consolidar:

- transacoes do dia
- despesas
- caixinhas/gorjetas
- vendas avulsas de produtos
- sessao de caixa aberta
- estatisticas de equipe

### Clientes

Modulo de CRM com componentes como:

- `ClientsView`
- `ClientDetailSidebar`
- `crm/ClientForm`
- `crm/ClientProfileHeader`
- `crm/ClientActivityTabs`

Objetivo:

- manter cadastro de clientes por barbearia
- visualizar historico e dados de contato
- apoiar busca no PDV e na agenda

### Equipe

Modulo para gerenciar barbeiros/profissionais:

- nome, telefone, foto e status ativo
- tipo e valor de comissao
- dados publicos como titulo, especialidade, tags, avaliacao e destaque

### Configuracoes

Inclui gestao de:

- perfil da barbearia
- portfolio publico
- horarios de funcionamento
- servicos
- produtos

Componentes relevantes:

- `BarbeariaProfileSettings`
- `BarbeariaPortfolioManager`
- `OpeningHoursView`
- `ServicesView`
- `ProductsView`

### Relatorios

Rotas em `/gestao/relatorios/*`:

- painel geral
- agendamentos
- lista de agendamentos
- cancelados
- clientes
- equipe
- estoque
- fluxo de caixa
- receita
- resumo de servicos
- resumo de visitas
- detalhe por `[id]`

Hooks e utilitarios:

- `useRelatorios`
- `useDateFilter`
- `useExportCSV`
- `useExportPDF`
- `reportUtils`

Exportacao:

- CSV
- PDF
- tabelas e graficos com componentes dedicados em `src/components/relatorios`

## Banco de dados

O `schema.sql` base define:

- `barbearias`
- `profiles`
- `barbeiros`
- `servicos`
- `clientes`
- `agendamentos`
- `transacoes`
- `transacao_pagamentos`
- `despesas`
- `produtos`
- `venda_produtos`
- `caixinhas`

As migracoes adicionam e refinam:

- roles profissionais (`admin`, `barbeiro`)
- politicas anonimas seguras para agendamento publico
- agendamento atomico multi-servico
- disponibilidade considerando bloqueios
- timezone Sao Paulo em reservas
- contas de cliente por e-mail/senha multi-tenant
- portal do cliente
- bucket `barber-photos`
- campos publicos de barbeiros e barbearias
- portfolio publico
- avaliacoes com moderacao
- categorias/ordem/destaque de servicos
- aprovacao/recusa profissional de agendamento
- privacidade de agendamentos de clientes
- AIDA para lancamento rapido

## RPCs importantes

As principais chamadas de negocio usadas pelo frontend sao:

- `rpc_get_disponibilidade`
- `rpc_confirmar_agendamento_multi`
- `rpc_lookup_cliente`
- `rpc_upsert_cliente`
- `rpc_vincular_cliente_auth`
- `rpc_cliente_meus_agendamentos_auth`
- `rpc_profissional_responder_agendamento`
- `rpc_criar_avaliacao`
- `rpc_aida_lancamento_rapido`

Essas RPCs concentram regras sensiveis de consistencia, disponibilidade, seguranca e escrita publica.

## Seguranca

Principais medidas:

- RLS habilitado nas tabelas principais.
- Dados profissionais filtrados por `barbearia_id`.
- Acesso ao painel protegido por `proxy.ts`.
- Separacao de perfis profissionais e clientes.
- Uso de `supabasePublic` sem persistencia de sessao para leituras publicas.
- Escritas publicas feitas por RPCs controladas.
- Storage de fotos centralizado no bucket `barber-photos`.
- Dados sensiveis de cliente, como senha, nao sao gravados no `localStorage`.

Pontos de atencao:

- Confirmar se todas as migracoes foram aplicadas no Supabase antes de usar AIDA, avaliacoes, portal do cliente e aprovacao profissional.
- Manter provedores OAuth desativados no Supabase Auth; o cliente usa cadastro direto no app.
- Evitar expor service role no frontend. O app usa apenas URL e anon key publica.

## Configuracao Next.js

`next.config.ts` permite imagens remotas de `*.supabase.co` e restringe qualidades de imagem a:

- `60`
- `65`
- `75`

O alias `@/*` aponta para `./src/*`.

## Convencoes de desenvolvimento

- Usar App Router do Next 16.
- Manter `proxy.ts` na raiz para logica global de requisicao.
- Usar componentes client-side quando houver estado, Supabase browser client, drag/drop ou hooks de navegacao.
- Centralizar acesso Supabase em `src/lib/supabase*`.
- Preservar isolamento por `barbearia_id`.
- Preferir RPC para operacoes publicas ou atomicas.
- Antes de mudar APIs do Next, consultar `node_modules/next/dist/docs/`, conforme `AGENTS.md`.

## Como rodar localmente

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

3. Aplicar migracoes no Supabase.

4. Rodar:

```bash
npm run dev
```

5. Acessar:

```text
http://localhost:3000
```

## Checklist de producao

- Aplicar todas as migracoes em ordem.
- Conferir RLS e politicas anonimas.
- Desativar OAuth Google no Supabase e manter somente e-mail/senha para clientes.
- Configurar bucket `barber-photos` e politicas de storage.
- Configurar variaveis no ambiente da Vercel.
- Rodar `npm run lint`.
- Rodar `npm run build`.
- Testar fluxos principais:
  - cadastro profissional
  - login profissional
  - agendamento publico
  - aceite/recusa na agenda
  - checkout com sessao aberta
  - portal do cliente
  - envio e aprovacao de avaliacao
  - exportacao de relatorios

## Estado atual da documentacao

Esta versao substitui a documentacao anterior, que ainda citava Next.js 15 e nao refletia os modulos adicionados nas migracoes recentes, como portal do cliente, avaliacoes publicas, perfil publico de barbearia, aprovacao profissional de agendamento e AIDA.
