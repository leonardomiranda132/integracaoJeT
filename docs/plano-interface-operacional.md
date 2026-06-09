# Plano da Interface Operacional

Atualizado em: 2026-06-03.

Este documento registra a decisao de substituir o n8n por uma interface
operacional propria para a integracao TOTVS Moda x J&T.

## Decisao de produto

Escolhas fechadas em 2026-06-03:

- tela principal com blocos conectados do fluxo
- stack `Next.js`
- remocao do n8n do projeto como caminho oficial

Motivacao:

- o n8n ajuda em orquestracao, mas nao atende bem a operacao pedido a pedido
- a equipe precisa enxergar motivos de erro com contexto de dominio
- a equipe precisa reprocessar pedidos especificos com auditoria
- a equipe precisa de uma visao unica de lotes, pendencias, overrides e fila

## Objetivo

Criar um painel interno para operar a integracao sem depender de CLI para o dia
a dia e sem depender do n8n para visualizar o fluxo.

O painel deve permitir:

- ver o fluxo operacional em blocos conectados
- acompanhar lotes e metricas do dia
- investigar um pedido especifico
- entender o motivo de inelegibilidade ou falha
- aplicar override auditado
- enfileirar e acompanhar reprocessamento
- exportar pedidos para conferencia

## Escopo funcional do MVP

### 1. Dashboard

Resumo do ultimo lote e do periodo selecionado:

- `sync_runs` mais recentes
- pedidos lidos
- pedidos elegiveis
- `pickups_dry_run`
- `pickups_created`
- erros
- pendencias abertas
- reprocessamentos pendentes

### 2. Fluxo visual principal

Tela principal com blocos conectados:

```text
TOTVS
  -> filtro por transportadora/status/janela
  -> elegibilidade
  -> payload J&T
  -> dry-run ou envio real
  -> persistencia
  -> pendencias/reprocessamento
```

Cada bloco deve exibir:

- contagem
- status
- erros associados
- atalho para a lista filtrada

### 3. Lista de pedidos

Filtros esperados:

- filial
- numero do pedido
- `txlogisticId`
- `billCode`
- status interno
- motivo da pendencia
- data/lote
- transportadora

### 4. Detalhe do pedido

Dados reunidos em uma unica tela:

- snapshot atual de `orders`
- coletas em `pickup_requests`
- erros em `integration_errors`
- eventos em `order_processing_events`
- pendencias em `operational_issues`
- overrides em `order_overrides`
- reprocessamentos em `reprocess_requests` e `reprocess_attempts`

Acoes do detalhe:

- reprocessar em dry-run
- enfileirar envio real quando liberado
- criar/editar override
- resolver pendencia
- exportar JSON sanitizado

### 5. Tela de pendencias

Baseada em `operational_issues`, com:

- abertas
- resolvidas
- ignoradas/manualizadas no futuro, se precisarmos

### 6. Tela de reprocessamento

Baseada em `reprocess_requests` e `reprocess_attempts`, com:

- fila pendente
- execucoes em andamento
- sucesso/falha por tentativa
- motivo do pedido entrar em reprocessamento

## Arquitetura recomendada

### Stack

- `Next.js`
- `TypeScript`
- rotas web + rotas de API no mesmo projeto
- consumo direto do Postgres da integracao

### Reaproveitamento do backend atual

A interface deve reaproveitar o que ja existe:

- jobs e use-cases do sync
- repositorios Postgres
- sanitizacao
- fila de reprocessamento
- regras de elegibilidade
- overrides e eventos operacionais

O objetivo nao e duplicar regra de negocio no frontend.

## Contratos iniciais da API

Rotas sugeridas para a primeira versao:

- `GET /api/dashboard`
- `GET /api/sync-runs`
- `GET /api/orders`
- `GET /api/orders/:branchCode/:orderCode`
- `GET /api/issues`
- `GET /api/reprocess-requests`
- `POST /api/orders/:branchCode/:orderCode/reprocess`
- `POST /api/orders/:branchCode/:orderCode/override`
- `POST /api/issues/:id/resolve`
- `GET /api/exports/orders-latest`

## Modelo de dados

Tabelas ja suficientes para o MVP:

- `sync_runs`
- `orders`
- `pickup_requests`
- `integration_errors`
- `execution_locks`
- `operational_issues`
- `order_processing_events`
- `order_overrides`
- `reprocess_requests`
- `reprocess_attempts`

Possiveis tabelas futuras, somente se a operacao pedir:

- `operators` para autoria interna
- `issue_comments` para notas operacionais
- `manual_actions_audit` para trilha mais detalhada de cliques/acoes

## Fases de implementacao

### Fase 0: transicao de estrategia

Status em 2026-06-03: concluida.

- n8n marcado como descontinuado na documentacao
- n8n retirado dos proximos passos oficiais
- `deploy/n8n/` removido do repositorio

### Fase 1: base tecnica da interface

Status em 2026-06-03: concluida.

- `Next.js` instalado no projeto
- app em `dashboard/`
- conexao direta com o Postgres da integracao
- layout base e navegacao entregues

### Fase 2: leitura operacional

Status em 2026-06-03: concluida.

- dashboard entregue
- fluxo com blocos conectados entregue
- lista de pedidos entregue
- detalhe do pedido entregue

### Fase 3: acoes operacionais

Status em 2026-06-03: concluida no MVP inicial.

- reprocessar pedido especifico em dry-run
- criar override
- resolver pendencia
- exportar ultimo lote

### Fase 4: endurecimento

- Status em 2026-06-03: pendente.

- autenticacao interna
- trilha de auditoria mais rica
- permissao por perfil
- notificacoes

## Fora do escopo imediato

- envio real automatico antes da confirmacao da transportadora
- callbacks/rastreio como primeira entrega da interface
- editor visual generico tipo BPMN

## Estado de entrega

Implementado no repositorio:

- app `Next.js` em `dashboard/`
- dashboard com metricas e fluxo
- lista de pedidos
- detalhe operacional por pedido
- acoes de override, resolucao de pendencia e reprocessamento dry-run
- APIs internas do painel
- exportacao do ultimo lote pela interface

Comandos principais:

```bash
npm run ui:dev
npm run ui:build
npm run ui:start
```

## Ordem sugerida para a proxima execucao

1. validar o painel com a operacao real
2. adicionar autenticacao interna
3. adicionar comentarios e auditoria de acoes
4. manter envio real bloqueado ate validacao externa

## Resultado esperado

Ao final do MVP, a operacao deve conseguir trabalhar quase toda dentro da
interface, usando o terminal apenas para suporte tecnico excepcional.
