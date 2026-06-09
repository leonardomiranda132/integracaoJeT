"use client";

import { AlertTriangle, Clock, DatabaseZap, Loader2, PlayCircle, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cx } from "../lib/format";

interface OperationsControlPanelProps {
  actionsUrl: string;
  nextRunAt: string;
}

interface ActionResponse {
  ok?: boolean;
  message?: string;
  error?: string;
  actionsUrl?: string;
  dailySendLimit?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");

  return days > 0 ? `${days}d ${time}` : time;
}

function nextRunLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

async function postAction(path: string, body: Record<string, unknown>): Promise<ActionResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as ActionResponse;

  if (!response.ok) {
    return {
      error: data.error ?? "Falha ao executar acao operacional.",
    };
  }

  return data;
}

export function OperationsControlPanel({ actionsUrl, nextRunAt }: OperationsControlPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const [actionToken, setActionToken] = useState("");
  const [realConfirmation, setRealConfirmation] = useState("");
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [dailySendLimit, setDailySendLimit] = useState("");
  const [sendAll, setSendAll] = useState(true);
  const [runningAction, setRunningAction] = useState<"real-sync" | "cleanup" | null>(null);
  const [feedback, setFeedback] = useState<ActionResponse | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("operationsActionToken");
    if (stored) {
      setActionToken(stored);
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (actionToken) {
      window.localStorage.setItem("operationsActionToken", actionToken);
    }
  }, [actionToken]);

  const remaining = useMemo(
    () => formatRemaining(new Date(nextRunAt).getTime() - now),
    [nextRunAt, now],
  );
  const anyRunning = Boolean(runningAction);

  async function dispatchRealSync() {
    setRunningAction("real-sync");
    setFeedback(null);

    try {
      const result = await postAction("/api/admin/dispatch-real-sync", {
        actionToken,
        confirmation: realConfirmation,
        dailySendLimit: sendAll ? "" : dailySendLimit,
      });
      setFeedback(result);
    } finally {
      setRunningAction(null);
    }
  }

  async function cleanupDatabase() {
    setRunningAction("cleanup");
    setFeedback(null);

    try {
      const result = await postAction("/api/admin/cleanup-database", {
        actionToken,
        confirmation: cleanupConfirmation,
      });
      setFeedback(result);
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <section className="operations-panel">
      <div className="countdown-card">
        <div className="countdown-card__icon">
          <Clock size={24} />
        </div>
        <div>
          <div className="eyebrow">Proxima execucao automatica</div>
          <strong>{remaining}</strong>
          <span>{nextRunLabel(nextRunAt)} em Sao Paulo</span>
        </div>
      </div>

      <div className="operations-panel__forms">
        <label className="field operations-token-field">
          <span>Senha operacional</span>
          <input
            type="password"
            value={actionToken}
            onChange={(event) => setActionToken(event.target.value)}
            placeholder="Necessaria para acoes reais"
            autoComplete="current-password"
          />
        </label>

        <div className="operation-form">
          <div className="operation-form__header">
            <span className="quick-action-card__icon quick-action-card__icon--danger">
              <Send size={20} />
            </span>
            <div>
              <h2>Envio real para J&amp;T</h2>
              <p>Dispara o workflow do GitHub Actions com envio real habilitado.</p>
            </div>
          </div>

          <div className="operation-form__grid">
            <label className="field">
              <span>Limite</span>
              <input
                type="number"
                min="1"
                max="500"
                disabled={sendAll}
                value={dailySendLimit}
                onChange={(event) => setDailySendLimit(event.target.value)}
              />
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={sendAll}
                onChange={(event) => setSendAll(event.target.checked)}
              />
              Enviar todos
            </label>
            <label className="field operation-form__confirmation">
              <span>Confirmacao</span>
              <input
                value={realConfirmation}
                onChange={(event) => setRealConfirmation(event.target.value)}
                placeholder="Digite ENVIAR REAL"
              />
            </label>
          </div>

          <div className="inline-actions">
            <button
              type="button"
              className="button button--danger"
              disabled={anyRunning}
              onClick={() => {
                void dispatchRealSync();
              }}
            >
              {runningAction === "real-sync" ? <Loader2 size={16} /> : <PlayCircle size={16} />}
              Enviar para transportadora
            </button>
            <a className="button button--ghost" href={actionsUrl} target="_blank" rel="noreferrer">
              Abrir Actions
            </a>
          </div>
        </div>

        <div className="operation-form operation-form--muted">
          <div className="operation-form__header">
            <span className="quick-action-card__icon quick-action-card__icon--warning">
              <DatabaseZap size={20} />
            </span>
            <div>
              <h2>Limpeza operacional</h2>
              <p>Apaga lotes, pedidos, coletas, pendencias, eventos e fila do banco remoto.</p>
            </div>
          </div>

          <label className="field">
            <span>Confirmacao</span>
            <input
              value={cleanupConfirmation}
              onChange={(event) => setCleanupConfirmation(event.target.value)}
              placeholder="Digite LIMPAR BANCO"
            />
          </label>

          <button
            type="button"
            className="button button--warning"
            disabled={anyRunning}
            onClick={() => {
              void cleanupDatabase();
            }}
          >
            {runningAction === "cleanup" ? <Loader2 size={16} /> : <AlertTriangle size={16} />}
            Limpar dados do banco
          </button>
        </div>

        {feedback ? (
          <div
            className={cx(
              "operation-feedback",
              feedback.error ? "operation-feedback--danger" : "operation-feedback--success",
            )}
          >
            <strong>{feedback.error ? "Falha" : "Concluido"}</strong>
            <span>{feedback.error ?? feedback.message}</span>
            {feedback.dailySendLimit ? <span>Limite: {feedback.dailySendLimit}</span> : null}
            {feedback.actionsUrl ? (
              <a href={feedback.actionsUrl} target="_blank" rel="noreferrer">
                Ver workflow
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
