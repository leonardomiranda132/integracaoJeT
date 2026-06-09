#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_REPOSITORY = 'leonardomiranda132/integracaoJeT';

const REQUIRED_SECRETS = [
  'DATABASE_URL',
  'VIRTUAL_AGE_CLIENT_ID',
  'VIRTUAL_AGE_CLIENT_SECRET',
  'VIRTUAL_AGE_USERNAME',
  'VIRTUAL_AGE_PASSWORD',
  'JT_API_ACCOUNT',
  'JT_PRIVATE_KEY',
  'JT_CUSTOMER_CODE',
  'JT_CUSTOMER_PASSWORD',
  'JT_RECEIVER_FALLBACK_PHONE',
  'JT_SENDER_TAX_NUMBER',
  'JT_SENDER_MOBILE',
  'JT_SENDER_PHONE',
];

const OPTIONAL_SECRETS = ['VIRTUAL_AGE_X_API_KEY'];

const VARIABLE_KEYS = [
  'DAILY_SEND_LIMIT',
  'POSTGRES_SSL',
  'POSTGRES_SSL_REJECT_UNAUTHORIZED',
  'POSTGRES_POOL_MAX',
  'VIRTUAL_AGE_ENVIRONMENT',
  'VIRTUAL_AGE_BASE_URL',
  'VIRTUAL_AGE_AUTH_URL',
  'VIRTUAL_AGE_SALES_ORDER_BASE_URL',
  'VIRTUAL_AGE_ORDER_EXPAND',
  'VIRTUAL_AGE_BRANCH',
  'VIRTUAL_AGE_BRANCH_CODES',
  'VIRTUAL_AGE_SHIPPING_COMPANY_CODE',
  'VIRTUAL_AGE_ORDER_STATUS_LIST',
  'VIRTUAL_AGE_ORDER_PAGE_SIZE',
  'VIRTUAL_AGE_ORDER_MAX_PAGES',
  'JT_ENVIRONMENT',
  'JT_BASE_URL',
  'JT_EXPRESS_TYPE',
  'JT_ORDER_TYPE',
  'JT_SERVICE_TYPE',
  'JT_DELIVERY_TYPE',
  'JT_PAY_TYPE',
  'JT_GOODS_TYPE',
  'JT_INVOICE_TYPE',
  'JT_SENDER_NAME',
  'JT_SENDER_POST_CODE',
  'JT_SENDER_STATE',
  'JT_SENDER_CITY',
  'JT_SENDER_AREA',
  'JT_SENDER_STREET',
  'JT_SENDER_STREET_NUMBER',
  'JT_SENDER_ADDRESS',
  'JT_SENDER_IE_NUMBER',
];

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const valueFor = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const dryRun = hasFlag('--dry-run');
const allowScheduledRealSend = hasFlag('--allow-real-send-schedule');
const repo = valueFor('--repo') ?? process.env.GITHUB_REPOSITORY_TARGET ?? DEFAULT_REPOSITORY;
const envPath = path.resolve(valueFor('--env-file') ?? '.env');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo .env nao encontrado: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const env = new Map();

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const line = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
    if (!line || line.startsWith('#') || !line.includes('=')) continue;

    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env.set(key, value);
  }

  return env;
}

function runGh(argsList, input) {
  const result = spawnSync('gh', argsList, {
    encoding: 'utf8',
    input,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || 'sem detalhe';
    throw new Error(`gh ${argsList.join(' ')} falhou: ${detail}`);
  }
}

function assertGhReady() {
  const hasGh = spawnSync('gh', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (hasGh.status !== 0) {
    throw new Error('GitHub CLI nao encontrado. Instale com `brew install gh` e rode `gh auth login`.');
  }

  const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (auth.status !== 0) {
    throw new Error('GitHub CLI nao autenticado. Rode `gh auth login` antes deste comando.');
  }
}

function printPlan(secrets, variables, missingRequired, missingOptional) {
  console.log(JSON.stringify({
    repository: repo,
    mode: dryRun ? 'dry-run' : 'apply',
    secretsToSet: secrets.map(([key]) => key),
    variablesToSet: variables.map(([key]) => key),
    missingRequiredSecrets: missingRequired,
    missingOptionalSecrets: missingOptional,
    scheduledRealSend: allowScheduledRealSend ? 'from-env' : 'forced-false',
  }, null, 2));
}

try {
  const env = parseEnvFile(envPath);
  const requiredSecrets = REQUIRED_SECRETS.map((key) => [key, env.get(key)]).filter(([, value]) => value);
  const optionalSecrets = OPTIONAL_SECRETS.map((key) => [key, env.get(key)]).filter(([, value]) => value);
  const missingRequired = REQUIRED_SECRETS.filter((key) => !env.get(key));
  const missingOptional = OPTIONAL_SECRETS.filter((key) => !env.get(key));

  const variables = VARIABLE_KEYS.map((key) => [key, env.get(key)]).filter(([, value]) => value !== undefined);
  variables.unshift(['JT_SEND_ENABLED', allowScheduledRealSend ? env.get('JT_SEND_ENABLED') ?? 'false' : 'false']);

  printPlan([...requiredSecrets, ...optionalSecrets], variables, missingRequired, missingOptional);

  if (missingRequired.length > 0) {
    throw new Error(`Secrets obrigatorias ausentes no .env: ${missingRequired.join(', ')}`);
  }

  if (dryRun) {
    process.exit(0);
  }

  assertGhReady();

  for (const [key, value] of [...requiredSecrets, ...optionalSecrets]) {
    runGh(['secret', 'set', key, '--repo', repo], value);
    console.log(`secret:${key}:ok`);
  }

  for (const [key, value] of variables) {
    runGh(['variable', 'set', key, '--repo', repo, '--body', value ?? '']);
    console.log(`variable:${key}:ok`);
  }

  console.log('GitHub Actions configurado com sucesso.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
