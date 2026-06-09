"use client";

import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function QuickReprocessForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="quick-action-card quick-reprocess"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        setError(null);

        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          const response = await fetch("/api/reprocess-requests", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              branchCode: formData.get("branchCode"),
              orderCode: formData.get("orderCode"),
              reason: formData.get("reason"),
              requestedBy: "operator-ui",
            }),
          });
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            throw new Error(data.error ?? "Falha ao enfileirar pedido.");
          }

          setMessage(data.message ?? "Pedido enfileirado em dry-run.");
          router.refresh();
          form.reset();
        } catch (currentError) {
          setError(
            currentError instanceof Error
              ? currentError.message
              : "Falha inesperada.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="quick-action-card__icon quick-action-card__icon--warning">
        <RefreshCcw size={20} />
      </div>
      <div>
        <h3>Reprocessar pedido</h3>
        <p>Digite filial e pedido para enfileirar um dry-run manual.</p>
      </div>

      <div className="quick-reprocess__grid">
        <label className="field">
          <span>Filial</span>
          <input name="branchCode" inputMode="numeric" placeholder="313" required />
        </label>
        <label className="field">
          <span>Pedido</span>
          <input name="orderCode" inputMode="numeric" placeholder="506220" required />
        </label>
      </div>

      <label className="field">
        <span>Motivo</span>
        <input
          name="reason"
          defaultValue="Reprocessamento solicitado pela interface operacional."
          required
        />
      </label>

      <button type="submit" className="button button--primary" disabled={pending}>
        {pending ? "Enfileirando..." : "Enfileirar dry-run"}
      </button>

      {message ? <span className="feedback feedback--success">{message}</span> : null}
      {error ? <span className="feedback feedback--error">{error}</span> : null}
    </form>
  );
}
