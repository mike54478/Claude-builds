import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const calls = await prisma.call.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { agent: { select: { name: true } }, _count: { select: { messages: true } } },
  });
  return NextResponse.json(calls);
}

export async function POST(req: Request) {
  const body = await req.json();
  const call = await prisma.call.create({
    data: {
      agentId: body.agentId,
      callerNumber: body.callerNumber,
      direction: body.direction || "inbound",
      status: "in-progress",
    },
  });
  return NextResponse.json(call, { status: 201 });
}
