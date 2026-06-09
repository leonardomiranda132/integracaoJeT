# n8n Self-hosted (Descontinuado)

Atualizado em: 2026-06-03.

Este documento fica apenas como nota historica.

## Estado final

- a estrategia com n8n foi descontinuada
- `deploy/n8n/` foi removido do repositorio
- a interface operacional propria em `Next.js` virou o caminho oficial

Documentos atuais:

- [docs/plano-interface-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/plano-interface-operacional.md:1)
- [docs/interface-operacional.md](/Users/leonardomiranda/Documents/IntergracaoJ&T/docs/interface-operacional.md:1)

## Motivo da descontinuacao

- a operacao precisa trabalhar pedido a pedido
- a equipe precisa enxergar o motivo dos erros com contexto de dominio
- a equipe precisa aplicar override e reprocessamento de forma auditada
- o fluxo visual desejado se encaixa melhor em uma interface propria

## Estado atual

Status em 2026-06-03:

- n8n esta rodando localmente em `http://localhost:5678`.
- Postgres proprio do n8n esta rodando e saudavel.
- Usuario admin inicial ja existe na instancia local.
- Tres workflows foram importados pela CLI.
- Os workflows estao desativados por seguranca.
- Falta criar/selecionar credencial SSH nos nodes `SSH`.
- Falta testar os workflows manualmente antes de ativar agenda.
- Envio real continua bloqueado; usar apenas dry-run enquanto a transportadora valida.

## Decisao de arquitetura

O n8n roda separado da integracao.

Recomendacao:

- n8n com Docker Compose.
- banco Postgres proprio para o n8n.
- banco `integracao_jt` separado para a integracao.
- credenciais TOTVS/J&T permanecem no `.env` do host onde o repo roda.
- workflows chamam comandos por SSH no host da integracao.

Motivo: o node `Execute Command` do n8n roda dentro do container do n8n. Usar
SSH evita montar o repositorio e segredos da integracao dentro do container.

Referencias oficiais:

- Docker: https://docs.n8n.io/hosting/installation/docker/
- Bancos suportados/Postgres: https://docs.n8n.io/hosting/configuration/supported-databases-settings/
- Variaveis e secrets `_FILE`: https://docs.n8n.io/hosting/configuration/configuration-methods/

## Arquivos criados

- `deploy/n8n/docker-compose.yml`
- `deploy/n8n/.env.example`
- `deploy/n8n/secrets/.gitkeep`
- `deploy/n8n/workflows/integracao-jt-dry-run-diario.json`
- `deploy/n8n/workflows/integracao-jt-conferencia-manual.json`
- `deploy/n8n/workflows/integracao-jt-reprocessamento-dry-run.json`

Os arquivos reais em `deploy/n8n/secrets/` ficam fora do Git.

## Workflows criados

Foram preparados tres workflows:

- `Integracao J&T - Dry-run diario e monitoramento`
- `Integracao J&T - Conferencia manual`
- `Integracao J&T - Reprocessamento dry-run manual`

Eles ficam desativados por seguranca e usam nodes SSH sem credencial preenchida.
Antes de executar, crie uma credencial SSH no n8n e selecione essa credencial
em cada node `SSH`.

Importar/reimportar workflows:

```bash
cd deploy/n8n
docker cp workflows n8n-n8n-1:/tmp/integracao-jt-workflows
docker-compose exec -T n8n n8n import:workflow --separate --input=/tmp/integracao-jt-workflows
```

Listar workflows importados:

```bash
docker-compose exec -T n8n n8n list:workflow
```

## Subir o n8n localmente

Preparar variaveis:

```bash
cd deploy/n8n
cp .env.example .env
```

Criar secrets locais:

```bash
mkdir -p secrets
openssl rand -base64 32 > secrets/n8n_encryption_key
openssl rand -base64 32 > secrets/n8n_postgres_password
```

Subir:

```bash
docker compose up -d
```

Se o seu ambiente usa o binario legado, use:

```bash
docker-compose up -d
```

Acessar:

```text
http://localhost:5678
```

Conferir containers:

```bash
docker compose ps
docker-compose ps
```

Parar:

```bash
docker compose down
```

Ou:

```bash
docker-compose down
```

Atualizar imagem:

```bash
docker compose pull
docker compose up -d
```

Ou:

```bash
docker-compose pull
docker-compose up -d
```

## Workflow diario recomendado

Nodes:

1. `Schedule Trigger`
2. `SSH - Rodar sync diario`
3. `SSH - Rodar db:inspect`
4. `IF - houve erro ou pendencia?`
5. `Email/Slack/Telegram/HTTP - Notificar`

Configuracao do `Schedule Trigger`:

- horario: `17:00`
- timezone: `America/Sao_Paulo`
- frequencia: diaria

Comando SSH do sync:

```bash
cd /caminho/do/projeto && npm run sync:daily
```

No workflow importado, o caminho ja esta configurado como:

```text
/Users/leonardomiranda/Documents/IntergracaoJ&T
```

Comando SSH do relatorio:

```bash
cd /caminho/do/projeto && npm run db:inspect -- --days=1 --limit=20
```

Durante piloto dry-run:

```bash
cd /caminho/do/projeto && JT_SEND_ENABLED=false npm run sync:daily
```

Durante piloto com envio limitado:

```bash
cd /caminho/do/projeto && JT_SEND_ENABLED=true DAILY_SEND_LIMIT=10 npm run sync:daily
```

## Workflows manuais recomendados

### Inspecionar pedido

Parametro esperado:

- `branchCode`
- `orderCode`

Comando:

```bash
cd /caminho/do/projeto && npm run monitor:order -- --branch={{$json.branchCode}} --order={{$json.orderCode}}
```

### Enfileirar reprocessamento em dry-run

```bash
cd /caminho/do/projeto && npm run reprocess:queue -- --branch={{$json.branchCode}} --order={{$json.orderCode}} --reason="Solicitado via n8n"
```

### Processar fila

```bash
cd /caminho/do/projeto && npm run reprocess:run -- --limit=5
```

### Enfileirar envio real

Usar apenas com aprovacao operacional:

```bash
cd /caminho/do/projeto && npm run reprocess:queue -- --branch={{$json.branchCode}} --order={{$json.orderCode}} --reason="Envio aprovado via n8n" --send
```

## Seguranca

- Nao colocar `JT_PRIVATE_KEY`, senha TOTVS ou `DATABASE_URL` da integracao no
  workflow do n8n.
- Usar credencial SSH com usuario restrito ao servidor da integracao.
- Proteger o n8n com usuario forte e, em producao, HTTPS/reverse proxy.
- Manter `N8N_ENCRYPTION_KEY` persistente; trocar essa chave sem migracao pode
  inutilizar credenciais salvas.
- Nao expor `localhost:5678` diretamente na internet sem proxy seguro.
- Revisar retencao de execucoes, pois outputs podem conter logs operacionais.

## Configurar SSH no Mac local

Para o n8n executar comandos neste Mac via SSH, o macOS precisa aceitar login
remoto. Em ambiente local, faca:

1. Abra `Ajustes do Sistema`.
2. Va em `Geral` > `Compartilhamento`.
3. Ative `Login Remoto`.
4. No n8n, crie uma credencial `SSH`.
5. Use host `host.docker.internal`, porta `22`, usuario do Mac e senha/chave.

Depois selecione essa credencial em cada node `SSH` dos workflows importados.

Enquanto a transportadora ainda nao confirmar a integracao, mantenha os fluxos
em dry-run e nao use `--send`.

## Proximos passos

1. Abrir `http://localhost:5678` e confirmar que os tres workflows aparecem.
2. Ativar `Login Remoto` no macOS, se ainda nao estiver ativo.
3. Criar credencial SSH para o host `host.docker.internal`.
4. Selecionar a credencial em todos os nodes `SSH`.
5. Executar `Integracao J&T - Conferencia manual`.
6. Executar `Integracao J&T - Dry-run diario e monitoramento` manualmente antes de ativar agenda.
7. Adicionar notificacao de falha e pendencias abertas.
8. Rodar alguns ciclos acompanhados em dry-run.
9. Aguardar confirmacao da transportadora antes de qualquer fluxo com envio real.
10. So trocar para envio limitado com `DAILY_SEND_LIMIT` apos aprovacao operacional.
8. So trocar para envio limitado com `DAILY_SEND_LIMIT` apos aprovacao da transportadora.
