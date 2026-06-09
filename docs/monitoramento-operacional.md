# Monitoramento Operacional

Atualizado em: 2026-06-03.

Este documento descreve o monitoramento operacional da integracao TOTVS Moda x
J&T, incluindo tabelas criadas, eventos gravados pelo lote, comandos de
inspecao e como usar o relatorio diario.

Observacao de ambiente local:

- em 2026-06-03, a base local `integracao_jt` foi limpa manualmente a pedido
  do usuario
- a limpeza preservou schema e `schema_migrations`, mantendo 4 migrations
  registradas
- antes da limpeza havia dados em `sync_runs` (2), `orders` (102) e
  `order_processing_events` (204)
- depois da limpeza, as tabelas operacionais ficaram zeradas:
  `sync_runs`, `orders`, `pickup_requests`, `integration_errors`,
  `execution_locks`, `operational_issues`, `order_overrides`,
  `order_processing_events`, `reprocess_requests` e `reprocess_attempts`
- `npm run db:inspect -- --days=7 --limit=5` foi executado depois da limpeza
  e retornou todas as secoes sem registros
- o proximo dry-run ou sync diario deve repovoar a base do zero

## Objetivo

Dar visibilidade diaria para:

- execucoes do sync
- pedidos lidos e paginas TOTVS lidas
- coletas criadas na J&T
- pedidos ignorados por elegibilidade
- falhas por pedido
- pendencias abertas para acao operacional
- fila de reprocessamento

## O que foi implementado

A migration `004_add_monitoring_and_reprocess.sql` adiciona uma camada
operacional sobre o banco atual.

Tabelas novas:

- `operational_issues`: pendencias abertas/resolvidas por pedido.
- `order_processing_events`: linha do tempo por pedido e por lote.
- `order_overrides`: correcoes manuais auditadas para reprocessamento.
- `reprocess_requests`: fila de pedidos especificos para reprocessar.
- `reprocess_attempts`: historico de tentativas de reprocessamento.

O `sync-orders` agora registra:

- evento `eligibility` quando o pedido e ignorado por falta de dados.
- pendencia em `operational_issues` para cada motivo de inelegibilidade.
- evento `idempotency` quando o pedido ja tem coleta criada.
- evento `pickup-dry-run` quando o payload foi validado sem envio.
- evento `pickup-created` quando a J&T retornou `billCode`.
- evento e pendencia `processing-error` quando um pedido falha.

Quando um pedido volta a ficar elegivel ou e reprocessado com sucesso, as
pendencias abertas daquele pedido sao marcadas como resolvidas.

Tambem foi entregue uma interface operacional em `Next.js`, conectada ao mesmo
Postgres, para visualizar estas tabelas sem depender do terminal:

- dashboard
- fluxo em blocos conectados
- lista de pedidos
- detalhe com eventos, erros e overrides
- pendencias
- fila de reprocessamento

## Comandos principais

Aplicar as tabelas novas:

```bash
npm run db:migrate
```

Ver resumo operacional geral:

```bash
npm run db:inspect
npm run db:inspect -- --days=1 --limit=20
```

Inspecionar um pedido especifico:

```bash
npm run monitor:order -- --branch=313 --order=506144
```

Exportar os pedidos do ultimo sync bem-sucedido para conferencia:

```bash
npm run monitor:export-orders
npm run monitor:export-orders -- --format=json
```

Por padrao, o CSV sai em:

```text
docs/operational-exports/orders-latest.csv
```

O arquivo nao inclui CPF, telefone ou endereco. Ele foi pensado para conferencia
com a operacao/transportadora enquanto o envio real segue bloqueado.

O comando de pedido mostra, em JSON sanitizado:

- snapshot do pedido salvo em `orders`
- coletas em `pickup_requests`
- pendencias em `operational_issues`
- erros em `integration_errors`
- eventos em `order_processing_events`
- overrides ativos ou antigos
- requisicoes e tentativas de reprocessamento

## Indicadores diarios

Para conferencia no fim do dia, olhar:

- `sync_runs`: ultimo lote finalizou como `succeeded`.
- `pages_read`: volume de paginas lidas foi coerente.
- `orders_read`: total de pedidos bate com expectativa operacional.
- `pickups_created`: coletas criadas no envio real.
- `errors`: deve ser zero ou ter plano de acao.
- `operational_issues`: pendencias abertas precisam ser revisadas.
- `reprocess_requests`: nao deve acumular `pending`/`running` sem motivo.

## Pendencias operacionais

Exemplo ja observado no dry-run de 2026-06-03:

- antes da trava defensiva local de transportadora: `ordersRead=158`,
  `pickupsDryRun=145`, `ordersIgnored=13`
- motivo agregado antigo: `missing-shipping-address`
- depois da trava defensiva local por `shippingCompanyCode=88442`:
  `ordersRead=102`, `pickupsDryRun=102`, `ordersIgnored=0`

As 13 pendencias antigas foram marcadas como resolvidas porque estavam
associadas a pedidos retornados fora do escopo J&T/JET `88442`. O proximo passo
operacional e comparar os 102 pedidos filtrados com a operacao manual.

## Cuidados de seguranca

- Os detalhes gravados nas tabelas operacionais passam por sanitizacao.
- Relatorios nao devem expor CPF, CNPJ, telefone, endereco completo, tokens,
  digests ou chaves privadas.
- `order_overrides` deve ser usado como excecao auditada, nao como substituto
  permanente da correcao no TOTVS.
- Reenvio real precisa ser feito pela fila de reprocessamento, nao pelo job
  manual antigo `send:jt-order`.

## Proximos passos

1. Rodar `npm run db:inspect` depois da limpeza para confirmar a base vazia.
2. Executar novo dry-run com `npm run sync:daily` ou `npm run sync:window` para repovoar a base.
3. Colocar a interface operacional no fluxo diario de conferencia.
4. Comparar os pedidos filtrados do novo lote com a operacao manual/transportadora.
5. Confirmar que a trava defensiva de transportadora deve permanecer mesmo se a API voltar a filtrar corretamente.
6. Definir notificacao para pendencias abertas e erros por pedido.
7. Adicionar autenticacao interna no painel.
