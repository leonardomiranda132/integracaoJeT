# Status da Implementacao

Atualizado em: 2026-06-09.

Este documento registra o estado real da integracao no repositorio, o que ja foi validado na pratica e o que ainda falta para a operacao ficar pronta para lote diario com seguranca.

## Resumo atual

O repositorio ja saiu do estagio de esqueleto e agora possui fluxo funcional de ponta a ponta entre TOTVS Moda e J&T.

Status operacional neste momento:

- Envio real para a J&T foi executado em 2026-06-08 apos confirmacao explicita do usuario.
- O lote real de 2026-06-08 criou 161 pedidos/coletas na J&T com `errors=0`.
- O caminho seguro de conferencia continua sendo dry-run, exportacao do lote e `npm run db:inspect` antes de novas execucoes reais.
- A interface operacional propria em `Next.js` ja foi implementada e substituiu o n8n como caminho oficial.
- A base local de operacao foi limpa em 2026-06-03 a pedido do usuario; as tabelas ficaram zeradas e `schema_migrations` foi preservada.
- O repositorio GitHub esta publicado em `integracoes-alphabeto/Integra-aoJ-T`.
- GitHub Actions Secrets e Variables foram cadastradas em 2026-06-09 via `npm run github:actions-config`.
- O workflow `Sync diario J&T` esta ativo no GitHub.
- O agendamento automatico esta seguro neste momento: `JT_SEND_ENABLED=false`, `DAILY_SEND_LIMIT=10` e `POSTGRES_SSL=true`.

Ja foi validado com sucesso:

- autenticacao no TOTVS
- busca real de pedidos no endpoint `/orders/search`
- filtro real por `shippingCompanyCode=88442`
- enriquecimento de telefone pela API `person`
- montagem do payload da J&T com dados reais
- dry-run completo do `bizContent`
- envio real de pedido JET para a J&T com retorno de sucesso
- teste controlado de modificacao/envio do pedido `505726` com itens do pacote no payload
- persistencia Postgres local migrada e validada
- paginacao TOTVS implementada em codigo
- trava de execucao implementada
- mascaramento de logs e contextos de erro implementado
- timeout, retry e classificacao de erro HTTP implementados
- modo dry-run operacional e limite de envio implementados
- filtro operacional de pedidos ajustado para `Attended`
- diagnostico de elegibilidade com motivos no log do pedido e resumo agregado no lote
- filtro defensivo local por `shippingCompanyCode=88442` aplicado apos a API retornar pedidos fora do codigo configurado
- camada de monitoramento operacional adicionada com pendencias, eventos e fila de reprocessamento
- exportacao operacional de pedidos do ultimo sync adicionada para conferencia sem envio real
- comandos para inspecionar pedido, criar override e reprocessar pedido especifico adicionados
- decisao de produto fechada para substituir n8n por uma interface operacional propria
- plano da interface operacional documentado
- interface operacional implementada em `dashboard/` com dashboard, fluxo visual, pedidos, pendencias e reprocessamento
- APIs internas da interface entregues
- `deploy/n8n/` removido do repositorio
- reprocessamento endurecido para aceitar apenas pedido com pendencia operacional aberta
- paginacao TOTVS validada em dry-run real com `pagesRead=2` e `ordersRead=102`; `pageSize=100` e tamanho de pagina, nao limite total do lote
- reserva anti-duplicidade em `pickup_requests.txlogistic_id` adicionada antes da chamada real J&T
- painel redesenhado com fluxo operacional conectado e formulario direto para reprocessar pedido por filial/pedido
- GitHub Actions Secrets e Variables cadastradas e conferidas sem expor valores; `POSTGRES_SSL` foi corrigido para `true` por causa do Neon e `JT_SEND_ENABLED` foi confirmado como `false`

Pedido validado com sucesso na J&T:

- `branchCode`: `313`
- `orderCode`: `505720`
- `txlogisticId`: `313-505720`
- `billCode`: `888030739076061`

Pedido JET validado com payload corrigido:

- `branchCode`: `313`
- `orderCode`: `505757`
- `txlogisticId`: `313-505757`
- `billCode`: `888030745001617`
- observacao: payload enviado com 5 itens declarados, `itemValue` por item somando `308.48` e `totalQuantity=1` para volume unico

Pedido usado em teste controlado de diagnostico:

- `branchCode`: `313`
- `orderCode`: `505726`
- `txlogisticId`: `313-505726`
- `billCode`: `888030745182919`
- observacao: no arquivo salvo de teste, este pedido veio com `shippingCompanyCode=2522` / JAD, portanto nao deve entrar no fluxo automatico filtrado por JET `88442`

## O que foi implementado

### Base do projeto

Status: concluido

- Projeto iniciado em `Node.js + TypeScript`.
- Scripts criados para desenvolvimento, build, checagem de tipos e execucao manual.
- Estrutura separada por camadas (`app`, `application`, `domain`, `infrastructure`, `config`).

### Integracao com TOTVS

Status: funcional com validacao real e paginacao implementada em codigo

Arquivos principais:

- [src/infrastructure/http/totvs-client.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/infrastructure/http/totvs-client.ts:1)
- [src/config/settings.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/config/settings.ts:1)

O que ja faz:

- Autenticacao no endpoint de token do TOTVS Moda.
- Busca de pedidos via `/orders/search`.
- Mapeamento do retorno real do TOTVS para o modelo interno do projeto.
- Filtro por empresa/filial.
- Filtro por status.
- Filtro por transportadora com `VIRTUAL_AGE_SHIPPING_COMPANY_CODE`.
- Filtro defensivo local pelo `shippingCompanyCode` retornado, alem do filtro enviado para a API.
- Leitura de `items`, `invoices` e `shippingAddress`.
- Busca paginada usando `VIRTUAL_AGE_ORDER_PAGE_SIZE` e `VIRTUAL_AGE_ORDER_MAX_PAGES`.

O que foi confirmado na pratica:

- a API aceita `shippingCompanyCode` diretamente no `filter`, mas em 2026-06-03 tambem retornou pedidos fora do codigo configurado; por isso o codigo passou a aplicar filtro defensivo local no retorno
- o retorno real traz dados suficientes para endereco, nota fiscal e transportadora
- o peso mais confiavel vem da invoice (`grossWeight` / `netWeight`)

O que ainda falta:

- estrategia de busca incremental mais refinada
- eventual uso de `pending-items` se a operacao exigir parcialidade

### Integracao com TOTVS Person

Status: funcional com validacao real

Arquivos principais:

- [src/infrastructure/http/person-client.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/infrastructure/http/person-client.ts:1)
- [src/application/use-cases/sync-orders.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/application/use-cases/sync-orders.ts:1)

O que ja faz:

- Consulta a API `person` por `customerCode`
- Busca `phones` com `expand=phones`
- Enriquecimento do pedido antes da montagem do payload da J&T

O que foi confirmado na pratica:

- o `customerCode` do pedido pode ser usado como `personCodeList`
- a API `person` devolveu telefone real do cliente
- quando so existe telefone `FIXO`, ele passa a abastecer `phone` e `mobile`

### Integracao com J&T

Status: funcional com validacao real

Arquivos principais:

- [src/infrastructure/http/jt-client.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/infrastructure/http/jt-client.ts:1)
- [src/infrastructure/http/jt-signature-service.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/infrastructure/http/jt-signature-service.ts:1)
- [src/domain/services/pickup-payload-builder.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/domain/services/pickup-payload-builder.ts:1)

O que ja faz:

- Gera `digest` de negocio.
- Gera `digest` de header.
- Monta request `application/x-www-form-urlencoded`.
- Gera `bizContent` para dry-run.
- Envia `addOrder` para a J&T.
- No sync operacional, respeita `JT_SEND_ENABLED=false` para validar sem chamar `addOrder`.
- No sync operacional, respeita `DAILY_SEND_LIMIT` para piloto com limite de envios reais.

O que foi confirmado na pratica:

- `prov` precisa ser usado no endereco da J&T
- `totalQuantity` para esta operacao precisa sair como `1`, pois o envio e sempre volume unico
- para `invoiceType=NFe`, a API aceitou o payload quando `taxCode` foi preenchido com o numero da nota fiscal
- o pedido `505720` foi criado com sucesso na J&T
- `itemsValue` e `priceCurrency` no nivel principal acionam comportamento de COD/cobranca na entrega; como a operacao nao e COD, estes campos nao devem ser enviados
- os itens do pacote podem ser enviados com `itemValue` por item, sem `itemsValue`/`priceCurrency` principais
- `itemNcm` so deve ser enviado quando existir NCM real; referencia interna de produto nao e NCM

### Regras de negocio

Status: implementado com ajustes validados

Arquivos principais:

- [src/domain/services/eligibility-service.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/domain/services/eligibility-service.ts:1)
- [src/domain/services/idempotency-service.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/domain/services/idempotency-service.ts:1)
- [src/domain/services/order-normalizer.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/domain/services/order-normalizer.ts:1)
- [src/domain/services/pickup-payload-builder.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/domain/services/pickup-payload-builder.ts:1)

O que ja existe:

- `txlogisticId` baseado em `branchCode-orderCode`
- validacao minima do payload antes do envio
- diagnostico de elegibilidade por motivo (`missing-shipping-address`, `missing-items`, `missing-invoice`, `canceled`)
- peso priorizando invoice quando o item nao traz peso
- telefone enriquecido pela `person`
- volume unico fixo no payload da J&T
- `taxCode` alimentado com o numero da nota fiscal
- lista de itens enviada dentro de `items`, incluindo `itemValue`
- campos de COD removidos do payload padrao

### Ferramentas operacionais

Status: concluido

Jobs criados:

- [src/app/jobs/smoke-totvs-search-orders.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/app/jobs/smoke-totvs-search-orders.ts:1)
- [src/app/jobs/dry-run-jt-order.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/app/jobs/dry-run-jt-order.ts:1)
- [src/app/jobs/send-jt-order.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/app/jobs/send-jt-order.ts:1)
- [src/app/jobs/inspect-postgres-report.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/app/jobs/inspect-postgres-report.ts:1)
- [src/app/jobs/run-window-pickup-sync.ts](/Users/leonardomiranda/Documents/IntergracaoJ&T/src/app/jobs/run-window-pickup-sync.ts:1)

Scripts disponiveis:

- `npm run check`
- `npm run db:migrate`
- `npm run db:inspect`
- `npm run smoke:totvs-orders`
- `npm run dry-run:jt-order`
- `npm run send:jt-order`
- `npm run sync:daily`
- `npm run sync:window`
- `npm run monitor:order`
- `npm run monitor:export-orders`
- `npm run override:order`
- `npm run reprocess:queue`
- `npm run reprocess:run`

Monitoramento leve:

```bash
npm run db:inspect
npm run db:inspect -- --days=1 --limit=20
```

O comando usa `DATABASE_URL` ou `POSTGRES_URL` do `.env` e imprime no terminal resumo de `sync_runs`, pickups recentes e erros recentes. Ele foi pensado para conferencia rapida no terminal antes/depois do lote diario e para apoiar consultas manuais no DBeaver.

## Persistencia

Status: implementada e validada em Postgres local; camada operacional adicionada em codigo

O que ja existe:

- Interfaces de repositorio para `sync_runs`, `orders`, `pickup_requests`, `integration_errors` e `execution_locks`
- Implementacao em memoria para organizar o fluxo
- Adapter Postgres selecionavel por `PERSISTENCE_ADAPTER=postgres`
- Configuracao por `DATABASE_URL` ou `POSTGRES_URL`
- Runner de migrations em `npm run db:migrate`
- Migration inicial em [database/migrations/001_initial_postgres_persistence.sql](/Users/leonardomiranda/Documents/IntergracaoJ&T/database/migrations/001_initial_postgres_persistence.sql)
- Repositorios Postgres para `sync_runs`, `orders`, `pickup_requests`, `integration_errors` e `execution_locks`
- Chave unica de `orders` por `branch_code + order_code`
- Chave unica de `pickup_requests.txlogistic_id`
- Reserva previa de `pickup_requests.txlogistic_id` com status `reserved` antes de chamar `addOrder`, evitando corrida entre execucoes concorrentes
- Registro de `bill_code` por `txlogistic_id`
- Erros de processamento por pedido gravam `branchCode`, `orderCode` e `txlogisticId` no contexto
- Base local `integracao_jt` migrada em Postgres `localhost:5432`
- Validacao controlada de idempotencia duravel com `txlogisticId=999-999999`
- Campo `pages_read` em `sync_runs` para registrar paginas TOTVS lidas
- Tabela `execution_locks` para impedir concorrencia da mesma janela
- Job operacional `npm run db:inspect` para consultar resumo local de `sync_runs`, `pickup_requests` e `integration_errors`
- Tabela `operational_issues` para pendencias abertas/resolvidas por pedido
- Tabela `order_processing_events` para linha do tempo operacional por pedido
- Tabela `order_overrides` para correcao temporaria auditada por pedido
- Tabelas `reprocess_requests` e `reprocess_attempts` para fila e historico de reprocessamento
- `npm run db:inspect` expandido para mostrar pendencias operacionais e fila de reprocessamento
- `npm run monitor:order` para consultar o estado completo de um pedido especifico
- `npm run monitor:export-orders` para gerar CSV/JSON do ultimo lote sem CPF, telefone ou endereco
- `npm run override:order` para criar correcao auditada de pedido
- `npm run reprocess:queue` e `npm run reprocess:run` para reprocessamento controlado
- `POST /api/reprocess-requests` para enfileirar reprocessamento especifico em dry-run pela interface

O que ainda falta:

- repetir a validacao em uma base definitiva de producao/homologacao quando ela for escolhida
- aplicar e validar a migration `004` na base definitiva, quando ela existir
- rodar primeiro reprocessamento em dry-run quando surgir uma pendencia real

## Interface operacional propria

Status: implementada no MVP inicial

Arquivos principais:

- [docs/plano-interface-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/plano-interface-operacional.md:1)
- [docs/monitoramento-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/monitoramento-operacional.md:1)
- [docs/interface-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/interface-operacional.md:1)

Direcao escolhida:

- tela principal com blocos conectados do fluxo
- stack `Next.js`
- detalhe por pedido com eventos, erros, overrides e reprocessamento
- remocao do n8n do projeto como caminho oficial

O que ja existe:

- app `Next.js` em `dashboard/`
- scripts `npm run ui:dev`, `npm run ui:build` e `npm run ui:start`
- dashboard com metricas, lotes e fluxo visual
- lista e detalhe de pedido
- tela de pendencias
- tela de reprocessamento
- APIs internas do painel para leitura e acoes operacionais

O que falta:

- autenticacao interna
- trilha de auditoria mais rica na interface
- comentarios/notas operacionais

## Logs e tratamento de erro

Status: implementado em nivel basico

O que ja existe:

- logger em console com sanitizacao antes de serializar
- classe de erro de integracao
- classificacao inicial de erro (`external-timeout`, `external-retryable`, `credentials`, `validation`, `unexpected`)
- registro de erros em repositorio dedicado com contexto sanitizado
- arquivos JSON de dry-run e de resposta real para auditoria manual
- mascaramento de CPF, CNPJ, telefone, token, senha, `client_secret`, `privateKey`, API key, `authorization`, `digest`, `bizDigest` e `signature`
- timeout HTTP default de `30000ms`
- retry HTTP default de 2 tentativas para timeout, rede, `429` e `5xx`

O que ainda falta:

- calibrar timeouts/retries por endpoint se a operacao real exigir
- correlacao por `sync_run_id`

## Validacoes executadas

Status: concluido

Foi executado com sucesso:

```bash
npm run check
npm run build
npm run db:migrate
npm run db:inspect -- --days=7 --limit=5
npm run monitor:export-orders
```

Foi validado na pratica:

- autenticacao real no TOTVS
- busca real de pedidos
- filtro real por `shippingCompanyCode=88442`
- consulta de telefone pela API `person`
- dry-run do payload da J&T
- envio real do pedido `505720`
- envio real do pedido JET `505757` com itens, `itemValue` e sem campos de COD
- diagnostico do erro `145003050 / Illegal parameters` no pedido `505726`
- confirmacao de que remover `items` sozinho nao resolvia o erro
- confirmacao de que remover `itemsValue` e `priceCurrency` resolvia o erro
- envio/modificacao real do pedido `505726` com itens e sem campos de COD
- migration Postgres aplicada na base local `integracao_jt`
- idempotencia duravel validada com nova conexao Postgres e unicidade de `pickup_requests.txlogistic_id`
- typecheck da paginacao TOTVS com registro de `pagesRead`
- migration `003` aplicada para `execution_locks`
- trava Postgres validada com duas tentativas concorrentes da mesma chave
- dry-run operacional validado com teste fake sem chamada a `addOrder`
- sanitizacao validada para CPF, CNPJ, telefone, token e chave privada
- `npm run db:inspect` validado contra Postgres local
- smoke de 2026-06-03: janela do dia e ultimos 7 dias com `BillingReleased` retornaram zero pedidos JET; ultimos 30 dias sem status retornaram pedidos JET com `statusOrder=Attended`
- por decisao operacional, `VIRTUAL_AGE_ORDER_STATUS_LIST` passou a usar `Attended`
- dry-run real de 2026-06-03 com `Attended`: `pagesRead=2`, `ordersRead=158`, `pickupsDryRun=145`, `ordersIgnored=13`, `pickupsSent=0`, `pickupsCreated=0`, `errors=0`
- diagnostico de elegibilidade implementado para explicar, nos proximos dry-runs, por que pedidos foram ignorados
- monitoramento aplicado em banco com migration `004`
- dry-run real apos filtro defensivo local por transportadora: `pagesRead=2`, `ordersRead=102`, `pickupsDryRun=102`, `ordersIgnored=0`, `pickupsSent=0`, `pickupsCreated=0`, `errors=0`
- 13 pendencias antigas de `missing-shipping-address` foram marcadas como resolvidas por estarem associadas a pedidos fora do escopo J&T/JET `88442`
- CSV de conferencia gerado em `docs/operational-exports/orders-latest.csv` com 102 linhas e sem CPF, telefone ou endereco
- decisao de descontinuar o n8n como orquestrador/interface oficial
- `npm run ui:build` validado com sucesso
- limpeza manual da base local validada: tabelas operacionais zeradas e `schema_migrations=4`
- validacao operacional concluida em dry-run: painel, APIs, exportacao, inspeção de pedido, bloqueio de reprocessamento em pedido saudavel e reprocessamento controlado de pedido com pendencia aberta
- dry-run real de 2026-06-03 apos ajuste anti-duplicidade: `pagesRead=2`, `ordersRead=102`, `pickupsDryRun=102`, `pickupsSent=0`, `pickupsCreated=0`, `errors=0`
- `GET /api/dashboard` validado com fluxo de 8 blocos: TOTVS, paginacao, elegibilidade, payload, envio unico, banco, pendencias e reprocessamento
- `POST /api/reprocess-requests` validado com bloqueio para pedido sem pendencia aberta
- reprocessamento por pedido testado com pendencia sintetica controlada em `313-506220`, processado em dry-run e removido da base apos o teste
- checagem do painel no navegador interno: 8 blocos no fluxo, 4 acoes rapidas, formulario em `/reprocess` e sem overflow horizontal no viewport testado
- envio real em massa de 2026-06-08: pre-validacao em dry-run com `pagesRead=3`, `ordersRead=161`, `pickupsDryRun=161`, `errors=0`
- envio real em massa de 2026-06-08 confirmado pelo usuario e executado com `JT_SEND_ENABLED=true DAILY_SEND_LIMIT= npm run sync:daily`
- resultado do envio real de 2026-06-08: `syncRunId=0e684902-6982-4594-a6db-65b96c77dfd9`, `pagesRead=3`, `ordersRead=161`, `pickupsSent=161`, `pickupsCreated=161`, `errors=0`
- conferencia Postgres apos envio: `pickup_requests` ficou com 161 registros `created`, sem pendencias abertas e sem erros recentes
- CSV operacional atualizado em `docs/operational-exports/orders-latest.csv` com 161 linhas e sem CPF, telefone ou endereco
- workflow GitHub Actions diario criado em `.github/workflows/sync-diario-jt.yml`, agendado para 17:00 Sao Paulo e com trava para envio real via variavel `JT_SEND_ENABLED`
- guia de hospedagem gratuita criado em `docs/hospedagem-gratuita.md` com arquitetura GitHub Actions + Neon Postgres + Netlify/Vercel
- projeto publicado no GitHub em `integracoes-alphabeto/Integra-aoJ-T`, branch `main`

Arquivos gerados durante os testes:

- [docs/attended-jet-orders.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/attended-jet-orders.json)
- [docs/jt-order-505720-dry-run.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505720-dry-run.json)
- [docs/jt-order-505720-send-response.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505720-send-response.json)
- [docs/jt-order-505757-dry-run.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505757-dry-run.json)
- [docs/jt-order-505757-send-response.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505757-send-response.json)
- [docs/jt-order-505726-current-dry-run.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505726-current-dry-run.json)
- [docs/jt-order-505726-variant-no-items-response.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505726-variant-no-items-response.json)
- [docs/jt-order-505726-variant-no-items-no-cod-response.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505726-variant-no-items-no-cod-response.json)
- [docs/jt-order-505726-fixed-dry-run.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505726-fixed-dry-run.json)
- [docs/jt-order-505726-fixed-send-response.json](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/jt-order-505726-fixed-send-response.json)

## Proximos passos recomendados

Detalhamento operacional: [docs/proximos-passos-producao.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/proximos-passos-producao.md)

1. Colocar a interface operacional no fluxo diario de conferencia.
2. Conferir com a operacao/transportadora os 161 `billCode` criados em 2026-06-08.
3. Definir se o proximo lote real sera manual assistido ou cron definitivo.
4. Criar/publicar o repositorio no GitHub e cadastrar os Secrets/Variables do workflow.
5. Criar banco Neon e apontar `DATABASE_URL` para ele.
6. Adicionar autenticacao interna e auditoria de acoes da interface.
7. Manter `DAILY_SEND_LIMIT` definido no `.env` enquanto o cron definitivo nao for aprovado.
8. Implementar consulta/cancelamento/etiqueta/rastreio na J&T.

## Como manter este arquivo atualizado

Sempre que houver validacao relevante, atualizar:

- a data do topo
- o resumo atual
- as secoes de integracao validada
- os comandos realmente disponiveis
- os proximos passos
