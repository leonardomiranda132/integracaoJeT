# Comandos de Teste no Terminal

Atualizado em: 2026-06-09.

Este documento junta os comandos principais para validar a integracao no terminal sem depender do historico do chat.

## Preparacao

Instalar dependencias:

```bash
npm install
```

Verificar tipagem:

```bash
npm run check
```

Compilar:

```bash
npm run build
```

Aplicar migrations Postgres:

```bash
npm run db:migrate
```

Consultar resumo operacional no Postgres:

```bash
npm run db:inspect
npm run db:inspect -- --days=1 --limit=20
```

Inspecionar pedido especifico:

```bash
npm run monitor:order -- --branch=313 --order=506144
```

Exportar pedidos do ultimo sync para conferencia sem dados sensiveis:

```bash
npm run monitor:export-orders
npm run monitor:export-orders -- --format=json
```

## GitHub Actions remoto

Conferir Secrets cadastradas sem exibir valores:

```bash
gh secret list --repo leonardomiranda132/integracaoJeT
```

Conferir Variables cadastradas:

```bash
gh variable list --repo leonardomiranda132/integracaoJeT
```

Manter o agendamento automatico em modo seguro:

```bash
gh variable set JT_SEND_ENABLED --repo leonardomiranda132/integracaoJeT --body false
gh variable set POSTGRES_SSL --repo leonardomiranda132/integracaoJeT --body true
```

Rodar o workflow manual em dry-run, sem envio para a J&T:

```bash
gh workflow run sync-diario-jt.yml --repo leonardomiranda132/integracaoJeT --field send_enabled=false --field daily_send_limit=
```

Ver execucoes recentes:

```bash
gh run list --repo leonardomiranda132/integracaoJeT --workflow sync-diario-jt.yml --limit 5
```

Assistir logs de uma execucao:

```bash
gh run watch --repo leonardomiranda132/integracaoJeT <run-id>
```

## Smoke test do TOTVS

Executar o smoke test padrao:

```bash
npm run smoke:totvs-orders
```

Executar buscando pedidos `Attended`:

```bash
VIRTUAL_AGE_ORDER_STATUS_LIST=Attended npm run smoke:totvs-orders
```

Executar filtrando por codigo da transportadora:

```bash
VIRTUAL_AGE_ORDER_STATUS_LIST=Attended SMOKE_SHIPPING_COMPANY_CODE=88442 npm run smoke:totvs-orders
```

Executar filtrando por nome da transportadora no retorno:

```bash
VIRTUAL_AGE_ORDER_STATUS_LIST=Attended SMOKE_SHIPPING_COMPANY_NAME='JET EXPRESS BRAZIL LTDA.' npm run smoke:totvs-orders
```

Salvar o retorno da busca em JSON:

```bash
VIRTUAL_AGE_ORDER_STATUS_LIST=Attended SMOKE_SHIPPING_COMPANY_CODE=88442 SMOKE_OUTPUT_FILE=docs/attended-jet-orders.json npm run smoke:totvs-orders
```

## Dry-run da J&T

Gerar dry-run do primeiro pedido do arquivo salvo:

```bash
npm run dry-run:jt-order
```

Gerar dry-run de um indice especifico:

```bash
DRY_RUN_ORDER_INDEX=0 npm run dry-run:jt-order
```

Salvar em arquivo especifico:

```bash
DRY_RUN_ORDER_INDEX=0 DRY_RUN_OUTPUT_FILE=docs/jt-order-505720-dry-run.json npm run dry-run:jt-order
```

Trocar o arquivo de entrada:

```bash
DRY_RUN_INPUT_FILE=docs/attended-jet-orders.json DRY_RUN_ORDER_INDEX=0 npm run dry-run:jt-order
```

## Envio real para a J&T

Enviar o primeiro pedido do arquivo salvo:

```bash
npm run send:jt-order
```

Enviar um indice especifico:

```bash
SEND_ORDER_INDEX=0 npm run send:jt-order
```

Salvar a resposta da J&T em arquivo especifico:

```bash
SEND_ORDER_INDEX=0 SEND_ORDER_OUTPUT_FILE=docs/jt-order-505720-send-response.json npm run send:jt-order
```

Trocar o arquivo de entrada do envio:

```bash
SEND_ORDER_INPUT_FILE=docs/attended-jet-orders.json SEND_ORDER_INDEX=0 npm run send:jt-order
```

## Diagnostico do erro Illegal parameters

Os arquivos abaixo ficaram salvos como amostra historica do payload antigo, antes da correcao:

- `docs/jt-order-505720-current-dry-run.json`
- `docs/jt-order-505726-current-dry-run.json`

Inspecionar a amostra antiga para ver os campos de COD no nivel principal:

```bash
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('docs/jt-order-505726-current-dry-run.json','utf8')).payload; console.log({items:p.items?.length, itemsValue:p.itemsValue, priceCurrency:p.priceCurrency});"
```

Com o codigo atual, gerar o dry-run corrigido do pedido `505726`:

```bash
DRY_RUN_ORDER_INDEX=2 DRY_RUN_OUTPUT_FILE=docs/jt-order-505726-fixed-dry-run.json npm run dry-run:jt-order
```

Enviar o pedido `505726` com o payload corrigido:

```bash
SEND_ORDER_INDEX=2 SEND_ORDER_OUTPUT_FILE=docs/jt-order-505726-fixed-send-response.json npm run send:jt-order
```

Gerar e enviar o pedido JET `505757`, que fica no indice `6` do arquivo salvo:

```bash
DRY_RUN_ORDER_INDEX=6 DRY_RUN_OUTPUT_FILE=docs/jt-order-505757-dry-run.json npm run dry-run:jt-order
```

```bash
SEND_ORDER_INDEX=6 SEND_ORDER_OUTPUT_FILE=docs/jt-order-505757-send-response.json npm run send:jt-order
```

Observacoes:

- `itemsValue` e `priceCurrency` no nivel principal representam COD/cobranca na entrega na documentacao da J&T
- como a operacao atual nao e COD, esses campos devem ficar ausentes
- o preco dos produtos vai em `items[].itemValue`; no teste do pedido `505757`, a soma dos itens fechou com o valor da nota
- o pedido `505726`, no arquivo salvo usado no diagnostico, veio com transportadora JAD `2522`; ele nao deve aparecer no fluxo automatico filtrado por JET `88442`

## Sync diario

Executar o fluxo principal completo:

```bash
npm run sync:daily
```

## Sync com janela customizada

Usar quando o dia atual nao tem pedidos elegiveis, mas precisamos validar uma janela historica em dry-run:

```bash
JT_SEND_ENABLED=false SYNC_START_DATE=2026-05-04 SYNC_END_DATE=2026-06-03 npm run sync:window
```

As datas podem ser informadas como `YYYY-MM-DD` ou ISO com timezone, por exemplo:

```bash
SYNC_START_DATE=2026-05-04T00:00:00-03:00 SYNC_END_DATE=2026-06-03T23:59:59-03:00 JT_SEND_ENABLED=false npm run sync:window
```

Executar o sync em dry-run operacional, sem chamar `addOrder` na J&T:

```bash
JT_SEND_ENABLED=false npm run sync:daily
```

Executar envio real de todos os pedidos elegiveis:

```bash
JT_SEND_ENABLED=true DAILY_SEND_LIMIT= npm run sync:daily
```

Observacao:

- este fluxo busca pedidos no TOTVS, enriquece telefone na `person` e tenta criar pedido real na J&T
- com `JT_SEND_ENABLED=false`, ele monta e valida o payload, mas nao envia para a J&T
- com `DAILY_SEND_LIMIT=N`, ele limita o envio real a `N` pedidos
- com `DAILY_SEND_LIMIT=0`, envios reais ficam bloqueados
- duas execucoes da mesma janela nao devem rodar ao mesmo tempo por causa da trava `execution_locks`
- no smoke de 2026-06-03, `BillingReleased` retornou zero pedidos JET e a janela de 30 dias sem status retornou pedidos com `statusOrder=Attended`; por decisao operacional, o filtro padrao passou a ser `Attended`
- ele depende das variaveis do `.env` estarem corretas

## Monitoramento e reprocessamento

Aplicar as tabelas operacionais:

```bash
npm run db:migrate
```

Inspecionar um pedido:

```bash
npm run monitor:order -- --branch=313 --order=506144
```

Exportar o ultimo lote para conferir com operacao/transportadora, sem envio real:

```bash
npm run monitor:export-orders
```

Salvar em outro caminho:

```bash
npm run monitor:export-orders -- --output=docs/operational-exports/pedidos-2026-06-03.csv
```

Criar override auditado para corrigir endereco no reprocessamento:

```bash
npm run override:order -- --branch=313 --order=506144 --reason="Endereco validado pela operacao" --patch='{"shippingAddress":{"postCode":"00000000","street":"RUA EXEMPLO","streetNumber":"123","neighborhood":"CENTRO","city":"SAO PAULO","state":"SP"}}'
```

Enfileirar reprocessamento em dry-run:

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Validar pedido corrigido"
```

Processar a fila:

```bash
npm run reprocess:run
npm run reprocess:run -- --limit=10
```

Enfileirar envio real apos aprovacao operacional:

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Enviar pedido corrigido" --send
npm run reprocess:run
```

Forcar envio somente apos conferencia manual na J&T:

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Reenvio autorizado apos conferencia J&T" --send --force-send
```

## Arquivos uteis de saida

Arquivos gerados pelos testes:

- `docs/attended-jet-orders.json`
- `docs/jt-order-dry-run.json`
- `docs/jt-order-505720-dry-run.json`
- `docs/jt-order-505720-send-response.json`
- `docs/jt-order-505757-dry-run.json`
- `docs/jt-order-505757-send-response.json`
- `docs/jt-order-505726-fixed-dry-run.json`
- `docs/jt-order-505726-fixed-send-response.json`

## Variaveis importantes

Em 2026-06-03, `.env` e `.env.example` foram alinhados com o mesmo conjunto de
70 chaves ativas. O `.env` real ficou com `PERSISTENCE_ADAPTER=postgres`,
`DATABASE_MIGRATIONS_DIR=database/migrations`, `VIRTUAL_AGE_ORDER_MAX_PAGES=100`
e `JT_SEND_ENABLED=false` explicito. O `.env.example` passou a documentar a
configuracao Postgres atual, remetente J&T, fallback de telefone e variaveis de
reprocessamento manual sem expor valores reais.

Variaveis que impactam diretamente os testes:

- `VIRTUAL_AGE_BRANCH`
- `VIRTUAL_AGE_BRANCH_CODES`
- `VIRTUAL_AGE_ORDER_STATUS_LIST`
- `VIRTUAL_AGE_SHIPPING_COMPANY_CODE`
- `VIRTUAL_AGE_ORDER_EXPAND`
- `VIRTUAL_AGE_ORDER_PAGE_SIZE`
- `VIRTUAL_AGE_ORDER_MAX_PAGES`
- `PERSISTENCE_ADAPTER`
- `DATABASE_URL`
- `POSTGRES_URL`
- `JT_SEND_ENABLED`
- `DAILY_SEND_LIMIT`
- `SYNC_START_DATE`
- `SYNC_END_DATE`
- `JT_BASE_URL`
- `JT_API_ACCOUNT`
- `JT_PRIVATE_KEY`
- `JT_CUSTOMER_CODE`
- `JT_CUSTOMER_PASSWORD`
- `JT_SENDER_NAME`
- `JT_SENDER_TAX_NUMBER`
- `JT_SENDER_MOBILE`
- `JT_SENDER_PHONE`
- `JT_SENDER_POST_CODE`
- `JT_SENDER_STATE`
- `JT_SENDER_CITY`
- `JT_SENDER_AREA`
- `JT_SENDER_STREET`
- `JT_SENDER_STREET_NUMBER`
- `JT_SENDER_ADDRESS`
- `JT_SENDER_IE_NUMBER`
- `ORDER_BRANCH_CODE`
- `ORDER_CODE`
- `ORDER_OVERRIDE_PATCH`
- `ORDER_OVERRIDE_REASON`
- `REPROCESS_REASON`
- `REPROCESS_REQUESTED_BY`
- `REPROCESS_JT_SEND_ENABLED`
- `REPROCESS_FORCE_SEND`
- `REPROCESS_LIMIT`

Variaveis opcionais de execucao pontual, como `SYNC_START_DATE`,
`SYNC_END_DATE`, `SMOKE_OUTPUT_FILE`, `DRY_RUN_OUTPUT_FILE`,
`SEND_ORDER_OUTPUT_FILE`, `EXPORT_OUTPUT_FILE`, `INSPECT_DAYS` e
`INSPECT_LIMIT`, continuam fora do `.env` por padrao para nao mudar o
comportamento normal dos jobs. Use-as inline no comando quando precisar.

Proximos cuidados:

1. manter `.env` e `.env.example` com o mesmo conjunto de chaves ativas
2. deixar `JT_SEND_ENABLED=false` enquanto o envio real nao estiver liberado
3. nao commitar valores reais de `.env`
4. preferir variaveis inline para testes pontuais de janela, arquivo de saida e indice de pedido

## Sequencia recomendada de teste

Tambem existe a tela `/steps` na interface operacional para executar estes
passos separadamente sem abrir o terminal. Ela usa uma whitelist fixa de
comandos, mostra stdout/stderr no card da etapa e força `JT_SEND_ENABLED=false`
nos passos sensiveis.

1. Verifique a tipagem:

```bash
npm run check
```

2. Aplique migrations e confira o Postgres:

```bash
npm run db:migrate
npm run db:inspect
```

3. Gere a busca real do TOTVS:

```bash
VIRTUAL_AGE_ORDER_STATUS_LIST=Attended SMOKE_SHIPPING_COMPANY_CODE=88442 SMOKE_OUTPUT_FILE=docs/attended-jet-orders.json npm run smoke:totvs-orders
```

4. Gere o dry-run do pedido desejado:

```bash
DRY_RUN_ORDER_INDEX=0 DRY_RUN_OUTPUT_FILE=docs/jt-order-505720-dry-run.json npm run dry-run:jt-order
```

5. Rode o sync operacional em dry-run:

```bash
JT_SEND_ENABLED=false npm run sync:daily
```

Equivalentes disponiveis em `/steps`:

- `npm run db:migrate`
- `npm run db:inspect -- --days=1 --limit=20`
- `VIRTUAL_AGE_ORDER_STATUS_LIST=Attended SMOKE_SHIPPING_COMPANY_CODE=88442 SMOKE_OUTPUT_FILE=docs/attended-jet-orders.json npm run smoke:totvs-orders`
- `DRY_RUN_INPUT_FILE=docs/attended-jet-orders.json DRY_RUN_ORDER_INDEX=0 DRY_RUN_OUTPUT_FILE=docs/jt-order-dry-run.json npm run dry-run:jt-order`
- `JT_SEND_ENABLED=false npm run sync:daily`
- `npm run monitor:export-orders`
- `JT_SEND_ENABLED=false npm run reprocess:run -- --limit=5`

Proximos passos da tela `/steps`:

1. avaliar com a operacao se a ordem dos cards reflete o fluxo real
2. adicionar campos controlados para janela de datas e indice do pedido
3. registrar auditoria persistente de quem executou cada passo quando houver autenticacao

6. Se o dia atual estiver sem pedidos, rode uma janela historica em dry-run:

```bash
JT_SEND_ENABLED=false SYNC_START_DATE=2026-05-04 SYNC_END_DATE=2026-06-03 npm run sync:window
```

7. Se o payload estiver correto e a operacao estiver acompanhando, envie sem limite:

```bash
JT_SEND_ENABLED=true DAILY_SEND_LIMIT= npm run sync:daily
```

8. Para envio manual de um pedido especifico, use:

```bash
SEND_ORDER_INDEX=0 SEND_ORDER_OUTPUT_FILE=docs/jt-order-505720-send-response.json npm run send:jt-order
```

9. Para reprocessamento operacional com auditoria, use a fila:

```bash
npm run monitor:order -- --branch=313 --order=506144
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Validar pedido"
npm run reprocess:run
```
