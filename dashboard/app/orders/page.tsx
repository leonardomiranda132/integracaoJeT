import Link from "next/link";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { listOrders } from "../../lib/server/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const orders = await listOrders({
    branchCode: Number(firstParam(params.branch)) || undefined,
    orderCode: Number(firstParam(params.order)) || undefined,
    statusOrder: firstParam(params.statusOrder),
    issueSeverity: firstParam(params.issueSeverity),
    issueStatus: (firstParam(params.issueStatus) as "open" | "resolved" | "ignored" | undefined),
    query: firstParam(params.q),
    limit: Number(firstParam(params.limit)) || 50,
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Pedidos</h1>
          <p>
            Busca operacional por filial, pedido, cliente, `txlogisticId`, `billCode` e estado de
            pendência.
          </p>
        </div>
      </header>

      <form className="filters">
        <label className="field">
          <span>Busca</span>
          <input name="q" defaultValue={firstParam(params.q)} placeholder="Pedido, cliente, txlogisticId, billCode" />
        </label>
        <label className="field">
          <span>Filial</span>
          <input name="branch" defaultValue={firstParam(params.branch)} placeholder="313" />
        </label>
        <label className="field">
          <span>Pedido</span>
          <input name="order" defaultValue={firstParam(params.order)} placeholder="505720" />
        </label>
        <label className="field">
          <span>Status TOTVS</span>
          <input name="statusOrder" defaultValue={firstParam(params.statusOrder)} placeholder="Attended" />
        </label>
        <label className="field">
          <span>Severidade</span>
          <input name="issueSeverity" defaultValue={firstParam(params.issueSeverity)} placeholder="high" />
        </label>
        <button type="submit" className="button button--primary">
          Filtrar
        </button>
      </form>

      <section className="panel">
        <div className="panel__header">
          <h2>Resultado</h2>
          <p>{orders.length} pedido(s) retornado(s).</p>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Transportadora</th>
                <th>NF / valor</th>
                <th>Pickup</th>
                <th>Pendência</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={`${order.branchCode}-${order.orderCode}`}>
                  <td>
                    <Link href={`/orders/${order.branchCode}/${order.orderCode}`}>
                      {order.branchCode}-{order.orderCode}
                    </Link>
                    <div className="subtle">{order.txlogisticId}</div>
                  </td>
                  <td>{order.customerName}</td>
                  <td>
                    <div>{order.statusOrder}</div>
                    <div className="subtle">{order.internalStatus}</div>
                  </td>
                  <td>
                    <div>{order.shippingCompanyName ?? "-"}</div>
                    <div className="subtle">{order.shippingCompanyCode ?? "-"}</div>
                  </td>
                  <td>
                    <div>{order.invoiceNumber ?? "-"}</div>
                    <div className="subtle">{formatCurrency(order.totalAmountOrder)}</div>
                  </td>
                  <td>
                    <div>{order.pickupStatus ?? "-"}</div>
                    <div className="subtle">{order.billCode ?? "-"}</div>
                  </td>
                  <td>
                    <div>{order.openIssueReason ?? "-"}</div>
                    <div className="subtle">{order.openIssueSeverity ?? "-"}</div>
                  </td>
                  <td>{formatDateTime(order.lastSyncedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
