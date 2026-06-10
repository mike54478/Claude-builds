import { processDueRequests } from "@/lib/requests";

export const maxDuration = 300;

/** Scheduler tick (Vercel cron, every 5 min): send due review requests. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await processDueRequests(50);
  return Response.json(result);
}
