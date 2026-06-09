# J&T Open Platform

Atualizado em: 2026-06-02.

Este documento consolida o lado da transportadora J&T/JMS para a integracao. A plataforma e uma SPA, entao os contratos abaixo foram extraidos das paginas informadas e dos chunks JavaScript carregados por elas.

## Fontes consultadas

- Criar pedido: https://open.jtjms-br.com/#/apiDoc/orderserve/create
- Consultar pedido: https://open.jtjms-br.com/#/apiDoc/orderserve/query
- Cancelar pedido: https://open.jtjms-br.com/#/apiDoc/orderserve/cancel
- Push de status do pedido: https://open.jtjms-br.com/#/apiDoc/orderserve/statusFeedback
- Custo e prazo: https://open.jtjms-br.com/#/apiDoc/orderserve/comCostAndTime
- Impressao de etiqueta: https://open.jtjms-br.com/#/apiDoc/orderserve/getPrint
- Consulta de rastreio: https://open.jtjms-br.com/#/apiDoc/logistics/query
- Assinatura de rastreio: https://open.jtjms-br.com/#/apiDoc/logistics/subscribe
- Push de rastreio: https://open.jtjms-br.com/#/apiDoc/logistics/statusFeedback
- Push de peso: https://open.jtjms-br.com/#/apiDoc/other/weight
- Assinatura de peso: https://open.jtjms-br.com/#/apiDoc/other/weightSubscribe

## URLs base

| Ambiente | URL |
| --- | --- |
| Teste | `https://demoopenapi.jtjms-br.com/webopenplatformapi/api` |
| Producao | `https://openapi.jtjms-br.com/webopenplatformapi/api` |

Todas as chamadas documentadas usam metodo `POST`.

## Formato da requisicao

A plataforma usa `application/x-www-form-urlencoded;charset=utf-8`.

Headers comuns:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `apiAccount` | Sim | Conta de API da parte integradora na plataforma J&T. |
| `digest` | Sim | Assinatura global da requisicao. |
| `timestamp` | Sim | Timestamp em milissegundos. |

Body comum:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `bizContent` | Sim | String JSON com os parametros de negocio. |

Exemplo estrutural:

```http
POST /webopenplatformapi/api/order/addOrder
Content-Type: application/x-www-form-urlencoded;charset=utf-8
apiAccount: {apiAccount}
digest: {headerDigest}
timestamp: {timestampMillis}

bizContent={...json assinado...}
```

## Assinaturas

Existem dois campos chamados `digest`, com propositos diferentes:

- `digest` global: enviado no header da requisicao.
- `digest` de negocio: enviado dentro do `bizContent` em endpoints de cliente contrato, como criar, consultar e cancelar pedido.

### Digest global

Regra documentada pela plataforma:

```text
digest = Base64(MD5(bizContentJson + privateKey))
```

Observacoes:

- O `apiAccount` e o `privateKey` sao fornecidos pela plataforma.
- O MD5 deve gerar bytes e esses bytes devem ser convertidos para Base64.
- O JSON usado na assinatura precisa ser exatamente a mesma string enviada em `bizContent`.
- Na implementacao, usar serializacao estavel de JSON para evitar assinatura diferente por ordem de campos/espacos.

### Digest de negocio

Para cliente contrato, a J&T fornece `customerCode` e senha do cliente. A regra exibida no help center e:

```text
pwd = uppercase(MD5(plainPassword + "jadada236t2"))
bizDigest = Base64(MD5(customerCode + pwd + privateKey))
```

Esse `bizDigest` e enviado como `digest` dentro do `bizContent`.

## Resposta comum

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `code` | String | `1` indica sucesso. |
| `msg` | String | Mensagem descritiva. |
| `data` | Object/String/List | Dados de negocio, variam por endpoint. |

Codigos comuns vistos na documentacao:

| Codigo | Significado |
| --- | --- |
| `1` | Sucesso |
| `0` | Falha |
| `145003030` | Falha na assinatura dos headers |
| `145003040` | Excecao interna |
| `145003071` | `apiAccount` vazio |
| `145003052` | `digest` vazio |
| `145003053` | `timestamp` vazio |
| `145005000` | Erro de sistema |
| `145003050` | Parametro ilegal |

## Endpoints

| Pagina | Endpoint real | Direcao | Uso no projeto |
| --- | --- | --- | --- |
| `orderserve/create` | `/order/addOrder` | Nossa integracao chama J&T | Criar pedido/coleta/waybill. |
| `orderserve/query` | `/order/getOrders` | Nossa integracao chama J&T | Consultar pedido criado. |
| `orderserve/cancel` | `/order/cancelOrder` | Nossa integracao chama J&T | Cancelar pedido/coleta. |
| `orderserve/statusFeedback` | Callback configurado | J&T chama nossa URL | Receber mudancas de status do pedido. |
| `orderserve/comCostAndTime` | `/spmComCost/getComCostAndTime` | Nossa integracao chama J&T | Cotar frete e prazo antes da criacao. |
| `orderserve/getPrint` | `/order/printOrder` | Nossa integracao chama J&T | Obter etiqueta/arquivo em Base64. |
| `logistics/query` | `/logistics/trace` | Nossa integracao chama J&T | Consultar rastreio. |
| `logistics/subscribe` | `/trace/subscribe` | Nossa integracao chama J&T | Assinar pushes de rastreio. |
| `logistics/statusFeedback` | Callback configurado | J&T chama nossa URL | Receber eventos de rastreio. |
| `other/weight` | Callback configurado | J&T chama nossa URL | Receber peso/dimensoes. |
| `other/weightSubscribe` | `/waybillWeight/subscribe` | Nossa integracao chama J&T | Assinar pushes de peso. |

## Criar pedido/coleta

Endpoint:

```text
POST {baseUrl}/order/addOrder
```

Descricao: clientes contrato podem criar ou alterar pedidos. Segundo a documentacao, se `txlogisticId` ja existir e o pedido ainda nao tiver sido coletado, a API altera o pedido existente.

Campos principais de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `customerCode` | Sim | Codigo do cliente J&T, fornecido pela unidade/contrato. |
| `digest` | Sim | Digest de negocio do cliente. |
| `network` | Nao | Unidade/parceiro de cooperacao, se aplicavel. |
| `txlogisticId` | Sim | Numero do pedido no nosso sistema. Deve ser idempotente. |
| `expressType` | Sim | `standard`, `express`, `EZ` ou `CRD`. |
| `orderType` | Sim | `1` avulso/individual, `2` mensal/contrato. |
| `serviceType` | Sim | `01` coleta porta a porta, `02` entrega na loja, `10` Drop-Off. |
| `deliveryType` | Sim | Documentado como `03` home delivery. |
| `payType` | Nao | Ex.: `PP_PM` remetente mensal, `CC_CASH` destinatario a vista. |
| `sender` | Sim | Dados do remetente/origem. |
| `receiver` | Sim | Dados do destinatario. |
| `translate` | Nao | Dados de coleta quando `serviceType = 02`, conforme descricao da plataforma. |
| `sendStartTime` | Nao | Inicio da janela de coleta. |
| `sendEndTime` | Nao | Fim da janela de coleta. |
| `goodsType` | Sim | Tipo de item. Ver tabela de tipos. |
| `weight` | Sim | Peso em kg, faixa documentada `0.01` a `30`. |
| `length`, `width`, `height` | Nao | Dimensoes em cm. |
| `totalQuantity` | Nao | Quantidade de volumes/pecas. |
| `itemsValue` | Nao | Valor de COD quando aplicavel. |
| `offerFee` | Nao | Valor declarado/segurado. |
| `remark` | Nao | Observacao, ate 200 caracteres. |
| `items` | Nao | Lista/dados de mercadorias. |
| `invoiceNumber` | Nao | Numero/chave da nota, conforme tipo fiscal. |
| `invoiceSerialNumber` | Nao | Serie da nota. |
| `invoiceMoney` | Nao | Valor da nota em BRL. |
| `taxCode` | Nao | Documento fiscal/tributario. |
| `invoiceAccessKey` | Nao | Chave de acesso da NF-e/DC-e. |
| `invoiceType` | Sim | Tipo fiscal: `NFe`, `CTe`, `NFSe`. |
| `docType` | Nao | `0` NFE, `20` DCe. Se ausente, assume NFE. |

Campos de `sender`, `receiver` e `translate`:

| Campo | Sender | Receiver | Translate | Observacao |
| --- | --- | --- | --- | --- |
| `name` | Sim | Sim | Sim | Nome. |
| `company` | Nao | Nao | Nao | Empresa. |
| `postCode` | Sim | Sim | Sim | CEP com 8 digitos. |
| `mailBox` | Nao | Nao | Nao | Email. |
| `taxNumber` | Sim | Nao | Nao | Documento fiscal; no receiver e opcional. |
| `mobile` | Sim | Sim | Nao | Celular. |
| `phone` | Sim | Sim | Nao | Telefone. |
| `prov` | Sim | Sim | Sim | Estado/UF. |
| `city` | Sim | Sim | Sim | Cidade. |
| `area` | Sim | Sim | Sim | Bairro/regiao. |
| `street` | Sim | Sim | Sim | Rua. |
| `streetNumber` | Sim | Sim | Sim | Numero. |
| `address` | Sim | Sim | Sim | Endereco completo. |
| `areaCode` | Nao | Nao | Nao | DDD/codigo de area. |
| `ieNumber` | Sim | Nao | Sim | Inscricao estadual quando aplicavel. |
| `longitude`, `latitude` | Nao | Nao | Nao | Coordenadas, recomendado ate 6 casas. |

Resposta relevante:

- `data.lastCenterName`
- `data.sortingCode`
- `data.createOrderTime`
- `data.sumFreight`
- `data.orderList[].txlogisticId`
- `data.orderList[].billCode`

Salvar sempre `billCode`, pois ele vira a chave de etiqueta, rastreio, cancelamento por waybill e assinatura de eventos.

## Consultar pedido

Endpoint:

```text
POST {baseUrl}/order/getOrders
```

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `customerCode` | Sim | Codigo do cliente J&T. |
| `digest` | Sim | Digest de negocio. |
| `command` | Sim | Comando de consulta. |
| `serialNumber` | Nao | Lista de identificadores. Exemplo usa `txlogisticId`. |
| `startDate`, `endDate` | Nao | Janela de consulta. |
| `status` | Nao | Status do pedido. |
| `current`, `size` | Nao | Obrigatorios quando `command = 3`. |
| `invoiceNumber` | Nao | Consulta por nota. |
| `packingNumber` | Nao | Consulta por packing number. |

Status de pedido documentados:

| Codigo | Significado |
| --- | --- |
| `100` | Ainda nao despachado |
| `101` | Unidade despachou |
| `102` | Operador/entregador foi despachado |
| `103` | Coletado |
| `104` | Cancelado |

Resposta traz dados semelhantes ao pedido criado, incluindo `orderNumber`, `txlogisticId`, `billCode`, `orderStatus`, `sortingCode`, `sumFreight`, `sender`, `receiver`, dimensoes, peso, itens e `createOrderTime`.

## Cancelar pedido

Endpoint:

```text
POST {baseUrl}/order/cancelOrder
```

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `customerCode` | Nao | Obrigatorio quando `orderType = 2`. |
| `digest` | Nao | Digest de negocio; usado para cliente contrato. |
| `orderType` | Sim | `1` avulso, `2` contrato. |
| `txlogisticId` | Sim | Numero do pedido do cliente/sistema. |
| `reason` | Sim | Motivo do cancelamento. |

Resposta: `data.billCode` e `data.txlogisticId`.

## Custo e prazo

Endpoint:

```text
POST {baseUrl}/spmComCost/getComCostAndTime
```

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `customerCode` | Sim | Codigo do cliente J&T. |
| `digest` | Sim | Digest de negocio. |
| `destinationZipCode` | Sim | CEP destino. |
| `originZipCode` | Nao | CEP origem. |
| `productTypeCode` | Sim | `standard`, `express`, `EZ`, `CRD`. |
| `weight` | Sim | Peso positivo em kg. Se vazio, a doc indica default `0.02`. |
| `insuredAmount` | Nao | Valor da mercadoria/seguro. |
| `goodsTypeCode` | Nao | Tipo de item. |
| `serviceMethodCode` | Nao | `01` coleta porta a porta, `02` entrega na loja. |
| `smMode` | Nao | Modo de liquidacao: `1`, `2`, `3`. |
| `quoteType` | Nao | `0` comum, `1` mesma cidade, `2` mesmo estado. |

Resposta:

- `data.cost`
- `data.riskPremiumFee`
- `data.riskPremiumWaybillFee`
- `data.aging`

## Impressao de etiqueta

Endpoint:

```text
POST {baseUrl}/order/printOrder
```

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `customerCode` | Sim | Codigo do cliente J&T. |
| `digest` | Sim | Digest de negocio. |
| `billCode` | Sim | Numero da waybill. |
| `printSize` | Nao | `0` folha simples, `1` duas paginas, `2` A4. |

Resposta:

- `data.billCode`
- `data.base64EncodeContent`

O conteudo Base64 deve ser decodificado para gerar o arquivo da etiqueta.

## Consultar rastreio

Endpoint:

```text
POST {baseUrl}/logistics/trace
```

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `command` | Nao | Se vazio/ausente, usa `billCodes`. `0` = `billCodes`, `1` = `invoiceAccessKey`, `2` = `customerOrderNumber`. |
| `billCodes` | Nao | Waybills separadas por virgula. |
| `invoiceAccessKey` | Nao | Chaves fiscais separadas por virgula. |
| `customerOrderNumber` | Nao | Numeros de pedido separados por virgula. |

Resposta por item:

- `billCode`
- `invoiceAccessKey`
- `customerOrderNumber`
- `details[]`

Campos de `details[]`:

- `scanTime`, `desc`, `scanType`, `scanCode`, `problemType`
- `scanNetworkName`, `scanNetworkId`, `scanNetworkContact`
- `scanNetworkProvince`, `scanNetworkCity`, `scanNetworkArea`
- `staffName`, `staffContact`
- `nextStopName`, `nextNetworkProvinceName`, `nextNetworkCityName`, `nextNetworkAreaName`
- `staffLng`, `staffLat`
- `signer`, `signName`, `signatureUrl`, `sigPicUrl`

A documentacao exibe erros para waybill invalida e quantidade acima de 30.

## Assinar rastreio

Endpoint:

```text
POST {baseUrl}/trace/subscribe
```

Descricao: assina eventos de rastreio para waybills. A propria pagina informa que e necessario fornecer uma URL de retorno para receber o push.

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `id` / `Id` | Sim | A tabela mostra `Id`, o exemplo usa `id`. Confirmar em homologacao. |
| `list` | Sim | Lista de waybills e nos. |
| `list[].traceNode` | Sim | Nos assinados, separados por `&`. |
| `list[].waybillCode` | Sim | Numero da waybill J&T. |

Nos documentados:

| No | Evento |
| --- | --- |
| `1` | Coleta/recebimento de remessa |
| `2` | Scan de entrada em estoque, indicado como desabilitado |
| `3` | Scan de saida |
| `4` | Scan de entrada |
| `5` | Scan outbound |
| `10` | Entrega |
| `11` | Problema |
| `12` | Retorno |
| `13` | Chegada em centro |
| `16` | Recebimento de item outbound |

## Push de status do pedido

Pagina: `orderserve/statusFeedback`.

Este contrato e para callback: a J&T chama a URL configurada por nos quando o status do pedido muda.

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `txlogisticId` | Sim | Pedido do cliente/sistema. |
| `billCode` | Nao | Waybill. |
| `networkName` | Nao | Nome da unidade. |
| `pickStaffName` | Nao | Nome do operador/coletador. |
| `pickStaffPhone` | Nao | Telefone do operador/coletador. |
| `jtOrderId` | Sim | ID do pedido J&T. |
| `Weight` | Nao | Peso. A doc usa `Weight` com inicial maiuscula. |
| `reason` | Nao | Motivo. |
| `scanType` | Sim | Descricao do status. |
| `time` | Sim | Data/hora do evento. |
| `carrierCode` | Sim | Codigo da transportadora/parceiro. |

Nossa URL deve responder no formato comum com `code`, `msg` e `data`.

## Push de rastreio

Pagina: `logistics/statusFeedback`.

Este contrato e para callback: a J&T chama a URL configurada quando eventos de rastreio ocorrem.

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `billCode` | Sim | Waybill. |
| `txlogisticId` | Nao | Pedido do cliente/sistema. |
| `details` | Sim | Lista de eventos de rastreio. |

`details[]` usa praticamente os mesmos campos de `/logistics/trace`: `scanTime`, `desc`, `scanType`, `scanCode`, dados de rede/unidade, operador, proxima parada, coordenadas e dados de assinatura.

## Push e assinatura de peso

### Push de peso

Pagina: `other/weight`.

Este contrato e para callback: a J&T chama a URL configurada quando peso/dimensoes mudam.

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `billCode` | Sim | Waybill. |
| `length` | Nao | Comprimento em cm. |
| `width` | Nao | Largura em cm. |
| `height` | Nao | Altura em cm. |
| `packageInsideChargeWeight` | Nao | Peso cobrado. |

### Assinar peso

Endpoint:

```text
POST {baseUrl}/waybillWeight/subscribe
```

Campos de `bizContent`:

| Campo | Obrigatorio | Observacao |
| --- | --- | --- |
| `waybillCodes` | Sim | Lista de waybills. A descricao fala em lote maximo de 30. |

## Tipos uteis

### Tipo de item (`goodsType` / `goodsTypeCode`)

| Codigo | Significado |
| --- | --- |
| `bm000001` | Documento |
| `bm000002` | Produtos digitais |
| `bm000003` | Uso diario |
| `bm000004` | Alimento |
| `bm000005` | Vestuario |
| `bm000006` | Outros |
| `bm000007` | Frescos/pereciveis |
| `bm000008` | Fragil |
| `bm000009` | Liquido |

### Tipo fiscal

| Campo | Valores |
| --- | --- |
| `invoiceType` | `NFe`, `CTe`, `NFSe` |
| `docType` | `0` NFE, `20` DCe |

Regras fiscais anotadas:

- Se `docType` nao for informado, a plataforma considera NFE.
- Para NFE, validar `invoiceNumber`, `invoiceSerialNumber`, `invoiceMoney`, `invoiceAccessKey` e `taxCode`.
- Para DCe, validar `invoiceAccessKey`, `invoiceMoney` e `invoiceIssueDate`.

## Mapeamento inicial Virtual Age -> J&T

| Dado | Virtual Age/TOTVS Moda | J&T |
| --- | --- | --- |
| Pedido idempotente | `orderId` ou `branchCode` + `orderCode` | `txlogisticId` |
| Nota/chave fiscal | `invoices` ou `/invoices` | `invoiceNumber`, `invoiceSerialNumber`, `invoiceMoney`, `invoiceAccessKey`, `taxCode` |
| Destinatario | `customerName`, `customerCpfCnpj`, `shippingAddress` | `receiver` |
| Origem/remetente | Configuracao da filial/empresa | `sender` |
| Peso | `weight` quando houver ou regra calculada | `weight` |
| Volumes | `packageNumber`/quantidade | `totalQuantity` |
| Valor declarado | `netValue` ou `totalAmountOrder` | `offerFee` ou campos fiscais, conforme regra |
| Servico | Regra operacional | `serviceType`, `deliveryType`, `expressType` |
| Tipo de item | Regra por produto/pedido | `goodsType` |
| Observacao | Observacoes/log de integracao | `remark` |
| Retorno da criacao | Nao existe antes da criacao | `billCode`, `sortingCode`, `createOrderTime` |

## Estrategia recomendada para a integracao

1. Buscar pedido no Virtual Age.
2. Validar que o pedido ainda nao tem coleta J&T criada.
3. Montar `txlogisticId` idempotente.
4. Montar `sender` por configuracao da filial.
5. Montar `receiver` a partir de `shippingAddress`.
6. Validar CEP, telefone, documento, peso e nota fiscal.
7. Calcular `digest` de negocio.
8. Serializar `bizContent` de forma estavel.
9. Calcular `digest` global.
10. Chamar `/order/addOrder`.
11. Persistir `billCode`, `sortingCode`, payload e resposta.
12. Opcionalmente assinar rastreio e peso.
13. Opcionalmente buscar etiqueta por `/order/printOrder`.
14. Receber callbacks de status/rastreio/peso e atualizar o status local.

## Pendencias

- Confirmar credenciais: `apiAccount`, `privateKey`, `customerCode`, senha do cliente e ambiente.
- Confirmar se a operacao usa `orderType = 2` e `payType = PP_PM`.
- Confirmar `expressType`, `serviceType` e `deliveryType` corretos para coleta.
- Confirmar se a J&T exige todos os campos fiscais no Brasil para o nosso contrato.
- Confirmar URL publica para receber callbacks de status, rastreio e peso.
- Testar sensibilidade de maiusculas/minusculas em `Id`/`id` e `Weight`/`weight`.
- Definir se vamos consultar rastreio por polling, assinatura de push ou ambos.

