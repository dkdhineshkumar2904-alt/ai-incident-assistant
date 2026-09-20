# 03 - AI Integration (Workers AI & Llama 3.3)

## Prompt
> "AI: Cloudflare Workers AI with Llama 3.3... Keep the AI provider behind a small service abstraction so it can be replaced easily... Create a strong system prompt for the Incident Assistant. The assistant should: behave like a senior production engineer, analyze the evidence provided by the user, never pretend it has access to systems/logs it cannot access, clearly distinguish facts from hypotheses, avoid claiming a root cause without sufficient evidence, ask targeted follow-up questions, provide actionable troubleshooting steps, consider common distributed-system failure modes... Where possible, have the model produce structured JSON for incident analysis... Validate model output before sending it to the frontend. Gracefully handle malformed AI output."

## Purpose
Build an enterprise-grade AI integration layer that connects Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct`) with strict grounding in evidence, distributed systems reasoning, a pluggable `IAIService` abstraction, and resilient JSON extraction/repair for structured incident outputs.

## Result
1. Created `src/ai/prompts.ts`:
   - `SYSTEM_PROMPT_SENIOR_SRE`: SRE operating rules (evidence-first, facts vs hypotheses, safe mitigation over destructive commands, targeted 2-3 questions).
   - `STRUCTURED_ANALYSIS_PROMPT`: Schema instructions for `title`, `severity`, `symptoms`, `possibleRootCauses`, `investigationSteps`, `recommendedActions`, `followUpQuestions`, and `summary`.
   - `formatChatContext`: Smart token budget strategy passing system prompt, incident context header, and the last 10 messages.
   - `formatReportPrompt`: Generates structured markdown Post-Incident Reviews (PIR) with 5-Whys and prioritized action items ([P0]/[P1]/[P2]).
2. Created `src/ai/parser.ts`:
   - `extractJsonCandidate`: Removes markdown code fences (````json ... ````) or finds outermost JSON object braces.
   - `normalizeSeverity`: Normalizes severity variants (`P0`, `SEV-1`, `crit`) into canonical `LOW` | `MEDIUM` | `HIGH` | `CRITICAL` | `UNKNOWN`.
   - `parseIncidentAnalysis`: Defensive parser that never throws; repairs partial outputs or falls back to text heuristic extraction.
3. Created `src/ai/ai-service.ts`:
   - Defined `IAIService` contract.
   - Implemented `WorkersAIService` executing against `@cf/meta/llama-3.3-70b-instruct` with automatic fallback to `@cf/meta/llama-3.1-70b-instruct` upon model limits.
   - Implemented `MockAIService` with domain-aware SRE logic for reliable unit testing and offline development.
   - Provided `getAIService(env)` factory.

## Human Review
- Verified that Workers AI calls specify `temperature: 0.2-0.3` for deterministic and grounded analysis.
- Confirmed parser handles raw markdown wrappers and never crashes on invalid JSON.
- Ensured context formatting limits the message count to avoid exceeding LLM context windows.
