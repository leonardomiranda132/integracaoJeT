import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Boxes,
  Database,
  Download,
  FileSpreadsheet,
  ListChecks,
  Lock,
  PackageCheck,
  RefreshCcw,
  Route,
  Search,
  ShieldCheck,
} from "lucide-react";
import { QuickReprocessForm } from "../components/quick-reprocess-form";
import { formatDateTime, formatNumber } from "../lib/format";
import { getDashboardMetrics, getFlowBlocks, getLatestRun, listRecentRuns, listIssues, listReprocessRequests } from "../lib/server/queries";

export const dynamic = "force-dynamic";

function blockToneClass(tone: "default" | "success" | "warning" | "danger"): string {
  switch (tone) {
    case "success":
      return "workflow-node workflow-node--success";
    case "warning":
      return "workflow-node workflow-node--warning";
    case "danger":
      return "workflow-node workflow-node--danger";
    default:
      return "workflow-node";
  }
}

function metricToneClass(tone: "default" | "success" | "warning" | "danger"): string {
  return tone === "default" ? "metric-card" : `metric-card metric-card--${tone}`;
}

function configuredNumber(names: string[], fallback: number): number {
  for (const name of names) {
    const parsed = Number(process.env[name]);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

const flowIcons: Record<string, LucideIcon> = {
  totvs: Search,
  pagination: Route,
  eligibility: ShieldCheck,
  payload: PackageCheck,
  "send-lock": Lock,
  persistence: Database,
  issues: AlertTriangle,
  reprocess: RefreshCcw,
};

function getDashboardErrorMessage(error: unknown): string {
  if (error instanceof Error && /DATABASE_URL|POSTGRES_URL/.test(error.message)) {
    return "DATABASE_URL ou POSTGRES_URL nao esta configurado no ambiente do Vercel.";
  }

  if (error instanceof Error && /(localhost|127\.0\.0\.1)/i.test(error.message)) {
    return "O Vercel esta tentando acessar um banco local. Use a connection string do Neon em DATABASE_URL.";
  }

  if (error instanceof Error && /(ssl|pg_hba|no encryption)/i.test(error.message)) {
    return "O Postgres recusou a conexao sem SSL. Confira POSTGRES_SSL=true ou use a connection string do Neon com sslmode=require.";
  }

  return "O deploy esta no ar, mas a home nao conseguiu consultar o Postgres. Confira DATABASE_URL, POSTGRES_SSL e migrations no Vercel.";
}

function DashboardUnavailable({ error }: { error: unknown }) {
  return (
    <div className="page">
      <header className="admin-hero">
        <div>
          <div className="eyebrow">Painel administrativo</div>
          <h1>Banco não conectado</h1>
          <p>{getDashboardErrorMessage(error)}</p>
        </div>

        <div className="badge-row">
          <span className="badge badge--warning">
            <AlertTriangle size={14} />
            Revisar variaveis no Vercel
          </span>
          <a className="button" href="/api/health">
            <Database size={16} />
            Ver health check
          </a>
        </div>
      </header>

      <section className="panel">
        <div className="panel__header">
          <h2>Checklist rapido</h2>
          <p>O deploy respondeu, entao a proxima validacao e a conexao com o Neon.</p>
        </div>
        <div className="panel__content">
          <ul className="detail-list">
            <li>
              <strong>DATABASE_URL</strong>
              <span>Usar a connection string do Neon, nunca localhost.</span>
            </li>
            <li>
              <strong>POSTGRES_SSL</strong>
              <span>Manter como true no Vercel.</span>
            </li>
            <li>
              <strong>Migrations</strong>
              <span>Rodar o workflow ou `npm run db:migrate` apontando para o Neon.</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  let latestRun;
  let metrics;
  let flowBlocks;
  let recentRuns;
  let recentIssues;
  let recentReprocess;

  try {
    latestRun = await getLatestRun();
    [metrics, flowBlocks, recentRuns, recentIssues, recentReprocess] = await Promise.all([
      getDashboardMetrics(),
      getFlowBlocks(latestRun?.id),
      listRecentRuns(),
      listIssues(8, "open"),
      listReprocessRequests(8),
    ]);
  } catch (error) {
    return <DashboardUnavailable error={error} />;
  }

  const orderPageSize = configuredNumber(
    ["TOTVS_ORDER_PAGE_SIZE", "VIRTUAL_AGE_ORDER_PAGE_SIZE"],
    100,
  );
  const orderMaxPages = configuredNumber(
    ["TOTVS_ORDER_MAX_PAGES", "VIRTUAL_AGE_ORDER_MAX_PAGES"],
    100,
  );
  const paginationSummary = latestRun
    ? `${formatNumber(latestRun.pagesRead)} paginas lidas, ate ${formatNumber(orderMaxPages)} paginas configuradas`
    : `pageSize ${formatNumber(orderPageSize)}, ate ${formatNumber(orderMaxPages)} paginas`;

  return (
    <div className="page">
      <header className="admin-hero">
        <div>
          <div className="eyebrow">Painel administrativo</div>
          <h1>Painel operacional</h1>
          <p>
            Controle da integracao TOTVS Moda x J&amp;T com fluxo visual, fila de
            reprocessamento e auditoria por pedido.
          </p>
        </div>

        <div className="badge-row">
          <span className="badge badge--warning">
            <AlertTriangle size={14} />
            Envio real continua bloqueado
          </span>
          <span className="badge">
            <Route size={14} />
            {paginationSummary}
          </span>
          <a className="button" href="/api/exports/orders-latest">
            <Download size={16} />
            Exportar último lote
          </a>
        </div>
      </header>

      <section className="metrics-grid">
        <div className={metricToneClass("default")}>
          <Boxes size={18} />
          <div className="metric-card__label">Pedidos lidos (7 dias)</div>
          <div className="metric-card__value">{formatNumber(metrics.ordersRead)}</div>
        </div>
        <div className={metricToneClass("success")}>
          <PackageCheck size={18} />
          <div className="metric-card__label">Dry-run válido (7 dias)</div>
          <div className="metric-card__value">{formatNumber(metrics.pickupsDryRun)}</div>
        </div>
        <div className={metricToneClass(metrics.openIssues > 0 ? "danger" : "default")}>
          <AlertTriangle size={18} />
          <div className="metric-card__label">Pendências abertas</div>
          <div className="metric-card__value">{formatNumber(metrics.openIssues)}</div>
        </div>
        <div className={metricToneClass(metrics.pendingReprocess > 0 ? "warning" : "default")}>
          <RefreshCcw size={18} />
          <div className="metric-card__label">Reprocessamentos pendentes</div>
          <div className="metric-card__value">{formatNumber(metrics.pendingReprocess)}</div>
        </div>
      </section>

      <section className="stack">
        <div className="panel">
          <div className="panel__header">
            <h2>Fluxo principal</h2>
            <p>
              Os blocos mostram como o lote está andando hoje, do TOTVS até a persistência e a
              abertura de pendências.
            </p>
          </div>

          <div className="panel__content">
            <div className="workflow-board">
              {flowBlocks.map((block, index) => {
                const Icon = flowIcons[block.id] ?? ListChecks;
                const content = (
                  <>
                    <div className="workflow-node__top">
                      <span className="workflow-node__index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="workflow-node__status-dot" aria-hidden="true" />
                    </div>
                    <div className="workflow-node__module">
                      <span className="workflow-node__icon">
                        <Icon size={22} />
                      </span>
                      <div className="workflow-node__count">{formatNumber(block.count)}</div>
                    </div>
                    <div className="workflow-node__copy">
                      <div className="workflow-node__label">{block.label}</div>
                      <div className="workflow-node__description">{block.description}</div>
                    </div>
                  </>
                );

                return block.href ? (
                  <Link key={block.id} href={block.href} className={blockToneClass(block.tone)}>
                    {content}
                  </Link>
                ) : (
                  <div key={block.id} className={blockToneClass(block.tone)}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <section className="control-grid">
          <QuickReprocessForm />

          <Link className="quick-action-card" href="/orders">
            <div className="quick-action-card__icon">
              <Search size={20} />
            </div>
            <h3>Consultar pedido</h3>
            <p>Abra a lista com filtros por pedido, status, pendencia e J&amp;T.</p>
          </Link>

          <Link className="quick-action-card" href="/issues">
            <div className="quick-action-card__icon quick-action-card__icon--danger">
              <AlertTriangle size={20} />
            </div>
            <h3>Tratar pendências</h3>
            <p>Veja o motivo dos erros e resolva o que já foi corrigido.</p>
          </Link>

          <a className="quick-action-card" href="/api/exports/orders-latest">
            <div className="quick-action-card__icon quick-action-card__icon--success">
              <FileSpreadsheet size={20} />
            </div>
            <h3>Exportar lote</h3>
            <p>Baixe o CSV operacional sem CPF, telefone ou endereco.</p>
          </a>
        </section>

        <div className="panel-grid">
          <section className="panel">
            <div className="panel__header">
              <h2>Lotes recentes</h2>
              <p>Últimas execuções registradas em sync_runs.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Início</th>
                    <th>Pedidos</th>
                    <th>Páginas</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{run.status}</td>
                      <td>{formatDateTime(run.startedAt)}</td>
                      <td>{formatNumber(run.ordersRead)}</td>
                      <td>{formatNumber(run.pagesRead)}</td>
                      <td>{formatNumber(run.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Pendências abertas</h2>
              <p>As mais recentes para ação operacional.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Tipo</th>
                    <th>Severidade</th>
                    <th>Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIssues.map((issue) => (
                    <tr key={issue.id}>
                      <td>
                        <Link href={`/orders/${issue.branchCode}/${issue.orderCode}`}>
                          {issue.branchCode}-{issue.orderCode}
                        </Link>
                      </td>
                      <td>{issue.issueType}</td>
                      <td>{issue.severity}</td>
                      <td>{formatDateTime(issue.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="panel-grid">
          <section className="panel">
            <div className="panel__header">
              <h2>Reprocessamentos</h2>
              <p>Fila e histórico recente.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Status</th>
                    <th>Tentativas</th>
                    <th>Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReprocess.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link href={`/orders/${item.branchCode}/${item.orderCode}`}>
                          {item.branchCode}-{item.orderCode}
                        </Link>
                      </td>
                      <td>{item.status}</td>
                      <td>{formatNumber(item.attempts)}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Estado atual</h2>
              <p>Leitura rápida do lote mais recente.</p>
            </div>
            <div className="panel__content">
              <dl className="key-value">
                <div className="key-value__row">
                  <dt>Último sync run</dt>
                  <dd>{latestRun?.id ?? "-"}</dd>
                </div>
                <div className="key-value__row">
                  <dt>Status</dt>
                  <dd>{latestRun?.status ?? "-"}</dd>
                </div>
                <div className="key-value__row">
                  <dt>Janela consultada</dt>
                  <dd>
                    {latestRun ? `${formatDateTime(latestRun.windowStart)} até ${formatDateTime(latestRun.windowEnd)}` : "-"}
                  </dd>
                </div>
                <div className="key-value__row">
                  <dt>Paginação TOTVS</dt>
                  <dd>
                    pageSize {formatNumber(orderPageSize)} com limite de {formatNumber(orderMaxPages)} páginas. O sync continua lendo enquanto a TOTVS retornar uma página cheia.
                  </dd>
                </div>
                <div className="key-value__row">
                  <dt>Dry-run e envio</dt>
                  <dd>
                    <span className="badge badge--warning">
                      <RefreshCcw size={14} />
                      Somente dry-run nesta fase
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
