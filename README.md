# VoiceAI - AI Voice Agent Platform

An MVP platform for businesses to replace customer service agents with AI-powered voice agents. Think Bland AI - connect AI voice agents to your knowledge base and handle customer calls automatically.

## Features

- **Agent Management** - Create and configure multiple AI voice agents with custom personalities, greetings, and system prompts
- **Knowledge Base** - Add business information (FAQs, policies, pricing, hours) that agents use to answer questions
- **Demo Call Interface** - Test your agent with a simulated voice conversation (text-based chat that mimics a call)
- **Call Logs & Transcripts** - View all call history with full conversation transcripts
- **Analytics Dashboard** - Track call volume, sentiment analysis, resolution rates, and average duration
- **Voice & Model Config** - Choose voice (alloy, nova, etc.), language, AI model, and temperature
- **Human Handoff** - Configure transfer numbers for when AI can't handle a request

## Tech Stack

- **Frontend**: Next.js 16 + React + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite via Prisma ORM + better-sqlite3
- **AI Engine**: Pluggable - demo mode included, ready for OpenAI/Anthropic integration

## Getting Started

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Seed demo data (optional)
npx tsx prisma/seed.ts

# Start development server
npm run dev
```

Open http://localhost:3000

## Project Structure

```
src/
  app/
    page.tsx              # Dashboard with analytics
    agents/page.tsx       # Agent list & creation
    agents/[id]/page.tsx  # Agent config & knowledge base
    calls/page.tsx        # Call logs & transcripts
    demo/page.tsx         # Test call interface
    api/
      agents/             # CRUD for voice agents
      calls/              # Call log management
      demo-call/          # Simulated conversation engine
      analytics/          # Dashboard stats
  lib/
    prisma.ts             # Database client
    voice-engine.ts       # AI conversation logic
  components/
    shell.tsx             # Layout wrapper
    sidebar.tsx           # Navigation sidebar
prisma/
  schema.prisma           # Database schema
  seed.ts                 # Demo data seeder
```

## Production Roadmap

To take this from MVP to production, you'd integrate:

1. **Twilio** - For real phone number provisioning and call handling
2. **OpenAI Realtime API / Deepgram** - For speech-to-text and text-to-speech
3. **OpenAI / Anthropic** - For the actual LLM conversation (currently using demo responses)
4. **Auth** - Add user authentication (NextAuth.js / Clerk)
5. **Webhooks** - Twilio call status webhooks for real-time call management
