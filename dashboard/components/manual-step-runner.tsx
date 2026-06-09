"use client";

import { CheckCircle2, Loader2, Play, RotateCcw, Terminal, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ManualStep, ManualStepRunResult } from "../lib/server/manual-steps";
import { cx } from "../lib/format";

interface ManualStepRunnerProps {
  steps: ManualStep[];
}

type StepState = Record<string, ManualStepRunResult | { error: string } | undefined>;

function formatDuration(value: number): string {
  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

function isRunResult(
  value: ManualStepRunResult | { error: string } | undefined,
): value is ManualStepRunResult {
  return Boolean(value && "ok" in value);
}

export function ManualStepRunner({ steps }: ManualStepRunnerProps) {
  const router = useRouter();
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const [results, setResults] = useState<StepState>({});

  async function runStep(stepId: string): Promise<void> {
    setRunningStepId(stepId);
    setResults((current) => ({
      ...current,
      [stepId]: undefined,
    }));

    try {
      const response = await fetch("/api/manual-steps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stepId }),
      });
      const data = (await response.json().catch(() => ({}))) as
        | ManualStepRunResult
        | { error?: string };

      if ("step" in data) {
        setResults((current) => ({
          ...current,
          [stepId]: data,
        }));

        router.refresh();
        return;
      }

      setResults((current) => ({
        ...current,
        [stepId]: {
          error: data.error ?? "Falha ao executar passo operacional.",
        },
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [stepId]: {
          error:
            error instanceof Error
              ? error.message
              : "Falha ao executar passo operacional.",
        },
      }));
    } finally {
      setRunningStepId(null);
    }
  }

  return (
    <div className="manual-step-grid">
      {steps.map((step, index) => {
        const result = results[step.id];
        const running = runningStepId === step.id;
        const anyRunning = Boolean(runningStepId);
        const succeeded = isRunResult(result) && result.ok;
        const failed = Boolean(result && (!isRunResult(result) || !result.ok));

        return (
          <section
            key={step.id}
            className={cx(
              "manual-step-card",
              `manual-step-card--${step.tone}`,
              succeeded && "manual-step-card--done",
              failed && "manual-step-card--failed",
            )}
          >
            <div className="manual-step-card__top">
              <span className="manual-step-card__index">{String(index + 1).padStart(2, "0")}</span>
              <span className="manual-step-card__status">
                {running ? (
                  <Loader2 size={18} />
                ) : succeeded ? (
                  <CheckCircle2 size={18} />
                ) : failed ? (
                  <XCircle size={18} />
                ) : (
                  <Terminal size={18} />
                )}
              </span>
            </div>

            <div className="manual-step-card__body">
              <h2>{step.title}</h2>
              <p>{step.description}</p>
              <code>{step.commandLabel}</code>
            </div>

            <div className="manual-step-card__actions">
              <button
                type="button"
                className="button button--primary"
                disabled={anyRunning}
                onClick={() => {
                  void runStep(step.id);
                }}
              >
                {running ? <Loader2 size={16} /> : result ? <RotateCcw size={16} /> : <Play size={16} />}
                {running ? "Executando..." : result ? "Executar novamente" : "Executar"}
              </button>

              {isRunResult(result) ? (
                <span className={cx("status-pill", result.ok ? "status-pill--success" : "status-pill--danger")}>
                  {result.ok ? "Concluido" : result.timedOut ? "Tempo esgotado" : `Saiu ${result.exitCode ?? "-"}`} em{" "}
                  {formatDuration(result.durationMs)}
                </span>
              ) : result ? (
                <span className="status-pill status-pill--danger">{result.error}</span>
              ) : null}
            </div>

            {isRunResult(result) && (result.stdout || result.stderr) ? (
              <div className="manual-step-card__result">
                {result.stdout ? (
                  <details open>
                    <summary>Saida</summary>
                    <pre>{result.stdout}</pre>
                  </details>
                ) : null}
                {result.stderr ? (
                  <details open={!result.ok}>
                    <summary>Erros</summary>
                    <pre>{result.stderr}</pre>
                  </details>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
