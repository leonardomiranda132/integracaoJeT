# Hospedagem gratuita

Atualizado em: 2026-06-09.

Este documento descreve a forma recomendada para hospedar a integracao sem custo
fixo inicial, mantendo painel web, banco duravel e job diario.

Repositorio GitHub usado:

```text
git@github.com:integracoes-alphabeto/Integra-aoJ-T.git
```

## Arquitetura recomendada

```text
GitHub Actions 17h
  -> npm run db:migrate
  -> npm run sync:daily
  -> TOTVS Moda
  -> J&T
  -> Neon Postgres

Netlify ou Vercel
  -> dashboard Next.js
  -> Neon Postgres
```

## Servicos

### Banco

Use Neon Postgres no plano gratuito.

Configuracao importante:

- copiar a connection string do Neon para `DATABASE_URL`
- usar `PERSISTENCE_ADAPTER=postgres`
- usar `POSTGRES_SSL=true`
- manter migrations em `database/migrations`

### Job diario

O workflow esta em:

- [.github/workflows/sync-diario-jt.yml](/Users/leonardomiranda/Documents/IntergracaoJ&T/.github/workflows/sync-diario-jt.yml:1)

Ele roda:

- todo dia as 20:00 UTC, equivalente a 17:00 em Sao Paulo
- manualmente pelo botao `Run workflow`

Por seguranca, no agendamento automatico o envio real so liga quando a variavel
do repositorio `JT_SEND_ENABLED` estiver como `true`.

### Painel

Opcoes:

- Netlify: bom se voce ja usa e quer conectar o repositorio pela interface.
- Vercel: costuma ser mais simples para Next.js.

Build command:

```bash
npm run ui:build
```

Variaveis do painel:

- `DATABASE_URL`
- `POSTGRES_SSL=true`
- `POSTGRES_SSL_REJECT_UNAUTHORIZED=true`

Antes de publicar o painel, adicionar autenticacao ou protecao por senha.

## Secrets do GitHub

Cadastrar em:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions -> Secrets
```

Tambem existe um comando local para cadastrar Secrets e Variables a partir do
`.env`, sem imprimir valores sensiveis:

```bash
npm run github:actions-config -- --dry-run
npm run github:actions-config
```

Esse comando usa o GitHub CLI (`gh`). Antes de executar:

```bash
brew install gh
gh auth login
```

Por seguranca, o comando cadastra a variable `JT_SEND_ENABLED=false` mesmo que o
`.env` local esteja diferente. Para permitir que o agendamento automatico use o
valor do `.env`, rode somente depois da validacao operacional:

```bash
npm run github:actions-config -- --allow-real-send-schedule
```

Obrigatorios:

```text
DATABASE_URL
VIRTUAL_AGE_CLIENT_ID
VIRTUAL_AGE_CLIENT_SECRET
VIRTUAL_AGE_USERNAME
VIRTUAL_AGE_PASSWORD
JT_API_ACCOUNT
JT_PRIVATE_KEY
JT_CUSTOMER_CODE
JT_CUSTOMER_PASSWORD
JT_RECEIVER_FALLBACK_PHONE
JT_SENDER_TAX_NUMBER
JT_SENDER_MOBILE
JT_SENDER_PHONE
```

Opcional, se sua conta TOTVS exigir:

```text
VIRTUAL_AGE_X_API_KEY
```

## Variables do GitHub

Cadastrar em:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions -> Variables
```

Minimas recomendadas:

```text
JT_SEND_ENABLED=false
DAILY_SEND_LIMIT=10
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=true
POSTGRES_POOL_MAX=5
VIRTUAL_AGE_BRANCH=313
VIRTUAL_AGE_BRANCH_CODES=313
VIRTUAL_AGE_SHIPPING_COMPANY_CODE=88442
VIRTUAL_AGE_ORDER_STATUS_LIST=Attended
VIRTUAL_AGE_ORDER_PAGE_SIZE=100
VIRTUAL_AGE_ORDER_MAX_PAGES=100
JT_SENDER_NAME=...
JT_SENDER_POST_CODE=...
JT_SENDER_STATE=...
JT_SENDER_CITY=...
JT_SENDER_AREA=...
JT_SENDER_STREET=...
JT_SENDER_STREET_NUMBER=...
JT_SENDER_ADDRESS=...
```

Variaveis que ja possuem fallback no workflow, mas podem ser sobrescritas:

```text
VIRTUAL_AGE_ENVIRONMENT=producao
VIRTUAL_AGE_BASE_URL=https://www30.bhan.com.br:9443
VIRTUAL_AGE_AUTH_URL=https://www30.bhan.com.br:9443/api/totvsmoda/authorization/v2/token
VIRTUAL_AGE_SALES_ORDER_BASE_URL=https://www30.bhan.com.br:9443/api/totvsmoda/sales-order/v2
VIRTUAL_AGE_ORDER_EXPAND=items,invoices,shippingAddress
JT_ENVIRONMENT=producao
JT_BASE_URL=https://openapi.jtjms-br.com/webopenplatformapi/api
JT_EXPRESS_TYPE=standard
JT_ORDER_TYPE=2
JT_SERVICE_TYPE=01
JT_DELIVERY_TYPE=03
JT_PAY_TYPE=PP_PM
JT_GOODS_TYPE=bm000006
JT_INVOICE_TYPE=NFe
JT_SENDER_IE_NUMBER=
```

## Como ligar o envio diario real

Configuracao inicial segura:

```text
JT_SEND_ENABLED=false
DAILY_SEND_LIMIT=10
```

Com isso, o agendamento diario roda em dry-run.

Para ligar envio real limitado:

```text
JT_SEND_ENABLED=true
DAILY_SEND_LIMIT=10
```

Para ligar envio real de todos os pedidos elegiveis:

```text
JT_SEND_ENABLED=true
DAILY_SEND_LIMIT nao cadastrado
```

No GitHub, para enviar todos no agendamento automatico, remova a variable
`DAILY_SEND_LIMIT` ou deixe ela sem configurar. Use envio de todos apenas
depois de validar no painel e no `db:inspect`.

## Como rodar manualmente no GitHub

1. Abrir o repositorio no GitHub.
2. Ir em `Actions`.
3. Abrir workflow `Sync diario J&T`.
4. Clicar em `Run workflow`.
5. Escolher:
   - `send_enabled=false` para dry-run
   - `send_enabled=true` para envio real
   - `daily_send_limit=10` para piloto
   - `daily_send_limit=` vazio para todos

O workflow sempre roda:

- `npm run check`
- `npm run db:migrate`
- `npm run sync:daily`
- `npm run db:inspect`
- `npm run monitor:export-orders`

O CSV final fica como artifact `orders-latest`.

## Checklist antes de ativar automatico

- Neon criado e acessivel.
- Migrations aplicadas pelo workflow.
- `DATABASE_URL` esta em Secret, nunca no codigo.
- Secrets e Variables conferidas com `npm run github:actions-config -- --dry-run`.
- Em 2026-06-09, Secrets e Variables foram cadastradas no GitHub com sucesso.
- Estado seguro confirmado: `JT_SEND_ENABLED=false`, `DAILY_SEND_LIMIT=10` e `POSTGRES_SSL=true`.
- Primeiro `Run workflow` manual com `send_enabled=false` passou sem erro.
- Painel consegue ler o banco Neon.
- Operacao conferiu o CSV do dry-run.
- So depois disso mudar `JT_SEND_ENABLED=true`.

## Observacoes importantes

- GitHub Actions agendado pode atrasar alguns minutos em horarios de pico.
- Repositorio privado usa minutos gratuitos da conta GitHub; um job diario deve
  ficar bem abaixo do limite gratuito comum.
- Nao deixar o repositorio publico se as documentacoes ou nomes operacionais
  forem sensiveis para a empresa.
- Nao colocar `.env` no Git.
