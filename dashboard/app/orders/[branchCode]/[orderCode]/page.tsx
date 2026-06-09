import Link from "next/link";
import { MutationForm } from "../../../../components/mutation-form";
import { ResolveIssueButton } from "../../../../components/resolve-issue-button";
import { formatDateTime } from "../../../../lib/format";
import { getOrderDetail } from "../../../../lib/server/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    branchCode: string;
    orderCode: string;
  }>;
}

function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { branchCode, orderCode } = await params;
  const detail = await getOrderDetail(Number(branchCode), Number(orderCode));
  const order = detail.order;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            Pedido {branchCode}-{orderCode}
          </h1>
          <p>
            Visão completa do pedido, com eventos, pendências, histórico de reprocessamento e
            correções aplicadas.
          </p>
        </div>
        <div className="badge-row">
          <Link href="/orders" className="button">
            Voltar para pedidos
          </Link>
        </div>
      </header>

      <section className="details-grid">
        <div className="stack">
          <section className="panel">
            <div className="panel__header">
              <h2>Resumo atual</h2>
              <p>Snapshot salvo na tabela `orders`.</p>
            </div>
            <div className="panel__content">
              {order ? (
                <dl className="key-value">
                  <div className="key-value__row">
                    <dt>Cliente</dt>
                    <dd>{String(order.customer_name ?? "-")}</dd>
                  </div>
                  <div className="key-value__row">
                    <dt>Status TOTVS</dt>
                    <dd>{String(order.status_order ?? "-")}</dd>
                  </div>
                  <div className="key-value__row">
                    <dt>Transportadora</dt>
                    <dd>
                      {String(order.shipping_company_name ?? "-")} ({String(order.shipping_company_code ?? "-")})
                    </dd>
                  </div>
                  <div className="key-value__row">
                    <dt>Nota fiscal</dt>
                    <dd>{String(order.invoice_number ?? "-")}</dd>
                  </div>
                  <div className="key-value__row">
                    <dt>Última sincronização</dt>
                    <dd>{formatDateTime(order.last_synced_at)}</dd>
                  </div>
                </dl>
              ) : (
                <p>Nenhum snapshot encontrado para este pedido.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Pendências</h2>
              <p>Estado operacional do pedido.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>Motivo</th>
                    <th>Última vez</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.operationalIssues.map((issue) => (
                    <tr key={String(issue.id)}>
                      <td>{String(issue.status)}</td>
                      <td>{String(issue.issue_type)}</td>
                      <td>{String(issue.reason)}</td>
                      <td>{formatDateTime(issue.last_seen_at)}</td>
                      <td>
                        {issue.status === "open" ? <ResolveIssueButton issueId={String(issue.id)} /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Eventos do processamento</h2>
              <p>Linha do tempo em `order_processing_events`.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Evento</th>
                    <th>Status</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.processingEvents.map((event, index) => (
                    <tr key={`${String(event.id ?? index)}-${String(event.event_time)}`}>
                      <td>{formatDateTime(event.event_time)}</td>
                      <td>{String(event.event_type)}</td>
                      <td>{String(event.status)}</td>
                      <td>{String(event.reason ?? "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Erros e payloads</h2>
              <p>Dados técnicos para diagnóstico rápido.</p>
            </div>
            <div className="panel__content stack">
              <div>
                <h3>Últimos erros</h3>
                <pre className="json-block">{jsonPreview(detail.integrationErrors)}</pre>
              </div>
              <div>
                <h3>Pickups</h3>
                <pre className="json-block">{jsonPreview(detail.pickups)}</pre>
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          <MutationForm
            action={`/api/orders/${branchCode}/${orderCode}/reprocess`}
            title="Reprocessar pedido"
            description="Enfileira novo processamento em dry-run. O envio real segue bloqueado nesta fase."
            submitLabel="Enfileirar dry-run"
            disabled={!detail.canReprocess}
            disabledMessage={detail.reprocessBlockReason}
            fields={[
              {
                name: "reason",
                label: "Motivo",
                defaultValue: "Reprocessamento solicitado pela interface operacional.",
              },
              {
                name: "requestedBy",
                label: "Solicitado por",
                defaultValue: "operator-ui",
              },
            ]}
          />

          <MutationForm
            action={`/api/orders/${branchCode}/${orderCode}/override`}
            title="Aplicar override"
            description="Correção manual auditada. Use patch JSON no formato do pedido salvo em `raw_order`."
            submitLabel="Salvar override"
            fields={[
              {
                name: "reason",
                label: "Motivo",
                defaultValue: "Correcao operacional via interface.",
              },
              {
                name: "createdBy",
                label: "Criado por",
                defaultValue: "operator-ui",
              },
              {
                name: "patch",
                label: "Patch JSON",
                type: "textarea",
                defaultValue:
                  '{\n  "shippingAddress": {\n    "postCode": "00000000",\n    "street": "RUA EXEMPLO",\n    "streetNumber": "123",\n    "neighborhood": "CENTRO",\n    "city": "SAO PAULO",\n    "state": "SP"\n  }\n}',
              },
            ]}
          />

          <section className="panel">
            <div className="panel__header">
              <h2>Histórico auxiliar</h2>
              <p>Overrides e reprocessamentos já registrados.</p>
            </div>
            <div className="panel__content stack">
              <div>
                <h3>Overrides</h3>
                <pre className="json-block">{jsonPreview(detail.orderOverrides)}</pre>
              </div>
              <div>
                <h3>Reprocessamentos</h3>
                <pre className="json-block">{jsonPreview(detail.reprocessRequests)}</pre>
              </div>
              <div>
                <h3>Tentativas</h3>
                <pre className="json-block">{jsonPreview(detail.reprocessAttempts)}</pre>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
