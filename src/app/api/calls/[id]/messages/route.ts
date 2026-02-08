import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const message = await prisma.message.create({
    data: { callId: id, role: body.role, content: body.content },
  });
  return NextResponse.json(message, { status: 201 });
}
