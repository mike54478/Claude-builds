// AI Voice Engine - handles conversation logic with LLM
// In production, this would integrate with OpenAI Realtime API / Deepgram / ElevenLabs

export interface ConversationContext {
  systemPrompt: string;
  greeting: string;
  knowledgeBase: { title: string; content: string; category: string }[];
  history: { role: string; content: string }[];
}

export function buildSystemPrompt(ctx: ConversationContext): string {
  let prompt = ctx.systemPrompt + "\n\n";

  if (ctx.knowledgeBase.length > 0) {
    prompt += "## Knowledge Base\nUse the following information to answer questions:\n\n";
    for (const entry of ctx.knowledgeBase) {
      prompt += `### ${entry.title} [${entry.category}]\n${entry.content}\n\n`;
    }
  }

  prompt += `## Rules
- Be conversational and natural, as this is a voice call
- Keep responses concise (1-3 sentences when possible)
- If you don't know something, say so honestly
- If the caller needs to speak to a human, offer to transfer them
- Never make up information not in your knowledge base
`;

  return prompt;
}

// Simulated AI response for demo mode (no API key needed)
export function generateDemoResponse(
  userMessage: string,
  ctx: ConversationContext
): string {
  const msg = userMessage.toLowerCase();

  // Check knowledge base for relevant answers
  for (const entry of ctx.knowledgeBase) {
    const keywords = entry.title.toLowerCase().split(" ");
    if (keywords.some((kw) => kw.length > 3 && msg.includes(kw))) {
      return entry.content.split(".").slice(0, 2).join(".") + ".";
    }
  }

  if (msg.includes("hour") || msg.includes("open") || msg.includes("time")) {
    return "Our business hours are Monday through Friday, 9 AM to 5 PM Eastern Time. Is there anything else I can help you with?";
  }
  if (msg.includes("price") || msg.includes("cost") || msg.includes("pricing")) {
    return "I'd be happy to help with pricing information. Could you let me know which specific product or service you're interested in?";
  }
  if (msg.includes("human") || msg.includes("agent") || msg.includes("transfer") || msg.includes("person")) {
    return "Of course, let me transfer you to one of our team members. Please hold for just a moment.";
  }
  if (msg.includes("thank")) {
    return "You're welcome! Is there anything else I can help you with today?";
  }
  if (msg.includes("bye") || msg.includes("goodbye")) {
    return "Thank you for calling! Have a wonderful day. Goodbye!";
  }
  if (msg.includes("help")) {
    return "I'm here to help! I can assist with product information, pricing, business hours, and general questions. What would you like to know?";
  }

  return "I understand. Let me see how I can help you with that. Could you provide a bit more detail about what you're looking for?";
}

// Analyze call sentiment
export function analyzeSentiment(messages: { role: string; content: string }[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const positiveWords = ["thank", "great", "perfect", "awesome", "excellent", "helpful", "good", "appreciate"];
  const negativeWords = ["frustrated", "angry", "terrible", "awful", "worst", "horrible", "unacceptable", "ridiculous"];

  const posCount = positiveWords.filter((w) => userMessages.includes(w)).length;
  const negCount = negativeWords.filter((w) => userMessages.includes(w)).length;

  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

// Generate call summary
export function generateSummary(messages: { role: string; content: string }[]): string {
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return "No conversation recorded.";
  if (userMessages.length === 1) return `Caller asked: "${userMessages[0].content}"`;
  return `Caller had ${userMessages.length} messages. Topics discussed: ${userMessages
    .slice(0, 3)
    .map((m) => m.content.slice(0, 50))
    .join("; ")}`;
}
