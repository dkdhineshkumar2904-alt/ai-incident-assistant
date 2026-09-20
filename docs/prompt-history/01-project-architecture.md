# 01 - Project Architecture & Setup

## Prompt
> "You are my senior full-stack/cloud engineer. I need you to build a complete, production-quality but appropriately scoped AI-powered application for a Cloudflare technical assignment...
> Build an 'AI Incident Assistant'...
> Frontend: React, TypeScript, Vite, Clean responsive chat UI.
> Backend: Cloudflare Worker, TypeScript.
> AI: Cloudflare Workers AI, Llama 3.3.
> State: Durable Objects for per-incident conversation state/session memory.
> Workflow: Cloudflare Workflows for longer-running incident-analysis coordination.
> Before you start implementing the project, I want to clarify the Git/GitHub setup... Set the Git remote origin to MY repository: https://github.com/dkdhineshkumar2904-alt/ai-incident-assistant..."

## Purpose
Establish the high-level architecture, select Cloudflare native primitives adhering to modern 2025/2026 standards, configure strict repository boundaries, and set up safe Git remote origin tracking under the user's personal GitHub account.

## Result
1. Inspected the local development environment: Node v24.21.0, npm 11.19.0, Wrangler 4.135.0, Git 2.51.0.
2. Formulated a 5-pillar Cloudflare native architecture:
   - **Cloudflare Worker**: Edge API gateway handling chat interactions and static assets.
   - **Cloudflare Durable Objects**: Strong consistency, isolated per-incident session memory and context truncation.
   - **Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct`)**: Domain-specialized Senior Production Engineer system prompts and structured output analysis.
   - **Cloudflare Workflows (`IncidentAnalysisWorkflow`)**: Multi-step, durable background orchestration (Classify -> Analyze -> Recommend -> Report -> Persist).
   - **React + Vite Frontend**: Responsive developer-oriented incident room with live telemetry panel and PIR generator.
3. Configured Git with the user's remote (`https://github.com/dkdhineshkumar2904-alt/ai-incident-assistant.git`) on branch `main` with strict `.gitignore` protection preventing credential leaks.

## Human Review
- Verified that remote origin points strictly to the user's own repository.
- Confirmed that Windows Credential Manager will not push automatically without the user's explicit authentication.
- Approved the implementation plan and single-repository structure.
