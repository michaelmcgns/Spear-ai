# Spear — AI Co-Pilot for High-Ticket Sales Teams

## What We're Building
An AI-powered sales co-pilot for any high-ticket sales team. It analyzes sales calls, profiles buyer psychology, predicts objections before they happen, and coaches agents in real time using NEPQ methodology and Cialdini's 6 principles of influence. First market: life insurance. Expansion: solar, real estate, SaaS, financial services, any phone-based high-ticket sale.

## Tech Stack
- Frontend: Next.js 14 App Router + TypeScript + Tailwind CSS
- Database: Supabase (Postgres + pgvector)
- AI: Claude API (claude-sonnet-4-6)
- Payments: Stripe
- Deployment: Vercel

## Core Features (Build Order)
1. Call transcription (upload audio → get transcript)
2. Psychology profiling (analyze transcript → buyer profile)
3. Objection prediction (flag likely objections)
4. Post-call coaching report (what to say differently next call)
5. Real-time dashboard (track all calls and deals)

## Target Customer
Sales team managers with 10-100+ agents doing high-ticket phone sales. $50-150/agent/month per seat.

## Rules
- Always use TypeScript
- Always use Tailwind for styling
- Keep components small and focused
- Comment all AI-related code clearly
