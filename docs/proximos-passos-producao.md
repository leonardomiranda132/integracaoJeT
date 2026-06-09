# Proximos Passos para Producao

Atualizado em: 2026-06-09.

Este documento organiza o caminho recomendado para sair da validacao tecnica atual e chegar em uma operacao diaria de producao com seguranca, rastreabilidade e menor risco de duplicidade.

## Objetivo

Colocar em producao a integracao entre TOTVS Moda/Virtual Age e J&T para criar pedidos/coletas automaticamente a partir dos pedidos elegiveis do dia.

O foco inicial nao e adicionar muitas funcionalidades novas. O foco e garantir que o fluxo que ja foi validado em testes reais consiga rodar todo dia sem:

- reenviar pedido ja criado na J&T
- deixar pedido elegivel fora do lote por limite de pagina
- expor dados sensiveis em logs
- falhar sem registro suficiente para reprocessamento
- rodar duas execucoes concorrentes no mesmo intervalo

## Estado atual

Ja foi validado com sucesso:

- autenticacao real no TOTVS Moda
- busca real de pedidos via `/orders/search`
- filtro real por transportadora JET/J&T `shippingCompanyCode=88442`
- enriquecimento de telefone pela API `person`
- montagem de payload J&T com dados reais
- dry-run completo do `bizContent`
- envio real de pedidos para a J&T
- ajuste de payload para evitar comportamento de COD/cobranca na entrega
- envio de itens com `itemValue`, sem `itemsValue` e sem `priceCurrency` no nivel principal
- `totalQuantity=1` para volume unico
- `taxCode` preenchido com numero da nota fiscal

Principais lacunas antes de producao:

- a persistencia Postgres ja existe no codigo e foi validada em uma base local
- a idempotencia duravel ja tem indice unico por `txlogisticId` e foi validada com nova conexao Postgres
- a idempotencia foi reforcada com reserva previa de `pickup_requests.txlogistic_id` antes de qualquer chamada real para a J&T
- a busca TOTVS paginada ja foi implementada e validada em dry-run real com volume acima de uma pagina
- a trava de execucao ja foi implementada e validada em Postgres local
- logs e contextos de erro ja recebem mascaramento basico de dados sensiveis
- timeouts, retries basicos e classificacao inicial de erros externos ja estao ativos
- dry-run operacional, limite de envio e inspeção local ja foram implementados
- piloto dry-run real com `Attended` ja leu volume acima de uma pagina
- ainda falta comparar os ignorados do dry-run com a operacao manual e rodar piloto com envio real limitado
- o smoke de 2026-06-03 encontrou pedidos JET nos ultimos 30 dias sem filtro de status, com `statusOrder=Attended`; `BillingReleased` retornou zero para o dia e para 7 dias
- por decisao operacional, o filtro padrao de status passou a ser `Attended`
- monitoramento operacional, pendencias por pedido, overrides e fila de reprocessamento foram adicionados em codigo
- apos a API retornar pedidos fora do `shippingCompanyCode=88442`, foi adicionada trava defensiva local por transportadora; o dry-run filtrado passou para `ordersRead=102`, `pickupsDryRun=102`, `ordersIgnored=0`
- a interface operacional propria em `Next.js` foi implementada e o n8n saiu do repositorio
- o dashboard foi redesenhado com fluxo operacional conectado e formulario para reprocessar pedido especifico por filial/pedido
- envio real em massa foi executado em 2026-06-08 apos confirmacao explicita do usuario: 161 pedidos/coletas criados na J&T, `errors=0`
- workflow GitHub Actions diario foi criado em `.github/workflows/sync-diario-jt.yml`, com agendamento as 17:00 Sao Paulo e envio real controlado por `JT_SEND_ENABLED`
- comando `npm run github:actions-config` foi adicionado para cadastrar GitHub Actions Secrets e Variables a partir do `.env`, usando `gh` autenticado e mantendo `JT_SEND_ENABLED=false` por seguranca no cadastro inicial
- GitHub Actions Secrets e Variables foram cadastradas em 2026-06-09 e conferidas sem expor valores; em 2026-06-09 o limite padrao foi removido, mantendo `DAILY_SEND_LIMIT` vazio/ausente para enviar todos quando `JT_SEND_ENABLED=true`
- a primeira execucao remota manual (`runId=27222528597`) falhou como `startup_failure` sem jobs; o workflow foi simplificado para configurar modo operacional em passo shell antes de nova tentativa
- a segunda execucao remota manual (`runId=27222726787`) tambem falhou como `startup_failure`; a anotacao do GitHub apontou Billing/limite de gastos como causa, entao o dry-run remoto esta bloqueado ate regularizar `Billing & plans`
- o projeto foi migrado para `leonardomiranda132/integracaoJeT`; o workflow passou a iniciar, mas a primeira execucao no repo novo (`runId=27223133855`) falhou porque `DATABASE_URL` apontava para `localhost:5432` em vez do Neon
- apos corrigir a Secret `DATABASE_URL` para Neon, o workflow remoto `runId=27223325769` passou em dry-run: `pagesRead=2`, `ordersRead=126`, `pickupsDryRun=126`, `pickupsSent=0`, `pickupsCreated=0`, `errors=0`

## Principios para entrada em producao

- Idempotencia vem antes de volume.
- Paginacao vem antes de automacao diaria.
- Observabilidade vem antes de cron definitivo.
- Piloto controlado vem antes de liberar todos os pedidos.
- Nenhum log de producao deve expor CPF, CNPJ, telefone, endereco completo, token, senha, chave privada ou digest.
- Toda falha precisa deixar rastro suficiente para diagnostico e reprocessamento seguro.
- Toda correcao manual precisa ficar auditada em `order_overrides` ou ser feita na origem TOTVS.

## Fase 0: Fechamento operacional

Antes de implementar o pacote final, confirmar as regras de negocio que vao governar a producao.

Checklist:

- Confirmar que o codigo da transportadora JET/J&T no TOTVS e `88442`.
- Confirmar quais filiais entram no primeiro escopo.
- Confirmar qual status TOTVS representa pedido pronto para coleta.
- Confirmar que a janela diaria sera de `00:00:00` ate `17:00:00`, considerando fechamento operacional por volta das `16:30`.
- Confirmar se o envio sera sempre volume unico com `totalQuantity=1`.
- Confirmar que a operacao nao usa COD/cobranca na entrega.
- Confirmar se pedidos parcialmente atendidos devem entrar ou aguardar outra regra.
- Confirmar o que a operacao quer fazer quando um pedido ja existir na J&T.
- Confirmar se apos criar o pedido na J&T devemos atualizar observacao/status no TOTVS.
- Confirmar credenciais e URLs de homologacao e producao da J&T.
- Confirmar credenciais, `x-api-key`, URL e permissoes do usuario TOTVS de producao.

Entregavel esperado:

- Regras de negocio confirmadas e refletidas em variaveis de ambiente ou documentacao operacional.

## Fase 1: Pacote minimo de producao

Esta fase e obrigatoria antes de ligar o job automatico em producao.

### 1. Persistencia real

Trocar os repositorios em memoria por banco duravel, preferencialmente Postgres.

Status em 2026-06-03: implementado e validado em Postgres local. Foram adicionados adapter Postgres, migration inicial, runner `npm run db:migrate`, chave unica de `orders` por `branch_code + order_code` e chave unica de `pickup_requests.txlogistic_id`. A migration foi aplicada na base local `integracao_jt` e a idempotencia foi validada com `txlogisticId=999-999999` apos recriar a conexao.

Atualizacao de 2026-06-03: antes de chamar `addOrder`, o sync e a fila de
reprocessamento tentam reservar `pickup_requests.txlogistic_id` com status
`reserved`. Se a reserva falhar por registro existente, a chamada J&T nao
comeca. Isso reduz o risco de duplicidade em execucoes concorrentes.

Tabelas sugeridas:

- `sync_runs`: execucoes do lote, janela consultada, status, metricas e timestamps.
- `orders`: pedidos encontrados no TOTVS, dados principais, status interno e ultima atualizacao.
- `pickup_requests`: vinculo entre pedido TOTVS e pedido J&T, `txlogisticId`, `billCode`, status, payload seguro e resposta segura.
- `integration_errors`: erros de validacao, autenticacao, timeout, falha externa e pendencias operacionais.

Regras importantes:

- `pickup_requests.txlogistic_id` deve ter indice unico.
- `orders` deve ter chave unica por `branch_code + order_code`.
- erros devem manter `branchCode`, `orderCode`, `txlogisticId` quando existirem.
- payloads completos devem ser armazenados com cuidado, preferencialmente mascarados ou protegidos.

Criterios de aceite:

- Rodar o job duas vezes na mesma janela nao cria pedido duplicado na J&T.
- Parar e iniciar o processo novamente nao perde historico.
- Um pedido ja enviado continua sendo ignorado por idempotencia.
- E possivel saber qual `billCode` foi gerado para cada `txlogisticId`.

### 2. Paginacao real do TOTVS

Implementar busca paginada no endpoint `/orders/search`.

Status em 2026-06-03: implementado em codigo. A rotina busca paginas sucessivas usando `VIRTUAL_AGE_ORDER_PAGE_SIZE` / `TOTVS_ORDER_PAGE_SIZE`, para quando `hasNext=false`, quando `totalPages` indica a ultima pagina, quando a pagina vem vazia ou quando a pagina retorna menos itens que o tamanho configurado. O total de paginas lidas e registrado em `sync_runs.pages_read`. O limite operacional e configurado por `VIRTUAL_AGE_ORDER_MAX_PAGES` / `TOTVS_ORDER_MAX_PAGES`.

Atualizacao de 2026-06-03: validado em dry-run real com `pageSize=100`,
`pagesRead=2`, `ordersRead=102`, `pickupsDryRun=102`, `pickupsSent=0`,
`pickupsCreated=0` e `errors=0`. Portanto o valor 100 esta confirmado como
tamanho de pagina, nao limite total do lote.

Comportamento recomendado:

- iniciar em `page=1`
- usar `pageSize` configuravel, preferencialmente ate o limite seguro aceito pela API
- continuar buscando enquanto a pagina voltar cheia
- parar quando a quantidade de itens retornados for menor que `pageSize`
- registrar no `sync_run` quantas paginas foram lidas
- adicionar limite maximo de paginas como protecao operacional

Criterios de aceite:

- Se houver mais pedidos que o tamanho da primeira pagina, todos sao lidos.
- O log final informa total de paginas e total de pedidos.
- Falha em uma pagina fica registrada como erro da execucao.

### 3. Trava de execucao

Impedir que duas rotinas do mesmo lote rodem ao mesmo tempo.

Status em 2026-06-03: implementado e validado em Postgres local. O sync usa chave `sync-orders:{startDate}:{endDate}` e tabela `execution_locks`. Se a chave ja estiver ativa, a segunda execucao aborta com mensagem clara. A liberacao ocorre no `finally`, inclusive em falha.

Opcoes:

- lock por tabela no banco
- advisory lock do Postgres
- lock no orquestrador, se a plataforma escolhida oferecer isso de forma confiavel

Criterios de aceite:

- Se uma execucao estiver ativa, uma segunda tentativa aborta com mensagem clara.
- A rotina nao cria pedidos duplicados por concorrencia.

### 4. Mascaramento de dados sensiveis

Criar uma camada de sanitizacao para logs, erros e arquivos operacionais.

Status em 2026-06-03: implementado em logs e contextos persistidos em `integration_errors`. O sanitizador mascara CPF, CNPJ, telefone, token, senha, `client_secret`, `privateKey`, API key, `authorization`, `digest`, `bizDigest` e `signature`, preservando identificadores operacionais como `branchCode`, `orderCode`, `txlogisticId` e `billCode`.

Dados que devem ser mascarados:

- CPF
- CNPJ
- telefone
- endereco completo
- token
- senha
- `client_secret`
- `privateKey`
- digest de header
- digest de negocio
- chave de NF-e, se a operacao considerar sensivel

Criterios de aceite:

- Nenhum log de producao mostra documento ou telefone completo.
- Nenhum arquivo operacional gravado automaticamente contem segredo.
- Erros externos continuam diagnosticaveis mesmo com dados sensiveis mascarados.

### 5. Timeouts, retries e classificacao de erro

Fortalecer chamadas externas para TOTVS, Person API e J&T.

Status em 2026-06-03: implementado em `FetchHttpClient`. Timeout default: `30000ms`. Retry default: 2 tentativas com backoff e jitter para timeout, erro de rede, `429` e `5xx`. Erros `401/403` sao classificados como `credentials`, outros `4xx` como `validation`; erros temporarios como `external-timeout` ou `external-retryable`.

Regras recomendadas:

- timeout por requisicao HTTP
- retry controlado para timeout, erro de rede, `429` e `5xx`
- nao repetir automaticamente erro de validacao de payload
- nao repetir automaticamente erro de assinatura/credencial
- classificar erro como `external-timeout`, `external-retryable`, `validation`, `credentials`, `duplicate`, `unexpected`

Criterios de aceite:

- Falha temporaria nao derruba todo o lote sem tentativa controlada.
- Falha de um pedido nao impede processamento dos demais.
- Erros ficam salvos com categoria clara para acao operacional.

### 6. Modo dry-run e limite de envio

Manter uma chave operacional para rodar sem enviar para a J&T.

Status em 2026-06-03: implementado em codigo para o sync operacional.
`JT_SEND_ENABLED=false` monta e valida o payload sem chamar `addOrder`.
Quando `JT_SEND_ENABLED` nao esta definido, `INTEGRATION_DRY_RUN=true` continua
funcionando como compatibilidade. `DAILY_SEND_LIMIT=N` limita envios reais por
execucao; `DAILY_SEND_LIMIT=0` bloqueia envios reais. O resumo do lote informa
pedidos lidos, ignorados, dry-run, enviados e erros.

Configuracoes sugeridas:

- `JT_SEND_ENABLED=false` para dry-run operacional
- `DAILY_SEND_LIMIT=` vazio ou ausente para enviar todos os pedidos elegiveis
- `DAILY_SEND_LIMIT=N` apenas se for necessario retomar um piloto limitado
- `DRY_RUN_OUTPUT_DIR=docs` ou outro diretorio seguro, quando aplicavel

Criterios de aceite:

- Em dry-run, o sistema monta e valida payload, mas nao chama `addOrder`.
- Em envio real limitado, o sistema para ao atingir o limite configurado.
- O resumo final informa quantos pedidos foram lidos, aptos, enviados, ignorados e com erro.

### 7. Monitoramento e reprocessamento

Criar uma camada operacional para acompanhar pendencias e reprocessar pedidos
especificos sem burlar idempotencia.

Status em 2026-06-03: implementado em codigo. Foram adicionadas as tabelas
`operational_issues`, `order_processing_events`, `order_overrides`,
`reprocess_requests` e `reprocess_attempts`. O sync grava eventos por pedido e
abre pendencias quando um pedido fica inelegivel ou falha. Os comandos
`monitor:order`, `override:order`, `reprocess:queue` e `reprocess:run` foram
adicionados.

Atualizacao de 2026-06-03: a interface tambem possui `POST
/api/reprocess-requests` e formulario direto para digitar filial/pedido. O
reprocessamento pela interface e sempre dry-run e so aceita pedido com
pendencia operacional aberta.

Criterios de aceite:

- Pedidos ignorados aparecem em `operational_issues` com motivo claro.
- Um pedido especifico pode ser inspecionado por filial/pedido.
- Um reprocessamento em dry-run pode ser enfileirado e auditado.
- Um envio real de reprocessamento so ocorre quando a fila foi criada com
  `--send`.
- `--force-send` fica restrito a casos conferidos manualmente na J&T.

### 8. Interface operacional propria

Substituir o n8n por uma interface web interna que seja a mesa de operacao da
integracao.

Status em 2026-06-03: implementada no MVP inicial em `dashboard/`, com tela
principal em blocos conectados, dashboard, lista/detalhe de pedido,
pendencias, reprocessamento e APIs internas, reaproveitando o Postgres e os
jobs ja existentes.

Atualizacao de 2026-06-03: o dashboard foi redesenhado para exibir 8 blocos
conectados do fluxo, acoes rapidas e formulario de reprocessamento por
filial/pedido. O build do painel foi validado com `npm run ui:build`.

Criterios de aceite:

- existe dashboard com lotes, metricas e pendencias
- existe fluxo visual clicavel do processamento
- um pedido pode ser localizado e inspecionado pela interface
- um pedido pode ser reprocessado em dry-run pela interface
- overrides podem ser criados com auditoria pela interface
- o terminal deixa de ser a ferramenta principal para a operacao diaria

## Fase 2: Piloto controlado

Depois do pacote minimo, rodar piloto antes de liberar o cron definitivo.

Status em 2026-06-08: primeiro envio real em massa executado de forma assistida,
sem cron. Antes do envio foi feito dry-run da janela do dia com `pagesRead=3`,
`ordersRead=161`, `pickupsDryRun=161` e `errors=0`. Em seguida, apos
confirmacao explicita do usuario, foi executado:

```bash
JT_SEND_ENABLED=true DAILY_SEND_LIMIT= npm run sync:daily
```

Resultado:

- `syncRunId=0e684902-6982-4594-a6db-65b96c77dfd9`
- `pagesRead=3`
- `ordersRead=161`
- `pickupsSent=161`
- `pickupsCreated=161`
- `errors=0`
- `pickup_requests`: 161 registros `created`

Proximo passo desta fase: conferir os `billCode` criados com a operacao e com
a J&T antes de transformar o envio real em rotina automatica.

### Piloto em dry-run

Executar por alguns dias comparando com o processo manual.

Status em 2026-06-03: primeiro dry-run real com `VIRTUAL_AGE_ORDER_STATUS_LIST=Attended` executado sem envio para J&T. Antes da trava defensiva local de transportadora, o resultado foi `pagesRead=2`, `ordersRead=158`, `pickupsDryRun=145`, `ordersIgnored=13`, `pickupsSent=0`, `pickupsCreated=0`, `errors=0`. O motivo agregado era `missing-shipping-address`.

Apos conferir que parte do retorno vinha fora do `shippingCompanyCode=88442`, foi adicionada uma trava defensiva local no retorno da TOTVS. O dry-run filtrado por transportadora ficou em `pagesRead=2`, `ordersRead=102`, `pickupsDryRun=102`, `ordersIgnored=0`, `pickupsSent=0`, `pickupsCreated=0`, `errors=0`. As 13 pendencias antigas foram resolvidas como fora de escopo J&T/JET.

Quando o dia atual nao tiver pedidos elegiveis, usar janela historica controlada:

```bash
JT_SEND_ENABLED=false SYNC_START_DATE=2026-05-04 SYNC_END_DATE=2026-06-03 npm run sync:window
```

O `.env` local e o `.env.example` ja usam `VIRTUAL_AGE_ORDER_STATUS_LIST=Attended`.

Validar diariamente:

- pedidos JET/J&T esperados aparecem na consulta
- pedidos de outras transportadoras nao entram
- cada pedido tem endereco, telefone, nota e itens
- payload nao contem campos de COD indevidos
- `txlogisticId` esta correto no formato `branchCode-orderCode`
- valores de nota, itens e peso estao coerentes
- resumo do lote bate com a expectativa operacional

Criterio para avancar:

- pelo menos alguns ciclos de dry-run sem divergencia critica
- divergencias conhecidas documentadas com tratamento definido

### Piloto com envio real limitado

Liberar envio real com limite pequeno.

Status atual: nao iniciar esta fase ate a transportadora confirmar que a
integracao e os dados do dry-run estao corretos.

Sugestao:

- primeiro dia: limite de 5 a 10 pedidos
- validar `billCode` retornado
- conferir pedidos criados na J&T
- comparar com processo manual
- reexecutar a mesma janela para confirmar que nao duplica

Criterio para avancar:

- pedidos criados corretamente na J&T
- nenhuma duplicidade apos reexecucao
- erros registrados de forma clara
- operacao sabe como corrigir/reprocessar pendencias

## Fase 3: Producao assistida

Nesta fase o job pode rodar em producao, mas ainda com acompanhamento proximo.

Recomendacoes:

- rodar todos os dias as `17:00`
- manter responsavel acompanhando o resumo do lote
- revisar erros no mesmo dia
- comparar por alguns dias com pedidos esperados no TOTVS
- manter limite de envio, se a operacao ainda estiver insegura
- remover limite somente depois de estabilidade confirmada

Checklist diario:

- job executou no horario esperado
- janela consultada esta correta
- total de pedidos lidos faz sentido
- total de pedidos enviados faz sentido
- nenhum erro critico ficou sem acao
- nenhum pedido duplicado foi criado
- `billCode` foi gravado para todos os enviados
- pendencias em `operational_issues` foram revisadas
- fila de `reprocess_requests` nao ficou travada em `pending`/`running`

Comando de apoio para a conferencia diaria no Postgres local:

```bash
npm run db:inspect
npm run db:inspect -- --days=1 --limit=20
```

O relatorio consulta `sync_runs`, `pickup_requests` e `integration_errors` usando `DATABASE_URL` ou `POSTGRES_URL` do `.env`. Use antes/depois do lote para conferir status das execucoes, ultimas coletas gravadas e erros recentes.

## Fase 4: Pos-producao e evolucoes

Depois que o envio diario estiver estavel, seguir para funcionalidades de segunda fase.

Backlog recomendado:

- consultar pedido na J&T via `/order/getOrders`
- cancelar pedido na J&T via `/order/cancelOrder`
- imprimir etiqueta via `/order/printOrder`
- consultar rastreio via `/logistics/trace`
- receber callbacks de status/rastreio/peso
- atualizar observacao ou campo logistico no TOTVS com `billCode`
- criar dashboard operacional
- criar relatorio diario de sucesso/erro
- evoluir `npm run db:inspect` para exportacao CSV/JSON ou dashboard quando a operacao pedir mais historico
- adicionar testes automatizados para payload e elegibilidade
- adicionar reprocessamento seletivo por pedido
- adicionar consulta J&T antes de `--force-send`
- evoluir a interface com trilha de auditoria e notificacoes

## Checklist de go/no-go

Usar esta lista antes de liberar envio sem acompanhamento.

Go se:

- banco real esta em uso
- `txlogisticId` tem unicidade garantida
- reexecucao da mesma janela nao duplica pedido
- paginacao TOTVS esta implementada
- logs sensiveis estao mascarados
- timeouts e retries basicos estao ativos
- dry-run foi comparado com operacao real
- piloto com envio limitado foi aprovado
- credenciais de producao estao em variaveis/cofre, fora do Git
- job tem monitoramento ou alerta de falha
- existe procedimento claro para reprocessar erro
- monitoramento operacional esta ativo
- existe caminho operacional claro de acompanhamento, reprocessamento e notificacao
- o lote real assistido de 2026-06-08 foi conferido com a operacao/J&T

No-go se:

- persistencia ainda estiver em memoria
- busca ainda estiver limitada a primeira pagina
- nao houver garantia contra duplicidade
- logs ainda mostrarem dados sensiveis completos
- nao houver visibilidade de erros por pedido
- operacao ainda nao souber validar os pedidos gerados na J&T
- nao houver caminho auditado para corrigir/reprocessar pedidos especificos

## Ordem sugerida de implementacao

1. Conferir o artifact `orders-latest` do dry-run remoto `27223325769` com a operacao.
2. Conferir o lote real de 2026-06-08 com 161 `billCode` criados na J&T.
3. Publicar o painel em Netlify ou Vercel apontando para o Neon.
4. Adicionar autenticacao ou protecao por senha no painel antes de uso operacional.
5. Colocar a interface operacional no fluxo diario de conferencia.
6. Testar o reprocessamento em dry-run pela interface quando surgir pendencia real.
7. Confirmar com a operacao se o proximo envio real sera assistido ou cron definitivo.
8. Se ainda houver inseguranca operacional, manter `JT_SEND_ENABLED=false` no agendamento e usar `Run workflow` manual em dry-run.
9. Para rotina definitiva, manter `JT_SEND_ENABLED=true` nos disparos reais e `DAILY_SEND_LIMIT` vazio/ausente.
10. Para retomar um piloto limitado, cadastrar `DAILY_SEND_LIMIT=N` explicitamente.
11. Ajustar elegibilidade/reprocessamento conforme divergencias do piloto.

## Resultado esperado

Ao final deste plano, a integracao deve conseguir:

- buscar todos os pedidos elegiveis do dia
- criar pedidos/coletas na J&T uma unica vez por pedido
- manter historico e auditoria
- permitir diagnostico de falhas
- permitir reprocessamento controlado
- operar diariamente com baixo risco
