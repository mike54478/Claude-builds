import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await prisma.call.findUnique({
    where: { id },
    include: { messages: { orderBy: { timestamp: "asc" } }, agent: true },
  });
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(call);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const call = await prisma.call.update({ where: { id }, data: body });
  return NextResponse.json(call);
}
