import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.resolve(__dirname, "../dev.db");
const adapter = new PrismaBetterSqlite3({ url: "file:" + dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  const agent = await prisma.agent.create({
    data: {
      name: "Customer Support Bot",
      greeting: "Hi there! Thanks for calling Acme Corp. I'm your AI assistant. How can I help you today?",
      systemPrompt: "You are a friendly customer support agent for Acme Corp, an e-commerce company. Help customers with orders, returns, product info, and general questions. Be empathetic, concise, and professional.",
      voice: "nova",
    },
  });

  await prisma.knowledgeEntry.createMany({
    data: [
      { agentId: agent.id, title: "Return Policy", content: "We offer 30-day returns on all items. Items must be in original packaging. Refunds are processed within 5-7 business days after we receive the returned item. Free return shipping is provided for defective items.", category: "policy" },
      { agentId: agent.id, title: "Business Hours", content: "Our customer service is available Monday through Friday, 9 AM to 6 PM Eastern Time. We are closed on weekends and major holidays. For urgent issues outside business hours, email support@acmecorp.com.", category: "hours" },
      { agentId: agent.id, title: "Shipping Information", content: "Standard shipping takes 5-7 business days and is free for orders over $50. Express shipping (2-3 days) is available for $12.99. Next-day shipping is available for $24.99. We ship to all 50 US states.", category: "general" },
      { agentId: agent.id, title: "Pricing Plans", content: "Starter plan is $29/month for up to 100 orders. Pro plan is $79/month for up to 1000 orders with priority support. Enterprise plan is custom pricing with dedicated account manager and SLA guarantees.", category: "pricing" },
      { agentId: agent.id, title: "Order Tracking", content: "You can track your order using the tracking number sent to your email. Go to our website and click 'Track Order' or visit the shipping carrier's website directly. Tracking updates may take 24 hours to appear.", category: "faq" },
    ],
  });

  console.log("Seed complete: Created agent with 5 knowledge base entries");
}

main().catch(console.error).finally(() => prisma.$disconnect());
