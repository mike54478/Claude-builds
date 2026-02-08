import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDemoResponse, analyzeSentiment, generateSummary } from "@/lib/voice-engine";

// POST /api/demo-call - Simulate a full conversation turn
export async function POST(req: Request) {
  const { agentId, callId, userMessage } = await req.json();

  // Start a new call if no callId
  if (!callId) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { knowledgeBase: true },
    });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const call = await prisma.call.create({
      data: { agentId, direction: "inbound", status: "in-progress", callerNumber: "+1-555-DEMO" },
    });

    // Save greeting as first message
    await prisma.message.create({
      data: { callId: call.id, role: "assistant", content: agent.greeting },
    });

    return NextResponse.json({ callId: call.id, message: agent.greeting, status: "in-progress" });
  }

  // Continue existing call
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { agent: { include: { knowledgeBase: true } }, messages: { orderBy: { timestamp: "asc" } } },
  });
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  // Save user message
  await prisma.message.create({ data: { callId, role: "user", content: userMessage } });

  // Check for end-call triggers
  const isEnding = /\b(bye|goodbye|hang up|end call)\b/i.test(userMessage);

  // Generate AI response
  const ctx = {
    systemPrompt: call.agent.systemPrompt,
    greeting: call.agent.greeting,
    knowledgeBase: call.agent.knowledgeBase.map((k) => ({
      title: k.title,
      content: k.content,
      category: k.category,
    })),
    history: call.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  const aiResponse = generateDemoResponse(userMessage, ctx);

  // Save AI response
  await prisma.message.create({ data: { callId, role: "assistant", content: aiResponse } });

  if (isEnding) {
    const allMessages = [...call.messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }];
    await prisma.call.update({
      where: { id: callId },
      data: {
        status: "completed",
        endedAt: new Date(),
        duration: Math.floor((Date.now() - call.startedAt.getTime()) / 1000),
        sentiment: analyzeSentiment(allMessages),
        summary: generateSummary(allMessages),
        resolved: true,
      },
    });
    return NextResponse.json({ callId, message: aiResponse, status: "completed" });
  }

  return NextResponse.json({ callId, message: aiResponse, status: "in-progress" });
}
