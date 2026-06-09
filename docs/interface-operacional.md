# Interface Operacional

Atualizado em: 2026-06-08.

Este documento descreve a interface operacional interna da integracao TOTVS
Moda x J&T, implementada em `Next.js` e conectada diretamente ao Postgres da
integracao.

## Objetivo

Dar uma mesa unica para a operacao:

- acompanhar lotes
- enxergar o fluxo em blocos conectados
- localizar pedido especifico
- ver motivo de erro ou inelegibilidade
- aplicar override auditado
- enfileirar reprocessamento em dry-run
- exportar o ultimo lote para conferencia
- executar cada etapa operacional separadamente pela interface

## Atualizacao visual

Em 2026-06-03 a interface recebeu uma revisao visual inspirada no modelo de
builder/canvas do Make/Integromat, sem copiar marca ou identidade proprietaria.
O foco foi deixar o fluxo mais tangivel para a operacao:

- sidebar escura e compacta para separar navegacao de area de trabalho
- hero administrativo com fundo pontilhado de canvas
- cards de metricas com barras de status por cor
- fluxo principal redesenhado como modulos conectados, com icone circular,
  contador, indicador de status e descricao curta
- area de fluxo com grade pontilhada para leitura de cenario
- formularios, filtros, botoes, tabelas e paineis alinhados ao novo tema
- comportamento responsivo validado para desktop e mobile

## Como executar

Instalar dependencias:

```bash
npm install
```

Garantir `.env` com `DATABASE_URL` ou `POSTGRES_URL`.

Rodar em desenvolvimento:

```bash
npm run ui:dev
```

Build de producao:

```bash
npm run ui:build
```

Validar deploy publicado sem depender do banco:

```text
/api/health
```

Subir build local:

```bash
npm run ui:start
```

URL padrao:

```text
http://localhost:3000
```

## Telas entregues no MVP

### Dashboard

- metricas dos ultimos 7 dias
- ultimo `sync_run`
- cronometro para a proxima execucao automatica das 17:00 em Sao Paulo
- fluxo principal em 8 modulos conectados: TOTVS, paginacao, elegibilidade, payload, envio unico, banco, pendencias e reprocessamento
- destaque de paginacao para deixar claro que `pageSize=100` e tamanho de pagina, nao limite total do lote
- painel de operacao assistida com senha operacional, envio real via GitHub
  Actions e limpeza dos dados operacionais do banco remoto
- formulario rapido para digitar filial/pedido e enfileirar reprocessamento em dry-run
- atalhos para pedidos, pendencias e exportacao do ultimo lote
- lotes recentes
- pendencias recentes
- reprocessamentos recentes

### Pedidos

- busca por cliente, pedido, `txlogisticId` e `billCode`
- filtros por filial, pedido, status TOTVS e severidade
- acesso ao detalhe operacional do pedido

### Detalhe do pedido

- snapshot atual de `orders`
- pendencias em `operational_issues`
- eventos em `order_processing_events`
- erros em `integration_errors`
- pickups salvos
- overrides
- reprocessamentos e tentativas

Acoes:

- enfileirar reprocessamento em dry-run
- salvar override auditado
- resolver pendencia aberta

Regra atual:

- o botao de reprocessamento fica bloqueado quando o pedido nao possui
  pendencia operacional aberta

### Pendencias

- lista central de `operational_issues`
- link direto para o pedido
- resolucao manual pela interface

### Reprocessamento

- formulario para digitar filial/pedido e enfileirar reprocessamento em dry-run
- lista de `reprocess_requests`
- status, tentativas e ultimo erro

### Passo a passo

- tela `/steps` para executar etapas operacionais separadamente
- botoes por etapa, sempre ligados a uma whitelist fixa de comandos
- saida de terminal exibida no proprio card da etapa
- mascaramento basico de segredos e credenciais no retorno da API
- limite de tamanho da saida exibida para evitar travar o painel
- passos sensiveis forcam `JT_SEND_ENABLED=false`

Passos disponiveis:

- aplicar migrations: `npm run db:migrate`
- conferir banco: `npm run db:inspect -- --days=1 --limit=20`
- buscar pedidos TOTVS JET/Attended e salvar `docs/attended-jet-orders.json`
- gerar payload J&T em dry-run do primeiro pedido salvo
- rodar lote diario em dry-run
- exportar ultimo lote
- rodar fila de reprocessamento em dry-run

## APIs entregues

- `GET /api/dashboard`
- `GET /api/manual-steps`
- `POST /api/manual-steps`
- `GET /api/sync-runs`
- `GET /api/orders`
- `GET /api/orders/:branchCode/:orderCode`
- `GET /api/issues`
- `GET /api/reprocess-requests`
- `POST /api/reprocess-requests`
- `POST /api/admin/dispatch-real-sync`
- `POST /api/admin/cleanup-database`
- `POST /api/orders/:branchCode/:orderCode/reprocess`
- `POST /api/orders/:branchCode/:orderCode/override`
- `POST /api/issues/:id/resolve`
- `GET /api/exports/orders-latest`

## Estado operacional atual

- envio real em massa foi executado em 2026-06-08 de forma assistida, fora da interface
- o painel passa a mostrar o lote real com 161 coletas criadas na J&T
- passos da tela `/steps` nao aceitam comando arbitrario; apenas a whitelist
  implementada no codigo
- passos de sync, payload J&T e reprocessamento pela tela `/steps` forcam
  dry-run com `JT_SEND_ENABLED=false`
- reprocessamento pela interface entra como dry-run
- reprocessamento pela interface so e aceito quando existe pendencia operacional aberta para o pedido
- exportacao do ultimo lote continua sem CPF, telefone ou endereco
- botoes destrutivos ou reais exigem `OPERATIONS_ACTION_TOKEN`
- envio real pelo painel dispara o workflow `sync-diario-jt.yml` com
  `send_enabled=true`, nao roda o lote dentro da funcao web
- o badge do topo do dashboard indica se o envio real assistido pelo painel esta
  liberado; ele depende de `OPERATIONS_ACTION_TOKEN` e
  `GITHUB_WORKFLOW_DISPATCH_TOKEN` no Vercel, nao de `JT_SEND_ENABLED`
- limpeza pelo painel apaga somente tabelas operacionais e preserva schema e
  migrations

## Validacao mais recente

Em 2026-06-03 foram validados:

- `npm run ui:build`
- `npm run check`
- `GET /api/dashboard`
- `GET /api/manual-steps`
- `POST /api/manual-steps` com `db:inspect`
- `POST /api/reprocess-requests` bloqueando pedido sem pendencia aberta
- enfileiramento e execucao em dry-run de pedido com pendencia sintetica controlada
- limpeza dos registros sinteticos apos o teste
- carregamento do dashboard no navegador interno, com 8 blocos, 4 acoes rapidas e sem overflow horizontal no viewport testado
- revisao visual no navegador interno em `1280x720`, com 8 modulos do fluxo e
  sem overflow horizontal
- revisao responsiva no navegador interno em `390x844`, com navegacao, modulos
  e rotas principais sem overflow horizontal
- rotas `/orders`, `/issues` e `/reprocess` conferidas no navegador interno em
  desktop e mobile
- rota `/steps` conferida no navegador interno em `1280x720` e `390x844`,
  com 7 cards e sem overflow horizontal
- execucao do passo "Conferir banco" pela tela `/steps`, exibindo resultado no
  card e atualizando sem erro
- envio real assistido de 2026-06-08: `syncRunId=0e684902-6982-4594-a6db-65b96c77dfd9`, `ordersRead=161`, `pickupsCreated=161`, `errors=0`
- exportacao atualizada em `docs/operational-exports/orders-latest.csv` com 161 linhas do lote real, sem CPF, telefone ou endereco
- em 2026-06-09, o painel no Vercel foi validado com `/api/health` usando banco
  remoto e SSL; depois disso foram adicionados cronometro, limpeza operacional e
  disparo de envio real protegido por senha

## Proximos passos

1. validar o primeiro clique de envio real pelo painel acompanhando o workflow
   no GitHub Actions
2. conferir com a operacao se o limite padrao de 10 envios reais continua
   adequado para piloto
3. adicionar autenticacao interna antes de ampliar uso para mais pessoas
4. comparar o novo visual com a rotina real da operacao no dia a dia
5. ajustar nomenclaturas e ordem dos modulos depois do primeiro uso assistido
6. decidir se a tela `/steps` deve permitir parametros controlados, como janela
   de datas, indice do pedido e arquivo de saida
7. adicionar persistencia/auditoria dos cliques executados em `/steps`
8. adicionar comentarios/notas por pendencia
9. adicionar auditoria mais rica de acoes da interface
10. evoluir notificacoes e acompanhamento proativo
11. padronizar estados vazios, carregamento e erros no mesmo tema visual
