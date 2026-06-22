# Analise de pedidos nao integrados - 2026-06-22

Pedidos informados:

- 507788
- 507713
- 507803
- 508050
- 507713
- 508080
- 507788
- 507992
- 507803

Lista unica analisada: `507713`, `507788`, `507803`, `507992`, `508050`,
`508080`.

## Escopo verificado

- Arquivos locais do projeto e `docs/operational-exports/orders-latest.csv`.
- Postgres local configurado em `.env`: `localhost:5432/integracao_jt`.
- Artifacts `orders-latest` dos GitHub Actions entre 2026-06-09 e
  2026-06-21.
- Logs dos workflows dos dias 2026-06-14, 2026-06-15, 2026-06-16 e
  2026-06-17.
- Consulta direta ao TOTVS por `orderCodeList`.
- Consulta de leitura na J&T por `txlogisticId` no formato `313-<pedido>`.

## Resumo

| Pedido | Encontrado no TOTVS | Encontrado na J&T | Situacao |
| --- | --- | --- | --- |
| `507713` | Sim | Nao | Pedido JET elegivel, mas ficou fora do envio diario. |
| `507788` | Sim | Nao | Pedido JET elegivel, mas ficou fora do envio diario. |
| `507803` | Sim | Nao | Pedido JET elegivel, mas ficou fora do envio diario. |
| `507992` | Sim | Nao | Pedido esta como JAD `2522` e sem endereco completo; nao deve entrar no fluxo JET atual. |
| `508050` | Sim | Sim | Integrado em 2026-06-17, `billCode=888030775309675`. |
| `508080` | Sim | Sim | Integrado em 2026-06-17, `billCode=888030777978262`. |

## Evidencias por pedido

### 507713

- TOTVS: filial `313`, status `Attended`, transportadora `88442` / JET,
  financeiro processado, nota `334642`, itens presentes e endereco completo.
- Janela em que o TOTVS devolveu o pedido: `2026-06-15T17:01:22-03:00`.
- J&T: sem registro para `txlogisticId=313-507713`.
- Diagnostico: o pedido ficou 1 minuto e 22 segundos depois do corte diario
  `17:00`, por isso nao entrou no workflow diario.

### 507788

- TOTVS: filial `313`, status `Attended`, transportadora `88442` / JET,
  financeiro processado, nota `334641`, itens presentes e endereco completo.
- Janela em que o TOTVS devolveu o pedido: `2026-06-15T17:00:42-03:00`.
- J&T: sem registro para `txlogisticId=313-507788`.
- Diagnostico: o pedido ficou 42 segundos depois do corte diario `17:00`.

### 507803

- TOTVS: filial `313`, status `Attended`, transportadora `88442` / JET,
  financeiro processado, nota `334643`, itens presentes e endereco completo.
- Janela em que o TOTVS devolveu o pedido: `2026-06-15T17:08:03-03:00`.
- J&T: sem registro para `txlogisticId=313-507803`.
- Diagnostico: o pedido ficou depois do corte diario `17:00`.

### 507992

- TOTVS: filial `313`, status `Attended`, financeiro processado, nota
  `334801`.
- Transportadora retornada pelo TOTVS: `2522` / JAD LOGISTICA E TAXI AEREO
  LTDA.
- Endereco de entrega: ausente/incompleto no retorno consultado.
- J&T: sem registro para `txlogisticId=313-507992`.
- Diagnostico: nao e erro do fluxo JET. O filtro defensivo local descarta
  pedidos que nao retornam `shippingCompanyCode=88442`, e este pedido tambem
  falharia por `missing-shipping-address`.

### 508050

- TOTVS: filial `313`, status `Attended`, transportadora `88442` / JET,
  financeiro processado, nota `334960`, itens presentes e endereco completo.
- GitHub Actions: artifact de 2026-06-17 registrou `pickup-created` para
  `313-508050`.
- J&T: consulta por `txlogisticId=313-508050` retornou
  `billCode=888030775309675`, status J&T `101`, criado em
  `2026-06-17T17:48:05`.
- Diagnostico: integrado; nao reenviar.

### 508080

- TOTVS: filial `313`, status `Attended`, transportadora `88442` / JET,
  financeiro processado, nota `334980`, itens presentes e endereco completo.
- GitHub Actions: artifact de 2026-06-17 registrou `pickup-created` para
  `313-508080`.
- J&T: consulta por `txlogisticId=313-508080` retornou
  `billCode=888030777978262`, status J&T `101`, criado em
  `2026-06-17T17:48:35`.
- Diagnostico: integrado; nao reenviar.

## Observacoes operacionais

- O banco local nao contem esses pedidos porque esta configurado para
  `localhost:5432/integracao_jt` e o ultimo dado local salvo vai ate o pedido
  `506743`, com ultimo sync em 2026-06-08.
- O workflow remoto roda diariamente com janela `00:00` ate `17:00`
  (`src/app/scheduler/daily-window.ts`).
- Uma janela customizada `2026-06-15T17:00:00-03:00` ate
  `2026-06-15T23:59:59-03:00` retorna 34 pedidos JET apos filtro local, nao
  apenas os tres pedidos faltantes. Portanto, rodar essa janela em envio real
  sem limite ou sem filtro por pedido pode criar outras coletas alem das
  solicitadas.
- Correcao aplicada em 2026-06-22: a janela diaria passou a cobrir o corte
  anterior `17:00` ate o corte atual `17:00`, eliminando o intervalo
  descoberto depois das 17h.
- Correcao aplicada em 2026-06-22: foi criado o comando `npm run sync:orders`
  para sincronizar apenas pedidos informados em `SYNC_ORDER_CODES` ou
  `--orders=...`, sem depender de uma janela ampla.

## Proximos passos

1. Nao reenviar `508050` e `508080`; ambos ja existem na J&T com `billCode`.
2. Tratar `507992` fora do fluxo JET, a menos que a operacao corrija no TOTVS
   a transportadora para `88442` e complete o endereco.
3. Para `507713`, `507788` e `507803`, usar o workflow com
   `order_codes=507713,507788,507803` e `send_enabled=true` para corrigir os
   pedidos ja identificados sem enviar outros pedidos da mesma janela.
4. Acompanhar a proxima execucao diaria para confirmar que a janela
   `17:00-17:00` esta capturando pedidos alterados apos o corte anterior.
5. Registrar no painel/relatorio uma secao de "pedidos encontrados no TOTVS,
   mas fora da janela diaria" para facilitar este diagnostico no futuro.
