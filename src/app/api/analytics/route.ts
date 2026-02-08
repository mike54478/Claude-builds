import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [totalCalls, totalAgents, calls] = await Promise.all([
    prisma.call.count(),
    prisma.agent.count(),
    prisma.call.findMany({
      select: { duration: true, sentiment: true, resolved: true, cost: true, startedAt: true, status: true },
      orderBy: { startedAt: "desc" },
      take: 500,
    }),
  ]);

  const completedCalls = calls.filter((c) => c.status === "completed");
  const totalDuration = completedCalls.reduce((sum, c) => sum + c.duration, 0);
  const avgDuration = completedCalls.length ? Math.round(totalDuration / completedCalls.length) : 0;
  const resolutionRate = completedCalls.length
    ? Math.round((completedCalls.filter((c) => c.resolved).length / completedCalls.length) * 100)
    : 0;
  const totalCost = calls.reduce((sum, c) => sum + c.cost, 0);

  const sentimentBreakdown = {
    positive: completedCalls.filter((c) => c.sentiment === "positive").length,
    neutral: completedCalls.filter((c) => c.sentiment === "neutral").length,
    negative: completedCalls.filter((c) => c.sentiment === "negative").length,
  };

  // Calls per day for last 7 days
  const now = new Date();
  const dailyCalls = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const dayStr = date.toISOString().slice(0, 10);
    const count = calls.filter((c) => c.startedAt.toISOString().slice(0, 10) === dayStr).length;
    return { date: dayStr, calls: count };
  });

  return NextResponse.json({
    totalCalls,
    totalAgents,
    avgDuration,
    resolutionRate,
    totalCost: Math.round(totalCost * 100) / 100,
    sentimentBreakdown,
    dailyCalls,
  });
}
