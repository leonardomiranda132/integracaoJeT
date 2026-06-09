# TOTVS Moda - Person API

Atualizado em: 2026-06-02.

Este documento consolida a API `person` do TOTVS Moda para consulta e manutencao de pessoas fisicas e juridicas. No contexto deste repositorio, ela e a referencia principal para consulta de cadastros e para criacao/atualizacao de clientes no ecossistema TOTVS Moda.

## Fontes consultadas

- Swagger oficial informado: https://www30.bhan.com.br:9443/api/totvsmoda/person/v2/swagger/index.html
- OpenAPI v2.8.20: https://www30.bhan.com.br:9443/api/totvsmoda/person/v2/swagger/v1/swagger.json
- Documento TDN para pessoa fisica: https://tdn.totvs.com/pages/viewpage.action?pageId=556878550

## Base URL

| Uso | URL |
| --- | --- |
| Swagger | `https://www30.bhan.com.br:9443/api/totvsmoda/person/v2/swagger/index.html` |
| OpenAPI | `https://www30.bhan.com.br:9443/api/totvsmoda/person/v2/swagger/v1/swagger.json` |

## Autenticacao

O Swagger informa seguranca do tipo Bearer:

```http
Authorization: Bearer {token}
```

O token deve ser obtido pelo fluxo de autenticacao do ambiente TOTVS Moda usado no projeto.

## Endpoints documentados

| Metodo | Endpoint | Finalidade |
| --- | --- | --- |
| `POST` | `/api/totvsmoda/person/v2/individuals/search` | Consultar dados de pessoa fisica. |
| `POST` | `/api/totvsmoda/person/v2/individual-customers` | Criar ou alterar cliente pessoa fisica. |
| `POST` | `/api/totvsmoda/person/v2/legal-entities/search` | Consultar dados de pessoa juridica. |
| `POST` | `/api/totvsmoda/person/v2/legal-customers` | Criar ou alterar cliente pessoa juridica. |

## Consulta de pessoa fisica

Endpoint:

```http
POST /api/totvsmoda/person/v2/individuals/search
Content-Type: application/json
Authorization: Bearer {token}
```

Modelo de entrada: `IndividualSearchInDto`.

Campos principais do payload:

- `filter`: modelo `IndividualFilterModel`.
- `option`: modelo `PersonOptionModel`.
- `expand`: lista de expansoes separadas por virgula.
- `order`: campos de ordenacao separados por virgula.
- `page`: pagina inicial 1.
- `pageSize`: quantidade por pagina, com maximo de 500.

### Filtros principais

O modelo `IndividualFilterModel` permite filtrar por:

- `personCodeList`
- `cpfList`
- `phoneNumber`
- `startPersonCode`
- `endPersonCode`
- `personIsInactive`
- `isCustomer`
- `isEmployee`
- `isPurchasingGuide`
- `isRepresentative`
- `isShippingCompany`
- `isSupplier`
- `birthdayDayList`
- `birthdayMonth`
- `change`
- `classifications`

### Filtro de alteracao

O objeto `change` aceita o modelo `PersonChangeFilterModel` com os campos:

- `startDate`
- `endDate`
- `inClassification`
- `classificationTypeCodeList`
- `inAddress`
- `inPhone`
- `inObservation`
- `inPerson`
- `inCustomer`
- `inSupplier`
- `inRepresentative`
- `inPurchasingGuide`
- `inShippingCompany`
- `inReference`
- `inContact`
- `inStatistic`
- `inCustomerObservation`
- `inEmployee`
- `inPreference`

Uso tipico: sincronismo incremental por janela de alteracao, com apoio dos flags `in*` quando se precisa restringir a area do cadastro que mudou.

### Expand e ordenacao

O Swagger descreve estas opcoes principais:

- `expand`: `phones`, `addresses`, `emails`, `classifications`, `additionalFields`, `references`, `observations`, `relateds`, `shippingCompany`, `statistics`, `representatives`, `customerObservations`, `familiars`.
- `order`: `personCode`, `maxChangeFilterDate`, com suporte a prefixo `-` para ordem decrescente.

### Retorno

O retorno e paginado e traz:

- `items`
- `count`
- `hasNext`
- `totalItems`
- `totalPages`

Em cada item de `IndividualSearchOutDto`, o Swagger expoe dados como:

- identificacao: `name`, `cpf`, `rg`, `taxCodeNumber`, `birthDate`
- contato: `phones`, `emails`, `socialNetworks`
- endereco: `addresses`
- classificacoes: `classifications`
- observacoes e dados adicionais: `observations`, `additionalFields`, `individualAdditionals`
- flags cadastrais: `isInactive`, `isBloqued`, `registrationStatus`

## Criacao e atualizacao de pessoa fisica

Endpoint:

```http
POST /api/totvsmoda/person/v2/individual-customers
Content-Type: application/json
Authorization: Bearer {token}
```

Modelo de entrada: `IndividualCustomerInDto`.

Campos principais encontrados no Swagger:

- `name`
- `cpf`
- `birthDate`
- `rg`
- `rgFederalAgency`
- `gender`
- `maritalStatus`
- `nationality`
- `motherName`
- `fatherName`
- `occupation`
- `homeTown`
- `homePage`
- `workPlace`
- `monthlyIncome`
- `isInactive`
- `isBloqued`
- `employee`
- `employeeIsInactive`
- `insertDate`
- `registrationStatus`
- `classifications`
- `phones`
- `emails`
- `addresses`
- `references`
- `observations`
- `additionalFields`
- `individualAdditionals`
- `bankAccounts`
- `limits`
- `socialNetworks`
- `ctps`
- `ctpsSerial`
- `suframaCode`
- `taxCodeNumber`

### Regras de update/reset

O Swagger documenta as seguintes regras para alteracao:

- Ao reenviar a requisicao, apenas os campos informados sao alterados.
- Para resetar um campo:
  - string: enviar `""`
  - numerico: enviar `0`
  - enumeravel: enviar `NotInformed` ou `""`
- A regra de reset nao se aplica para a lista `classifications`.
- `classifications` nao sobrescreve dados existentes; ela apenas adiciona novas informacoes.

### Resposta

O endpoint retorna `CustomerInsertOutDto`, normalmente com os dados de identificacao do cliente criado ou atualizado.

## Pessoa juridica

A API tambem expoe os endpoints equivalentes para pessoa juridica:

- `POST /api/totvsmoda/person/v2/legal-entities/search`
- `POST /api/totvsmoda/person/v2/legal-customers`

O padrao de uso e o mesmo da pessoa fisica:

- consulta paginada por filtros
- criacao/atualizacao por envio do payload completo ou parcial
- Bearer token no header

Para este repositorio, a documentacao de pessoa fisica e a mais relevante no curto prazo, porque ela e a base do cadastro de cliente que normalmente entra em pedidos e conciliacao operacional.

## Observacoes para o projeto

- Esta API e util para enriquecer ou validar dados de cliente antes da integracao com pedidos.
- Se o fluxo do projeto precisar criar cliente automaticamente, o endpoint `individual-customers` e o ponto de entrada mais provavel.
- O documento oficial do Swagger deve ser usado como fonte de verdade para nomes finais de campo e validacoes de ambiente.
