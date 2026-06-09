# TOTVS Moda API V2 - Mapa Geral

Atualizado em: 2026-06-03.

Fonte principal informada:

- https://tdn.totvs.com/pages/releaseview.action?pageId=532385018

Este documento mapeia a pagina-mãe `VA Integracao - API - V2` e organiza os
modulos relevantes para a integracao TOTVS Moda x J&T.

## Observacao sobre escopo

A pagina publica lista os modulos abaixo e indica que existem outras paginas
filhas ocultas no recorte exibido pelo Confluence. Este documento registra a
arvore visivel e os modulos que impactam a integracao atual.

Quando um modulo virar necessidade real do projeto, criar documento especifico
com endpoints, payloads, exemplos e decisoes locais.

## Modulos visiveis na pagina-mãe

| Modulo | Uso provavel |
| --- | --- |
| `product-counts` | Contagem de produtos; fora do fluxo inicial. |
| `Accounts Payable` | Contas a pagar; fora do fluxo logistico inicial. |
| `Accounts Receivable` | Contas a receber; possivel apoio financeiro, fora do fluxo atual. |
| `Analytics` | Consultas analiticas; possivel apoio futuro. |
| `Authorization` | Obrigatorio para obter token Bearer. |
| `Current Accounts` | Contas correntes; fora do fluxo inicial. |
| `Data Package` | Pacotes de dados; avaliar se houver carga/exportacao em lote. |
| `Fiscal` | Apoio para notas fiscais, XML/DANFE e validacao fiscal. |
| `General` | Cadastros/configuracoes gerais; apoio eventual. |
| `Global` | Dados globais do ambiente; apoio eventual. |
| `Image` | Imagens; fora do fluxo inicial. |
| `Liberacao de Usuario` | Permissoes de usuario; relevante para liberar usuario da API. |
| `Logistics` | Embalagem/armazenamento de produto; periferico para este projeto. |
| `Management` | Administracao; apoio eventual. |
| `Material Request` | Solicitacao de material; fora do fluxo inicial. |
| `Person` | Enriquecimento de cliente, telefone e cadastro. |
| `Product` | Cadastro de produto; apoio para NCM/peso se necessario. |
| `Product-engineering` | Engenharia de produto; fora do fluxo inicial. |
| `Production` | Producao; fora do fluxo inicial. |
| `Production Order` | Ordem de producao; fora do fluxo inicial. |
| `Product Prototype` | Prototipo; fora do fluxo inicial. |
| `Purchase Order` | Pedido de compra; fora do fluxo inicial. |
| `Sales Order` | Principal fonte dos pedidos de venda. |
| `Seller` | Vendedores; fora do fluxo logistico inicial. |
| `Voucher` | Vouchers; fora do fluxo logistico inicial. |

## Modulos prioritarios para esta integracao

### Authorization

Referencia:

- https://tdn.totvs.com/pages/releaseview.action?pageId=543088921
- https://tdn.totvs.com/pages/releaseview.action?pageId=532385061

Uso no projeto:

- obter token para chamadas autenticadas
- enviar `Content-Type: application/x-www-form-urlencoded`
- usar grant `password` no ambiente atual
- informar `client_id`, `client_secret`, `username`, `password` e, quando
  aplicavel, `branch`

No codigo:

- `src/infrastructure/http/totvs-client.ts`
- `src/config/settings.ts`

### Sales Order

Referencia:

- https://tdn.totvs.com/pages/releaseview.action?pageId=546246518
- https://tdn.totvs.com/pages/releaseview.action?pageId=570785370

Uso no projeto:

- consultar pedidos em `/orders/search`
- filtrar por filial, janela, status e transportadora
- paginar resultado
- expandir `items`, `invoices` e `shippingAddress`
- recuperar dados necessarios para montar payload J&T

Subpaginas visiveis relevantes:

- `orders/search`: consulta de pedidos de venda.
- `pending-items`: avaliar se parcialidade virar regra.
- `invoices`: apoio quando a nota nao vier suficiente no expand.
- `shipping-order`: possivel atualizacao de transporte no TOTVS.
- `observations-order`: possivel registro do `billCode` no pedido.
- `change-status`: usar apenas com regra operacional formal.

No codigo:

- `src/infrastructure/http/totvs-client.ts`
- `src/application/use-cases/sync-orders.ts`

### Person

Referencia:

- https://tdn.totvs.com/pages/releaseview.action?pageId=545626819
- https://tdn.totvs.com/pages/releaseview.action?pageId=556878562

Uso no projeto:

- consultar cliente por `customerCode`
- expandir telefones
- preencher `phone` e `mobile` no payload J&T quando o pedido nao traz telefone

Subpaginas visiveis relevantes:

- consulta de pessoa fisica ou juridica
- tipos de telefone
- customer/cliente
- representante e empresa, se regras comerciais entrarem depois

No codigo:

- `src/infrastructure/http/person-client.ts`
- `src/application/use-cases/sync-orders.ts`

### Fiscal

Referencia:

- pagina-mãe: https://tdn.totvs.com/pages/releaseview.action?pageId=532385018

Uso futuro:

- buscar nota fiscal quando `Sales Order` nao trouxer dados suficientes
- validar chave/numero/serie da nota
- recuperar XML ou DANFE se a operacao exigir

Status atual:

- nao e necessario para o fluxo validado, porque o expand de `Sales Order`
  trouxe `invoices` suficientes para os testes.

### Logistics

Referencia:

- https://tdn.totvs.com/pages/releaseview.action?pageId=663597351

Leitura para o projeto:

- a arvore visivel trata de embalagem e armazenamento de produto
- nao parece ser o modulo principal para coleta/transportadora
- usar apenas se a operacao pedir dados de embalagem, quantidade em embalagem
  ou local fisico antes da coleta

## Fluxo recomendado com APIs TOTVS

```text
Authorization
  -> Sales Order / orders/search
  -> Person / individuals ou legal-entities quando faltar telefone
  -> Fiscal apenas se faltar dado de nota
  -> J&T addOrder
```

## Lacunas a confirmar

- Se a operacao vai exigir atualizacao de observacao/status no TOTVS apos criar
  a coleta na J&T.
- Se pedidos parcialmente atendidos exigem `pending-items`.
- Se algum dado fiscal deve vir do modulo `Fiscal` em vez do expand de pedidos.
- Se produto/NCM/peso deve ser refinado via modulo `Product`.
- Se o usuario TOTVS de producao esta liberado em todas as filiais do escopo.

## Proximos passos

1. Manter `Authorization`, `Sales Order` e `Person` como prioridade.
2. Criar documento especifico de `Fiscal` apenas se faltar NF/XML/DANFE.
3. Criar documento especifico de `Product` apenas se NCM/peso virar regra.
4. Confirmar com a operacao se vamos gravar `billCode` no TOTVS.
5. Se sim, detalhar `observations-order` ou `shipping-order` antes de
   implementar atualizacao no TOTVS.
