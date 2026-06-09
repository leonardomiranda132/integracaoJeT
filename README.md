# Integracao J&T x Virtual Age

Documentacao viva do projeto de integracao entre a transportadora J&T e o Virtual Age/TOTVS Moda.

O objetivo inicial e consultar pedidos no TOTVS Moda, identificar os pedidos aptos para coleta e gerar o pedido de coleta na J&T, mantendo rastreabilidade e idempotencia entre os dois lados.

## Arquitetura inicial

Foi criada uma base `Node.js + TypeScript` pensada para um processamento em lote diario, disparado 1 vez por dia as 17:00.
O objetivo operacional atual e enviar para a J&T os pedidos faturados no mesmo dia ate o fechamento do CD, que ocorre por volta das 16:30.

### Fluxo principal

```text
scheduler/cron
  -> run-daily-pickup-sync
  -> searchOrders no TOTVS para pedidos faturados do dia ate 17:00
  -> filtros de elegibilidade
  -> normalizacao do pedido
  -> validacao do payload
  -> dry-run operacional ou addOrder na J&T
  -> persistencia de runs, pedidos, coletas, locks e erros
  -> resumo operacional em logs e Postgres
```

### Estrutura de pastas

```text
src/
  app/
    jobs/
    scheduler/
  application/
    use-cases/
  config/
  domain/
    errors/
    models/
    services/
    validators/
  infrastructure/
    http/
    logging/
    persistence/
```

## Como executar

1. Instale dependencias:

```bash
npm install
```

2. Configure as variaveis:

```bash
cp .env.example .env
```

3. Rode a verificacao de tipos:

```bash
npm run check
```

4. Se for usar Postgres, aplique as migrations:

```bash
npm run db:migrate
```

5. Execute o job manualmente:

```bash
npm run sync:daily
```

Para piloto em uma janela historica controlada:

```bash
JT_SEND_ENABLED=false SYNC_START_DATE=2026-05-04 SYNC_END_DATE=2026-06-03 npm run sync:window
```

6. Consulte o resumo operacional no Postgres local:

```bash
npm run db:inspect
```

### Dry-run e limite diario

Por padrao, o job envia pedidos aptos para a J&T. Para validar o lote sem chamar
`addOrder`, use:

```text
JT_SEND_ENABLED=false
```

Compatibilidade: se `JT_SEND_ENABLED` nao estiver definido,
`INTEGRATION_DRY_RUN=true` tambem desativa o envio.

Para piloto controlado com envio real, limite a quantidade por execucao:

```text
JT_SEND_ENABLED=true
DAILY_SEND_LIMIT=10
```

O resumo do sync registra pedidos lidos, ignorados, validados em dry-run,
enviados e erros. `DAILY_SEND_LIMIT=0` bloqueia envios reais; com
`JT_SEND_ENABLED=false`, o limite e ignorado e o dry-run valida todos os pedidos
aptos.

## Agendamento das 17:00

O projeto foi estruturado para ser acionado por um scheduler externo. O cron esperado esta em `.env` como:

```text
DAILY_SYNC_CRON=0 17 * * *
```

Exemplo em `crontab`:

```cron
0 17 * * * cd /caminho/do/projeto && /usr/bin/env npm run sync:daily
```

Em producao, o ideal e disparar esse comando por um orquestrador confiavel, como cron do servidor, GitHub Actions agendado, ECS Scheduled Task, Cloud Run Job ou equivalente.

### Hospedagem gratuita recomendada

Para rodar sem custo fixo inicial:

```text
GitHub Actions -> sync diario
Neon Postgres -> banco duravel
Netlify ou Vercel -> painel operacional
```

O workflow diario ja foi criado em
[.github/workflows/sync-diario-jt.yml](/Users/leonardomiranda/Documents/IntergracaoJ&T/.github/workflows/sync-diario-jt.yml:1).

O passo a passo de secrets, variables, Neon e painel esta em
[docs/hospedagem-gratuita.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/hospedagem-gratuita.md:1).

## Persistencia

A persistencia pode rodar em memoria ou Postgres, controlada por `PERSISTENCE_ADAPTER`.

Modo em memoria:

```text
PERSISTENCE_ADAPTER=memory
```

Modo Postgres:

```text
PERSISTENCE_ADAPTER=postgres
DATABASE_URL=postgres://usuario:senha@host:5432/integracao_jt
```

Antes de executar o job com Postgres, rode:

```bash
npm run db:migrate
```

Para acompanhar execucoes, coletas criadas e erros recentes no terminal:

```bash
npm run db:inspect
npm run db:inspect -- --days=1 --limit=20
```

O comando usa `DATABASE_URL` ou `POSTGRES_URL` do `.env` e consulta as tabelas `sync_runs`, `pickup_requests` e `integration_errors`.

As migrations criam as tabelas:

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

Regras ja cobertas no schema:

- `orders` possui chave unica por `branch_code + order_code`.
- `pickup_requests` possui indice unico por `txlogistic_id`.
- `pickup_requests` registra `bill_code` por `txlogistic_id`.
- `integration_errors` preserva `branch_code`, `order_code` e `txlogistic_id` quando o erro ocorre no processamento de um pedido.
- `execution_locks` impede duas execucoes concorrentes da mesma janela.
- `operational_issues` registra pendencias abertas/resolvidas por pedido.
- `order_processing_events` registra a linha do tempo operacional por pedido.
- `order_overrides` permite correcao temporaria e auditada para reprocessamento.
- `reprocess_requests` e `reprocess_attempts` controlam fila e historico de reprocessamento.

## Monitoramento e reprocessamento

Comandos operacionais:

```bash
npm run db:inspect -- --days=1 --limit=20
npm run monitor:order -- --branch=313 --order=506144
npm run monitor:export-orders
npm run override:order -- --branch=313 --order=506144 --reason="Endereco validado" --patch='{"shippingAddress":{"postCode":"00000000","street":"RUA EXEMPLO","streetNumber":"123","neighborhood":"CENTRO","city":"SAO PAULO","state":"SP"}}'
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Validar pedido corrigido"
npm run reprocess:run -- --limit=5
```

Enquanto a transportadora ainda estiver confirmando a integracao, mantenha
`JT_SEND_ENABLED=false` e use `monitor:export-orders` para gerar o CSV de
conferencia do ultimo lote.

Para envio real de um reprocessamento aprovado:

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Enviar pedido corrigido" --send
npm run reprocess:run
```

`--force-send` existe apenas para casos conferidos manualmente na J&T.

## Interface operacional

A partir de 2026-06-03, o projeto deixou de usar n8n como caminho principal de
operacao. A decisao atual e construir uma interface operacional propria, usando
o mesmo Postgres da integracao e aproveitando os jobs/casos de uso ja
existentes.

Direcao escolhida:

- tela principal com blocos conectados do fluxo
- dashboard de lotes, pedidos, pendencias e reprocessamentos
- detalhe por pedido com motivo de erro, eventos e overrides
- acoes operacionais auditadas para reprocessar e corrigir pedidos especificos

O plano detalhado desta frente esta em
[docs/plano-interface-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/plano-interface-operacional.md:1).

Comandos da interface:

```bash
npm run ui:dev
npm run ui:build
npm run ui:start
```

Documentacao de uso:

- [docs/interface-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/interface-operacional.md:1)

## Resiliencia e seguranca

- O lote usa trava de execucao por janela (`sync-orders:{startDate}:{endDate}`).
- Chamadas HTTP tem timeout default de `30000ms`.
- Chamadas HTTP repetem automaticamente timeout, erro de rede, `429` e `5xx` ate 2 retries.
- Erros externos sao classificados como `external-timeout`, `external-retryable`, `credentials`, `validation` ou `unexpected`.
- Logs e contextos persistidos em `integration_errors` mascaram CPF, CNPJ, telefone, tokens, senhas, chaves privadas, API keys e digests.

No comportamento atual, a consulta foi ajustada para considerar apenas pedidos faturados no proprio dia de execucao, com janela de `00:00:00` ate `17:00:00`. O job roda as `17:00`, cobrindo o fechamento operacional do CD, que acontece por volta das `16:30`.

## Proximos passos recomendados

- Colocar a interface operacional em uso no fluxo diario de conferencia.
- Comparar o painel e a exportacao com a validacao da operacao/transportadora.
- Adicionar autenticacao interna e trilha de auditoria da interface.
- Manter `JT_SEND_ENABLED=false` ate confirmacao final da transportadora.
- Implementar callbacks ou polling de status da J&T em segunda fase.

## Documentos

- [Plano da integracao](docs/plano-integracao.md): fluxo previsto, requisitos, decisoes pendentes e dados que precisamos levantar.
- [Virtual Age/TOTVS Moda](docs/virtual-age-totvs-moda.md): referencia dos endpoints de autorizacao e pedidos de venda extraida da documentacao oficial e do Swagger.
- [TOTVS Moda API V2 - mapa geral](docs/totvs-api-v2-mapa-geral.md): mapa da pagina-mãe da API V2 e leitura dos modulos relevantes para a integracao.
- [TOTVS Moda - Person API](docs/totvs-moda-person.md): referencia da API de pessoa fisica/juridica para consulta e manutencao de clientes.
- [J&T Open Platform](docs/jt-open-platform.md): referencia da API da transportadora para criar pedido/coleta, consultar/cancelar, imprimir etiqueta, rastrear e receber callbacks.
- [Status da implementacao](docs/status-implementacao.md): registro do que ja foi feito no codigo, do que esta parcial e dos proximos passos.
- [Proximos passos para producao](docs/proximos-passos-producao.md): roteiro recomendado para sair da validacao real e entrar em producao com seguranca.
- [Monitoramento operacional](docs/monitoramento-operacional.md): tabelas, eventos, relatorios e rotina diaria de acompanhamento.
- [Reprocessamento de pedidos](docs/reprocessamento-pedidos.md): como inspecionar, corrigir, enfileirar e reprocessar pedidos especificos.
- [Interface operacional](docs/interface-operacional.md): como subir e usar o painel interno em `Next.js`.
- [Plano da interface operacional](docs/plano-interface-operacional.md): arquitetura, telas, API, fases e remocao do n8n.
- [n8n self-hosted](docs/n8n-self-hosted.md): registro historico da alternativa descontinuada.
