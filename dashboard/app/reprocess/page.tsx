import Link from "next/link";
import { QuickReprocessForm } from "../../components/quick-reprocess-form";
import { formatDateTime } from "../../lib/format";
import { listReprocessRequests } from "../../lib/server/queries";

export const dynamic = "force-dynamic";

export default async function ReprocessPage() {
  const items = await listReprocessRequests();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Fila de reprocessamento</h1>
          <p>
            Visão central de `reprocess_requests`: o que está pendente, o que já rodou e o motivo
            operacional de cada nova tentativa.
          </p>
        </div>
      </header>

      <section className="single-action-row">
        <QuickReprocessForm />
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Status</th>
                <th>Motivo</th>
                <th>Solicitado por</th>
                <th>Tentativas</th>
                <th>Criado em</th>
                <th>Último erro</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/orders/${item.branchCode}/${item.orderCode}`}>
                      {item.branchCode}-{item.orderCode}
                    </Link>
                    <div className="subtle">{item.txlogisticId ?? "-"}</div>
                  </td>
                  <td>{item.status}</td>
                  <td>{item.reason}</td>
                  <td>{item.requestedBy}</td>
                  <td>{item.attempts}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.lastError ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
