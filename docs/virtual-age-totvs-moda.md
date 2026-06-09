# Virtual Age/TOTVS Moda

Atualizado em: 2026-06-02.

Este documento consolida os pontos da API V2 do Virtual Age/TOTVS Moda relevantes para a integracao de pedidos e coleta.

Para a visao da pagina-mãe da API V2 e dos modulos visiveis, ver tambem
[TOTVS Moda API V2 - Mapa Geral](totvs-api-v2-mapa-geral.md).

## Fontes consultadas

- Autorizacao V2: https://tdn.totvs.com/pages/releaseview.action?pageId=532385061
- Swagger Sales Order V2 informado: https://www30.bhan.com.br:9443/api/totvsmoda/sales-order/v2/swagger/index.html
- OpenAPI Sales Order V2: https://www30.bhan.com.br:9443/api/totvsmoda/sales-order/v2/swagger/v1/swagger.json
- Hub de Integracao TOTVS Moda: https://tdn.totvs.com/pages/viewpage.action?pageId=631331541
- Swagger publico Hub TOTVS Moda: https://moda.api.varejo.totvs.com.br/

## Ambientes e URLs

| Uso | URL |
| --- | --- |
| Token no ambiente informado | `POST https://www30.bhan.com.br:9443/api/totvsmoda/authorization/v2/token` |
| Swagger de autorizacao | `https://www30.bhan.com.br:9443/api/totvsmoda/authorization/v2/swagger/index.html` |
| Swagger de pedidos | `https://www30.bhan.com.br:9443/api/totvsmoda/sales-order/v2/swagger/index.html` |
| Hub producao | `https://moda.api.varejo.totvs.com.br` |
| Hub treino | `https://moda.api.varejo.totvs.com.br/treino` |

Observacao: o host `www30.bhan.com.br:9443` aparece nas documentacoes antigas/especificas do Virtual Age. O Hub TOTVS Moda tambem publica os mesmos endpoints via `moda.api.varejo.totvs.com.br`. O ambiente real do cliente precisa ser confirmado antes da implementacao.

## Autenticacao

Endpoint:

```http
POST /api/totvsmoda/authorization/v2/token
Content-Type: application/x-www-form-urlencoded
```

Campos do body:

| Campo | Uso |
| --- | --- |
| `grant_type` | `password` para gravacao com usuario; `client_credentials` para consulta; `refresh_token` para renovar token. |
| `client_id` | Identificador/login de acesso do ambiente. |
| `client_secret` | Senha/chave secreta do ambiente. |
| `username` | Login do usuario no TOTVS Moda. Obrigatorio no grant `password`. |
| `password` | Senha do usuario no TOTVS Moda. Obrigatorio no grant `password`. |
| `branch` | Empresa do usuario. Opcional/validada conforme liberacao do usuario. |
| `refresh_token` | Usado apenas no grant `refresh_token`. |

Resposta esperada:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "..."
}
```

Headers para chamadas autenticadas:

```http
Authorization: Bearer {access_token}
x-api-key: {api_key}
```

Notas importantes:

- O Swagger especifico de Sales Order declara o header `Authorization` com esquema Bearer.
- O Swagger do Hub/API Gateway declara `x-api-key`.
- A pagina do Hub TOTVS Moda informa que `x-api-key` e obrigatorio nas requisicoes.
- O usuario do grant `password` deve estar liberado no Virtual Age e ter empresas relacionadas no componente `ADMFM026`.

## Endpoints de Sales Order V2

OpenAPI consultado: `API Sales Order`, versao `2.8.29`.

| Metodo | Endpoint | Finalidade | Uso provavel no projeto |
| --- | --- | --- | --- |
| `POST` | `/api/totvsmoda/sales-order/v2/orders/search` | Obter lista de pedidos por filtro geral. | Principal endpoint para buscar pedidos. |
| `GET` | `/api/totvsmoda/sales-order/v2/pending-items` | Obter itens pendentes de um pedido. | Confirmar saldo/quantidade a coletar. |
| `GET` | `/api/totvsmoda/sales-order/v2/invoices` | Listar notas fiscais vinculadas ao pedido. | Usar quando a coleta exigir NF ou chave fiscal. |
| `POST` | `/api/totvsmoda/sales-order/v2/shipping-order` | Alterar dados de transporte do pedido. | Possivel atualizacao apos escolha/criacao da coleta. |
| `POST` | `/api/totvsmoda/sales-order/v2/observations-order` | Incluir observacoes em pedido. | Registrar protocolo de coleta, se permitido pelo processo. |
| `POST` | `/api/totvsmoda/sales-order/v2/additional-order` | Alterar dados adicionais do pedido. | Avaliar apenas se houver campo de controle util. |
| `POST` | `/api/totvsmoda/sales-order/v2/orders/change-status` | Alterar situacao do pedido. | Usar com cuidado, depende da regra operacional. |
| `POST` | `/api/totvsmoda/sales-order/v2/b2c-orders` | Incluir pedido de venda. | Mais util se precisarmos criar pedido no Virtual Age. |
| `POST` | `/api/totvsmoda/sales-order/v2/orders/cancel` | Cancelar pedido de venda. | Fora do fluxo inicial. |
| `GET` | `/api/totvsmoda/sales-order/v2/billing-suggestions` | Consultar sugestao de faturamento. | Possivel apoio para pedido parcialmente atendido. |
| `GET` | `/api/totvsmoda/sales-order/v2/discount-type` | Consultar tipos de desconto. | Fora do fluxo de coleta. |

## Consulta de pedidos

Endpoint:

```http
POST /api/totvsmoda/sales-order/v2/orders/search
Content-Type: application/json
Authorization: Bearer {access_token}
x-api-key: {api_key}
```

Modelo de entrada: `OrderSearchInDto`.

Campos principais:

| Campo | Observacao |
| --- | --- |
| `filter` | Obrigatorio. Modelo `OrderFilterModel`. |
| `filter.branchCodeList` | Obrigatorio. Lista de empresas. Limite informado no Swagger: 900 itens. |
| `filter.change.startDate` / `filter.change.endDate` | Janela de alteracao. Deve ser a base do sincronismo incremental. |
| `filter.startOrderDate` / `filter.endOrderDate` | Janela por data do pedido. |
| `filter.orderCodeList` | Lista de numeros de pedido. |
| `filter.orderIdList` | Lista de identificadores unicos do pedido. |
| `filter.customerOrderCodeList` | Numero de pedido do cliente. |
| `filter.integrationCodeList` | Codigo de integracao com terceiros. |
| `filter.customerCodeList` / `filter.customerCpfCnpjList` | Filtro por cliente. Nao usar os dois juntos. |
| `filter.representativeCodeList` / `filter.representativeCpfCnpjList` | Filtro por representante. Nao usar os dois juntos. |
| `filter.orderStatusList` | Situacoes do pedido. |
| `filter.operationCodeList` | Operacoes do Virtual Age. |
| `filter.hasShippingCompany` | Filtra pedidos com/sem transportadora. |
| `filter.hasPdvTransaction` | Indica pedidos faturados pelo TOTVS Moda PDV. |
| `filter.hasFinancialProcessed` | Indica pedidos aceitos pelo TOTVS Moda. |
| `expand` | Grupos extras: `items`, `invoices`, `shippingAddress`, `observations`, `invoiceObservations`, `representativeObservations`, `classifications`, `discounts`, `commissioneds`, `counts`. |
| `order` | Ordenacao, por exemplo `branchCode,orderCode,maxChangeFilterDate`. |
| `page` | Pagina inicial e 1. |
| `pageSize` | Padrao 100. Maximo 500. |

Configuracoes no projeto:

| Variavel | Uso |
| --- | --- |
| `VIRTUAL_AGE_ORDER_PAGE_SIZE` / `TOTVS_ORDER_PAGE_SIZE` | Quantidade de pedidos por pagina. |
| `VIRTUAL_AGE_ORDER_MAX_PAGES` / `TOTVS_ORDER_MAX_PAGES` | Limite maximo de paginas por execucao para evitar loop operacional. |

Exemplo inicial para sincronismo:

```json
{
  "filter": {
    "branchCodeList": [1],
    "change": {
      "startDate": "2026-06-02T00:00:00-03:00",
      "endDate": "2026-06-02T23:59:59-03:00"
    },
    "orderStatusList": ["Attended"],
    "hasShippingCompany": true
  },
  "expand": "items,invoices,shippingAddress",
  "order": "branchCode,orderCode,maxChangeFilterDate",
  "page": 1,
  "pageSize": 100
}
```

Resposta: `OrderSearchOutDto`.

Campos relevantes em cada pedido (`OrderDataModel`):

- Identificacao: `branchCode`, `orderCode`, `orderId`, `customerOrderCode`, `integrationCode`.
- Datas: `insertDate`, `orderDate`, `maxChangeFilterDate`, `arrivalDate`, `billingForecastDate`.
- Cliente: `customerCode`, `customerCpfCnpj`, `customerName`.
- Representante: `representativeCode`, `representativeCpfCnpj`, `representativeName`.
- Operacao e pagamento: `operationCode`, `operationName`, `paymentConditionCode`, `paymentConditionName`.
- Valores: `quantity`, `grossValue`, `discountValue`, `netValue`, `totalAmountOrder`.
- Transporte: `freightType`, `freightValue`, `shippingCompanyCode`, `shippingCompanyCpfCnpj`, `shippingCompanyName`, `shippingService`, `shippingServiceName`.
- Status: `statusOrder`, `hasPdvTransaction`, `hasFinancialProcessed`.
- Expansoes: `items`, `invoices`, `shippingAddress`, `observations`, `invoiceObservations`.

## Itens pendentes

Endpoint:

```http
GET /api/totvsmoda/sales-order/v2/pending-items
```

Parametros:

| Parametro | Regra |
| --- | --- |
| `OrderId` | Identificador unico. Nao informar junto com `BranchCode` + `OrderCode`. |
| `BranchCode` | Empresa. Obrigatorio quando `OrderCode` for usado. |
| `OrderCode` | Numero do pedido. Obrigatorio quando `BranchCode` for usado. |
| `MaxChangeFilterDate` | Data/hora de alteracao, opcional. |

Resposta: `OrderPendingItemOutDto`.

Campos de item (`PendingItemDataModel`):

- `productCode`, `productSku`, `name`.
- `referenceCode`, `referenceName`.
- `colorCode`, `colorName`, `sizeName`.
- `quantity`, `pendingQuantity`.
- `originalPrice`, `grossPrice`, `itemDiscount`, `orderDiscount`, `netPrice`.

Uso no projeto: se o pedido estiver parcialmente atendido, preferir `pendingQuantity` para calcular o que ainda precisa entrar na coleta.

## Atualizacao de transporte

Endpoint:

```http
POST /api/totvsmoda/sales-order/v2/shipping-order
```

Modelo: `ManageOrderShippingCommand`.

Campos principais:

| Campo | Observacao |
| --- | --- |
| `orderId` ou `branchCode` + `orderCode` | Identifica o pedido. Usar uma das alternativas. |
| `shippingCompanyCode` ou `shippingCompanyCpfCnpj` | Transportadora. Quando informado, `freightType` vira obrigatorio. |
| `redispatchingShippingCompanyCode` ou `redispatchingShippingCompanyCpfCnpj` | Transportadora de redespacho. |
| `redispatchingFreightType` | 1 = emitente, 2 = destinatario. |
| `freightType` | Tipo de frete. |
| `freightPercentage` | Percentual de frete. |
| `freightValue` | Valor do frete. |
| `shippingAddress` | Endereco de entrega. |

Usar este endpoint somente se o processo exigir atualizar o pedido no Virtual Age apos a coleta ou antes da expedicao.

## Criacao de pedido de venda

Endpoint:

```http
POST /api/totvsmoda/sales-order/v2/b2c-orders
```

Modelo: `OrderInDto`.

Campos importantes:

- `orderId`, `branchCode`, `orderDate`.
- Cliente: `customerCode` ou `customerCpfCnpj`.
- Representante: `representativeCode` ou `representativeCpfCnpj`.
- `operationCode`, `paymentConditionCode`, `priorityCode`.
- Transporte: `shippingCompanyCode` ou `shippingCompanyCpfCnpj`, `freightType`, `freightValue`, `packageNumber`, `weight`, `shippingService`.
- `statusOrder`, `totalAmountOrder`.
- `items`, `payments`, `shippingAddress`, `observations`, `invoiceObservations`.

Atencao: o OpenAPI marca pares como `customerCode` e `customerCpfCnpj` no bloco `required`, mas a propria descricao diz que eles nao podem ser enviados simultaneamente e que um dos dois deve ser informado. A mesma observacao vale para representante e transportadora. Validar isso no ambiente de teste.

## Enums uteis

### Situacao do pedido em consulta (`StatusOrderType`)

| Valor | Significado |
| --- | --- |
| `InProgress` | Em andamento |
| `BillingReleased` | Liberado para faturamento |
| `PartiallyAnswered` | Parcialmente atendido |
| `Attended` | Atendido |
| `Blocked` | Bloqueado |
| `Canceled` | Cancelado |
| `InComposition` | Em composicao |
| `InAnalysis` | Em analise |

### Situacao aceita para alteracao (`UpdateStatusOrderType`)

- `InProgress`
- `BillingReleased`
- `Blocked`
- `InComposition`
- `InAnalysis`

### Tipo de frete (`FreitghtType`)

| Valor | Significado |
| --- | --- |
| `1` | CIF, contratado por conta remetente |
| `2` | FOB, contratado por conta destinatario |
| `3` | Contratado por terceiros |
| `4` | Sem ocorrencia de transporte |
| `5` | Proprio por conta remetente |
| `6` | Proprio por conta destinatario |

### Tipo de experiencia (`ExperienceType`)

- `Ecommerce`
- `ShipFromStore`
- `ClickAndCollect`
- `PickupStore`
- `InfiniteShelf`

## Mapeamento inicial para coleta

| Dado para coleta | Campo Virtual Age sugerido |
| --- | --- |
| Numero interno do pedido | `orderId` ou `branchCode` + `orderCode` |
| Numero do cliente/e-commerce | `customerOrderCode` ou `integrationCode` |
| Destinatario | `customerName`, `customerCpfCnpj` |
| Endereco | `shippingAddress` |
| Transportadora atual | `shippingCompanyCode`, `shippingCompanyCpfCnpj`, `shippingCompanyName` |
| Tipo de servico | `shippingService`, `shippingServiceName` |
| Tipo de frete | `freightType` |
| Valor do frete | `freightValue` |
| Quantidade total | `quantity` |
| Valor declarado | `netValue` ou `totalAmountOrder`, conforme regra da transportadora |
| Volumes | `packageNumber`, quando disponivel em criacao/atualizacao |
| Peso | `weight`, quando disponivel em criacao/atualizacao |
| Itens | `items` ou `pending-items` |
| Nota fiscal | `invoices`, quando expandido ou consultado por `/invoices` |

## Estrategia recomendada de busca

1. Gerar token.
2. Consultar `/orders/search` por `filter.change.startDate` e `filter.change.endDate`.
3. Usar `branchCodeList` sempre.
4. Comecar com status `Attended`, conforme decisao operacional atual para pedidos JET.
5. Usar `expand: "items,invoices,shippingAddress"`.
6. Paginar ate `hasNext = false`.
7. Para pedidos candidatos, consultar `/pending-items` quando a quantidade coletavel depender de saldo pendente.
8. Validar dados obrigatorios da transportadora antes de criar coleta.
9. Salvar o protocolo de coleta e impedir nova criacao para o mesmo pedido.
10. Atualizar observacao, transporte ou status no Virtual Age apenas depois de alinhar a regra operacional.

## Pendencias antes de implementar

- Confirmar ambiente final e se usaremos `www30.bhan.com.br:9443`, servidor proprio ou Hub TOTVS.
- Obter `x-api-key` e credenciais.
- Definir grant: `password`, `client_credentials` ou ambos por tipo de operacao.
- Confirmar empresas (`branchCodeList`) no escopo.
- Definir status que entram na fila de coleta.
- Receber documentacao da transportadora/J&T.
- Definir se o retorno da coleta sera salvo apenas localmente ou tambem no Virtual Age.
