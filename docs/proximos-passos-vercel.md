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
- O `vercel.json` foi ajustado para declarar explicitamente o preset `nextjs`,
  usar `npm run ui:build` e publicar `dashboard/.next`.
- Foi criada a rota `GET /api/health` para validar se o deploy esta vivo sem
  depender da conexao com o Postgres.

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
```

Nao usar `DATABASE_URL` apontando para `localhost`, porque o Vercel nao consegue
acessar o banco local da maquina.

## Como validar depois do deploy

1. Abrir a URL gerada pelo Vercel em `/api/health`.
2. Confirmar que a resposta tem `status: "ok"`.
3. Confirmar que `databaseConfigured` esta como `true`.
4. Abrir `/` para validar o painel lendo o Neon.
5. Se `/api/health` funciona e `/` falha, revisar `DATABASE_URL`, `POSTGRES_SSL`
   e as migrations do Neon.
6. Se a URL continua com `DEPLOYMENT_NOT_FOUND`, conferir se o projeto existe no
   Vercel, se a branch gerou um deployment e se a URL/alias copiada e a mais
   recente.

## Proximo passo recomendado

Fazer novo import ou redeploy no Vercel depois de subir este ajuste para o
GitHub. A primeira verificacao deve ser pela rota `/api/health`, antes de abrir
o painel completo.
