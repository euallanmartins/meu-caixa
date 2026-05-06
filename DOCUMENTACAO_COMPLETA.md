# Meu Caixa Premium — Documentação Completa

O **Meu Caixa Premium** é um ecossistema de gestão para barbearias e salões, desenvolvido com tecnologias de ponta e um design system premium intitulado **Liquid Glass**.

---

## 🚀 Tecnologias (Stack)

- **Frontend**: Next.js 15 (App Router)
- **Estilização**: Tailwind CSS 4 + Liquid Glass UI
- **Backend**: Supabase (PostgreSQL + RLS)
- **Ícones**: Lucide React
- **Autenticação**: Supabase Auth (JWT)

---

## 🎨 Design System: Liquid Glass

O projeto utiliza uma estética modernista baseada em:
- **Fundo**: Base em `#0a0a0a` (Deep Black).
- **Efeitos**: `backdrop-blur-md`, bordas sutis `white/10` e reflexos internos (`bg-white/5`).
- **Cores de Destaque**:
  - `Accent`: Neon Green (Foco e Botões Principais).
  - `Blue/Purple`: Categorias de Serviços e Produtos.
  - `Danger`: Vermelho para alertas e fechamentos.
- **Micro-animações**: Transições suaves e efeitos de "glow" em elementos interativos.

---

## 🛠️ Funcionalidades Principais

### 1. Dashboard & Sidebar
- **Sidebar Global**: Navegação lateral fixa com desfoque de fundo e acesso rápido a todas as abas.
- **Tabs de Navegação**: Separação clara entre Agenda, Clientes, Caixa e Produtos.

### 2. CRM de Clientes (Moderno)
Transformado de uma lista básica para um sistema de gestão de relacionamento:
- **Segmentação Automática**:
    - **Fiéis**: Clientes com visitas recorrentes nos últimos 60 dias.
    - **Novos**: Cadastros realizados nos últimos 7 dias.
    - **Ausentes**: Clientes sem visitas há mais de 45 dias (foco em reativação).
- **Perfil 360°**: Sidebar de detalhes com métricas financeiras (LTV), histórico completo de agendamentos e sistema de etiquetas (Tags).

### 3. PDV / Checkout Profissional (POS) — Liquid Experience
Fluxo de finalização de venda em 4 etapas (ou modal rápido) inspirado no Booksy Biz:
- **Seleção & Flexibilidade**:
    - Escolha rápida de serviços e produtos no catálogo lateral.
    - **Adição Rápida de Produtos**: Modal de busca instantânea na tela de pagamento para inclusão de itens extras (pomadas, produtos) sem interromper o fluxo atual, com seletor de quantidades.
- **Atribuição & Comissões**:
    - Definição do barbeiro responsável por cada item da venda.
    - **Preservação de Vínculo**: Vendas originadas da Agenda preservam automaticamente o profissional marcado, garantindo o cálculo correto de comissões.
- **Pagamento Flexível (Split Payment)**:
    - **Pagamentos Combinados**: Suporte para dividir o total entre múltiplos métodos (ex: R$ 10 no Dinheiro e o restante no Cartão) com valores editáveis em tempo real.
    - **Gorjetas Inteligentes**: Opções de porcentagem (10%, 20%, 30%) ou entrada de **Valor Real/Manual** (ex: R$ 15,00 fixos).
    - **Baixa Automática**: Integração com a tabela de produtos para redução de estoque e registro de transações financeiras em tempo real.

### 4. Gestão de Estoque & Produtos
- **Catálogo Integrado**: Gestão centralizada de produtos com controle de preço de custo, preço de venda e comissão.
- **Sincronização com Checkout**: O saldo de estoque é atualizado instantaneamente no processamento da venda.

### 5. Agendamento Público (Self-Service)
**Rota**: `/agendar?id=UUID_BARBEARIA`  
**Acesso**: Público (`anon`)

Fluxo completo de agendamento projetado para mobile:
1. **Identificação**: Lookup dinâmico de cliente por e-mail (reconhece clientes antigos).
2. **Serviços**: Seleção múltipla com suporte a **Combo** (os tempos são somados).
3. **Profissional**: Escolha de barbeiro específico ou "Qualquer disponível".
4. **Data/Horário**: Calendário customizado com verificação real de disponibilidade.
5. **Confirmação**: Revisão de dados e campo para observações.
6. **Sucesso**: Integração com **Google Calendar** e persistência em `localStorage`.

### 6. Fluxo de Caixa & Gestão Financeira
- **Sessões de Caixa**: Rastreamento de turnos com horário de abertura e fechamento.
- **Lançamentos**: Registro automático de todas as transações vinculadas à sessão ativa.
- **Caixinhas**: Gestão de gorjetas por profissional.

---

## 📁 Estrutura de Pastas

```text
/src
  /app          # Roteamento e Páginas (Next.js App Router)
  /components   # Componentes modulares (UI & Views)
    /agendar    # Componentes do módulo público (StepIndicator, StepHorario, etc)
  /hooks        # Lógica de estados e dados (useDashboardData, useAgendamento)
  /lib          # Configurações globais (Supabase Client)
/public         # Ativos estáticos e imagens
/scripts        # Scripts utilitários e automações de banco
schema.sql      # Definição do banco de dados e RLS
```

---

## 🔒 Segurança (RLS)

Todas as tabelas possuem **Row Level Security (RLS)** habilitada, garantindo que:
1. Cada dono de barbearia acesse apenas seus próprios dados.
2. Profissionais vejam suas agendas e comissões.
3. Transações financeiras fiquem protegidas por UUIDs de sessão.
4. O módulo `/agendar` opera sob a role `anon` com políticas restritas de leitura e inserção para agendamentos.

---

## 📋 Próximos Passos
- Implementação de relatórios avançados de performance em PDF.
- Notificações automáticas via WhatsApp para clientes "Ausentes".
- Refinamento do dashboard mobile (Liquid Glass 2.0).

---
*Atualizado em: 23 de Abril de 2026*
