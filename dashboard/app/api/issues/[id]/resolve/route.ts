import { NextResponse } from "next/server";
import { resolveIssue } from "../../../../../lib/server/mutations";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { resolutionNote?: string };
    await resolveIssue(id, body.resolutionNote?.trim() || "Resolvido pela interface operacional.");

    return NextResponse.json({ message: "Pendência resolvida." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao resolver pendência." },
      { status: 400 },
    );
  }
}
