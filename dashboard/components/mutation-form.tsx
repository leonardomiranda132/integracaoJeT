"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface MutationFormProps {
  action: string;
  fields: Array<{
    name: string;
    label: string;
    type?: "text" | "textarea";
    defaultValue?: string;
    placeholder?: string;
  }>;
  submitLabel: string;
  title: string;
  description: string;
  disabled?: boolean;
  disabledMessage?: string | null;
}

export function MutationForm({
  action,
  fields,
  submitLabel,
  title,
  description,
  disabled = false,
  disabledMessage,
}: MutationFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel form-panel"
      onSubmit={async (event) => {
        if (disabled) {
          return;
        }
        event.preventDefault();
        setPending(true);
        setError(null);
        setMessage(null);

        const formData = new FormData(event.currentTarget);
        const body = Object.fromEntries(formData.entries());

        try {
          const response = await fetch(action, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

          if (!response.ok) {
            throw new Error(data.error ?? "Falha ao executar a ação.");
          }

          setMessage(data.message ?? "Ação concluída.");
          router.refresh();
          event.currentTarget.reset();
        } catch (currentError) {
          setError(currentError instanceof Error ? currentError.message : "Falha inesperada.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="panel__header">
        <h3>{title}</h3>
        <p>{description}</p>
        {disabled && disabledMessage ? (
          <p className="feedback feedback--error">{disabledMessage}</p>
        ) : null}
      </div>

      <div className="form-grid">
        {fields.map((field) => (
          <label key={field.name} className="field">
            <span>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                name={field.name}
                defaultValue={field.defaultValue}
                placeholder={field.placeholder}
                rows={6}
                required
                disabled={disabled}
              />
            ) : (
              <input
                name={field.name}
                type="text"
                defaultValue={field.defaultValue}
                placeholder={field.placeholder}
                required
                disabled={disabled}
              />
            )}
          </label>
        ))}
      </div>

      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={pending || disabled}>
          {disabled ? "Bloqueado" : pending ? "Processando..." : submitLabel}
        </button>
        {message ? <span className="feedback feedback--success">{message}</span> : null}
        {error ? <span className="feedback feedback--error">{error}</span> : null}
      </div>
    </form>
  );
}
