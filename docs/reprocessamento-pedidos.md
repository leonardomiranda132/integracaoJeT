# Reprocessamento e Correcao de Pedidos

Atualizado em: 2026-06-03.

Este documento descreve como inspecionar, corrigir e reprocessar pedidos
especificos sem perder auditoria e sem burlar a idempotencia da integracao.

## Regra atual de seguranca

Em 2026-06-03, o reprocessamento passou a ser liberado apenas para pedido com
pendencia operacional aberta em `operational_issues`.

Isso vale para:

- comando `npm run reprocess:queue`
- API do painel operacional
- botao de reprocessamento na interface
- formulario direto de filial/pedido no dashboard e na tela de reprocessamento

Se o pedido estiver saudavel, o sistema bloqueia a fila com a mensagem:

```text
Reprocessamento so e liberado para pedido com pendencia operacional aberta.
```

## Principio operacional

O reprocessamento produtivo deve usar Postgres como fonte de controle.

Nao usar `npm run send:jt-order` para operacao diaria ou reprocessamento real.
Esse comando e util para teste manual com arquivo JSON, mas nao consulta a
idempotencia duravel nem registra a fila operacional.

Antes de qualquer chamada real para a J&T, o sistema tenta reservar
`pickup_requests.txlogistic_id`. Se ja existir registro local para o mesmo
`txlogisticId`, a chamada externa nao e iniciada e a tentativa fica como
`already-created`.

## Fluxo recomendado

1. Inspecionar o pedido.
2. Corrigir o dado na origem, quando possivel.
3. Se a correcao na origem ainda nao estiver disponivel, criar um override
   auditado.
4. Enfileirar reprocessamento em dry-run.
5. Executar a fila.
6. Conferir `monitor:order`.
7. Se o dry-run estiver correto, enfileirar envio real com `--send`.
8. Executar a fila e conferir `billCode`.

## Inspecionar pedido

```bash
npm run monitor:order -- --branch=313 --order=506144
```

O JSON de saida e sanitizado e mostra:

- snapshot atual do pedido
- endereco/itens/notas em formato seguro
- pendencias abertas
- erros recentes
- eventos por pedido
- overrides
- reprocessamentos anteriores

## Criar override de pedido

Use override apenas quando a operacao aceitar uma correcao manual temporaria.
O pedido original salvo em `orders.raw_order` continua preservado.

Exemplo para corrigir endereco de entrega:

```bash
npm run override:order -- --branch=313 --order=506144 --reason="Endereco validado pela operacao" --patch='{"shippingAddress":{"postCode":"00000000","street":"RUA EXEMPLO","streetNumber":"123","neighborhood":"CENTRO","city":"SAO PAULO","state":"SP"}}'
```

Exemplo para corrigir telefone:

```bash
npm run override:order -- --branch=313 --order=506144 --reason="Telefone validado pela operacao" --patch='{"customerPhone":"11999999999","customerMobile":"11999999999"}'
```

Observacoes:

- Apenas um override ativo por pedido e permitido.
- Criar um novo override desativa o override ativo anterior.
- Dados sensiveis aparecem sanitizados nos relatorios.
- A correcao definitiva deve ser feita no TOTVS quando possivel.

## Enfileirar dry-run de reprocessamento

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Validar pedido corrigido"
```

Se ja existir uma solicitacao ativa para o mesmo pedido, a fila bloqueia com:

```text
Ja existe um reprocessamento pendente ou em andamento para este pedido.
```

Executar a fila:

```bash
npm run reprocess:run
npm run reprocess:run -- --limit=10
```

Sem `--send`, o reprocessamento monta e valida payload, mas nao chama a J&T.
A tentativa fica registrada como `dry-run` em `reprocess_attempts`.

## Enfileirar envio real

Depois de conferir o dry-run:

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Enviar pedido corrigido para J&T" --send
```

Executar:

```bash
npm run reprocess:run
```

O job respeita a idempotencia: se ja existir `pickup_requests.txlogistic_id` e
mesmo que `--force-send` tenha sido usado, a reserva local impede nova chamada
externa e a tentativa vira `already-created`.

## Force-send

Usar somente quando a operacao ja conferiu manualmente que a J&T nao tem o
pedido ou quando a J&T orientou a alteracao pelo mesmo `txlogisticId`.

```bash
npm run reprocess:queue -- --branch=313 --order=506144 --reason="Reenvio autorizado apos conferencia J&T" --send --force-send
```

Riscos:

- Nao passa por cima de um `pickup_requests.txlogistic_id` ja existente no banco
  local.
- Ainda pode alterar um pedido existente na J&T se a J&T tiver registro que nao
  existe mais localmente.
- Ainda pode duplicar acao operacional se houver pedido criado na J&T sem
  registro local.
- Sempre consultar/confirmar na J&T antes de forcar.

## Interface operacional

O painel possui dois pontos para reprocessar um pedido especifico:

- dashboard principal
- tela `Reprocessamento`

Nos dois casos, informe filial e numero do pedido. A interface sempre cria
fila em dry-run, nunca envio real direto.

## Quando usar cada comando

- `monitor:order`: entender o estado de um pedido.
- `override:order`: registrar correcao temporaria auditada.
- `reprocess:queue`: criar pedido de reprocessamento.
- `reprocess:run`: processar a fila pendente.
- `db:inspect`: olhar a saude geral do lote.

## Proximos passos

1. Usar o dry-run dos 13 pedidos com `missing-shipping-address` como piloto.
2. Conferir com a operacao se os enderecos devem ser corrigidos no TOTVS.
3. Testar um override em dry-run antes de qualquer envio real.
4. Definir regra para expirar ou revisar overrides ativos.
5. Implementar consulta J&T `/order/getOrders` antes de liberar `--force-send`
   para uso recorrente.
