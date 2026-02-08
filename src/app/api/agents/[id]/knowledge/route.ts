import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entries = await prisma.knowledgeEntry.findMany({
    where: { agentId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const entry = await prisma.knowledgeEntry.create({
    data: { agentId: id, title: body.title, content: body.content, category: body.category || "general" },
  });
  return NextResponse.json(entry, { status: 201 });
}
