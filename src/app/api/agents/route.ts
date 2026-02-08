import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { calls: true, knowledgeBase: true } } },
  });
  return NextResponse.json(agents);
}

export async function POST(req: Request) {
  const body = await req.json();
  const agent = await prisma.agent.create({
    data: {
      name: body.name || "New Agent",
      ...(body.greeting && { greeting: body.greeting }),
      ...(body.systemPrompt && { systemPrompt: body.systemPrompt }),
      ...(body.voice && { voice: body.voice }),
      ...(body.language && { language: body.language }),
      ...(body.model && { model: body.model }),
      ...(body.phoneNumber && { phoneNumber: body.phoneNumber }),
      ...(body.transferNumber && { transferNumber: body.transferNumber }),
    },
  });
  return NextResponse.json(agent, { status: 201 });
}
