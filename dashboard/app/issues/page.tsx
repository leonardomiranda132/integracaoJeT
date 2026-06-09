import Link from "next/link";
import { ResolveIssueButton } from "../../components/resolve-issue-button";
import { formatDateTime } from "../../lib/format";
import { listIssues } from "../../lib/server/queries";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const issues = await listIssues();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Pendências operacionais</h1>
          <p>
            Tudo o que a integração abriu em `operational_issues`, com caminho direto para o
            detalhe do pedido e resolução manual auditada.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Status</th>
                <th>Tipo</th>
                <th>Severidade</th>
                <th>Motivo</th>
                <th>Primeira vez</th>
                <th>Última vez</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <Link href={`/orders/${issue.branchCode}/${issue.orderCode}`}>
                      {issue.branchCode}-{issue.orderCode}
                    </Link>
                    <div className="subtle">{issue.txlogisticId ?? "-"}</div>
                  </td>
                  <td>{issue.status}</td>
                  <td>{issue.issueType}</td>
                  <td>{issue.severity}</td>
                  <td>{issue.reason}</td>
                  <td>{formatDateTime(issue.firstSeenAt)}</td>
                  <td>{formatDateTime(issue.lastSeenAt)}</td>
                  <td>
                    {issue.status === "open" ? <ResolveIssueButton issueId={issue.id} /> : issue.resolutionNote ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
