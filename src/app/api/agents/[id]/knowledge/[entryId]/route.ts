import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { entryId } = await params;
  const body = await req.json();
  const entry = await prisma.knowledgeEntry.update({ where: { id: entryId }, data: body });
  return NextResponse.json(entry);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { entryId } = await params;
  await prisma.knowledgeEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
