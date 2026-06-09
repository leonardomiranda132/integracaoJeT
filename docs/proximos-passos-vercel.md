# Proximos passos para publicar o painel no Vercel

Atualizado em: 2026-06-09.

Este documento registra o diagnostico e o checklist para subir o painel
operacional no Vercel puxando do GitHub.

## Diagnostico feito

- O build local do painel passou com `npm run ui:build`.
- O build equivalente ao configurado para Vercel passou com `npm run build`.
- A URL informada `https://integra-ao-j-t-hvei.vercel.app/` respondeu
  `404 DEPLOYMENT_NOT_FOUND`, ou seja, o problema visivel agora e de deploy ou
  alias inexistente, nao de erro de runtime da aplicacao.
- A URL nova `https://integracao-je-t.vercel.app/` respondeu `500` na home em
  2026-06-09, enquanto `/api/health` respondeu `200`; o health mostrou banco
  configurado, mas SSL efetivo desligado no deploy antigo.
- O `vercel.json` foi ajustado para declarar explicitamente o preset `nextjs`,
  usar `npm run ui:build` e publicar `dashboard/.next`.
- Foi criada a rota `GET /api/health` para validar se o deploy esta vivo sem
  depender da conexao com o Postgres.
- O painel agora assume SSL automaticamente quando roda no Vercel e a home
  mostra uma tela de diagnostico em vez de erro 500 cru se o Postgres falhar.
- Em runtime Vercel, se `DATABASE_URL` estiver local mas `POSTGRES_URL` estiver
  remoto, o painel passa a preferir `POSTGRES_URL`.

## Configuracao recomendada no Vercel

Ao importar o repositorio `leonardomiranda132/integracaoJeT` pelo GitHub:

- Framework Preset: `Next.js`
- Root Directory: raiz do repositorio, sem selecionar `dashboard`
- Install Command: deixar automatico ou `npm install`
- Build Command: `npm run ui:build`
- Output Directory: `dashboard/.next`
- Production Branch: branch principal que esta recebendo os commits do projeto

Se o Vercel pedir para sobrescrever alguma configuracao, manter os valores acima
para ficarem alinhados com `vercel.json`.

## Variaveis de ambiente do painel

Cadastrar no Vercel em Production e Preview:

```text
DATABASE_URL=<connection string do Neon>
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=true
POSTGRES_POOL_MAX=5
OPERATIONS_ACTION_TOKEN=<senha operacional forte>
GITHUB_WORKFLOW_DISPATCH_TOKEN=<token GitHub com permissao de workflow dispatch>
```

Nao usar `DATABASE_URL` apontando para `localhost`, porque o Vercel nao consegue
acessar o banco local da maquina.

Observacao: o codigo assume SSL no runtime do Vercel para proteger o caso mais
comum com Neon. So desabilitar SSL no Vercel em uma excecao controlada usando
`POSTGRES_SSL_FORCE_DISABLE=true`.

Para os botoes operacionais do dashboard:

- `OPERATIONS_ACTION_TOKEN` protege limpeza de banco e envio real.
- `GITHUB_WORKFLOW_DISPATCH_TOKEN` e usado apenas no servidor para disparar
  `.github/workflows/sync-diario-jt.yml` com `send_enabled=true`.
- `JT_SEND_ENABLED` continua sendo variavel do GitHub Actions para o agendamento
  automatico. O botao manual do painel nao precisa de `JT_SEND_ENABLED` no
  Vercel, porque envia `send_enabled=true` no disparo do workflow.
- O token operacional deve ficar fora do Git; se for salvo localmente, manter em
  arquivo ignorado, como `.operations-token`.

## Como validar depois do deploy

1. Abrir a URL gerada pelo Vercel em `/api/health`.
2. Confirmar que a resposta tem `status: "ok"`.
3. Confirmar que `databaseConfigured` esta como `true`.
4. Confirmar que `databaseUrlKind` esta como `remote`, nao `local`.
5. Confirmar que `selectedDatabaseSource` e a variavel remota correta.
6. Confirmar que `postgresSsl` esta como `true`.
7. Abrir `/` para validar o painel lendo o Neon.
8. Se `/api/health` funciona e `/` falha, revisar `DATABASE_URL`, `POSTGRES_SSL`
   e as migrations do Neon.
9. Confirmar que o painel exibe o cronometro e que os botoes pedem senha
   operacional antes de qualquer acao real.
10. Se a URL continua com `DEPLOYMENT_NOT_FOUND`, conferir se o projeto existe no
   Vercel, se a branch gerou um deployment e se a URL/alias copiada e a mais
   recente.

## Proximo passo recomendado

Fazer novo import ou redeploy no Vercel depois de subir este ajuste para o
GitHub. A primeira verificacao deve ser pela rota `/api/health`, antes de abrir
o painel completo.
