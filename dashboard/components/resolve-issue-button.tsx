"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResolveIssueButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="button button--ghost"
      disabled={pending}
      onClick={async () => {
        const resolutionNote = window.prompt(
          "Informe a nota de resolução desta pendência:",
          "Resolvido pela interface operacional.",
        );

        if (!resolutionNote) {
          return;
        }

        setPending(true);

        try {
          const response = await fetch(`/api/issues/${issueId}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resolutionNote }),
          });

          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) {
            throw new Error(data.error ?? "Falha ao resolver pendência.");
          }

          router.refresh();
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "Falha ao resolver pendência.");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Resolvendo..." : "Resolver"}
    </button>
  );
}
