function normalizeLimit(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 500) {
    throw new Error("Informe um limite inteiro entre 1 e 500, ou deixe vazio para enviar todos.");
  }

  return String(parsed);
}

export interface DispatchRealSyncInput {
  dailySendLimit?: unknown;
  dryRun?: boolean;
}

export async function dispatchRealSyncWorkflow(input: DispatchRealSyncInput = {}) {
  const githubToken = process.env.GITHUB_WORKFLOW_DISPATCH_TOKEN;
  if (!githubToken) {
    throw new Error("GITHUB_WORKFLOW_DISPATCH_TOKEN nao esta configurado no Vercel.");
  }

  const owner = process.env.VERCEL_GIT_REPO_OWNER || "leonardomiranda132";
  const repo = process.env.VERCEL_GIT_REPO_SLUG || "integracaoJeT";
  const workflowFile = process.env.GITHUB_SYNC_WORKFLOW_FILE || "sync-diario-jt.yml";
  const ref = process.env.GITHUB_SYNC_WORKFLOW_REF || process.env.VERCEL_GIT_COMMIT_REF || "main";
  const dailySendLimit = normalizeLimit(input.dailySendLimit);
  const actionsUrl = `https://github.com/${owner}/${repo}/actions/workflows/${workflowFile}`;

  if (input.dryRun) {
    return {
      ok: true,
      message: "Workflow de envio real validado em dry-run.",
      ref,
      dailySendLimit: dailySendLimit || "sem limite",
      actionsUrl,
      dispatched: false,
    };
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          send_enabled: "true",
          daily_send_limit: dailySendLimit,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub recusou o disparo do workflow (${response.status}): ${details}`);
  }

  return {
    ok: true,
    message: "Workflow de envio real disparado.",
    ref,
    dailySendLimit: dailySendLimit || "sem limite",
    actionsUrl,
    dispatched: true,
  };
}
