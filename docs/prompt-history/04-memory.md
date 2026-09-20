# 04 - Memory & State (Durable Objects)

## Prompt
> "Memory/state: Persist conversation/session state using an appropriate Cloudflare storage mechanism such as Durable Objects, D1, KV, or a combination. State: Durable Objects for per-incident conversation state/session memory... For each incident session store: incident ID, conversation messages, timestamps, incident metadata, latest analysis, generated report. The AI should be able to use previous messages when answering subsequent questions. Avoid sending an unlimited conversation history to the model. Implement a sensible context strategy."

## Purpose
Design a resilient, strongly-consistent per-incident state store using Cloudflare Durable Objects. Each incident session maps to its own Durable Object instance, eliminating distributed race conditions and providing sub-millisecond in-memory cache with persistent transactional storage (`this.ctx.storage`).

## Result
1. Created `src/durable-object/IncidentDurableObject.ts`:
   - Inherits modern `DurableObject` from `cloudflare:workers`.
   - Manages complete lifecycle: `initIncident`, `addMessage`, `getMessages`, `updateAnalysis`, `updateReport`, `updateMetadata`, `addWorkflowInstance`.
   - Dual interface support: Direct RPC methods for internal Worker calls, and standard HTTP `fetch` handler for REST-style subrequests.
   - Smart context windowing (`getContextForAI`): Preserves the root incident declaration message (message 0) while applying a sliding window over the last 9 messages to enforce a strict token ceiling for Workers AI.
2. Guaranteed atomic read-modify-write semantics per incident.

## Human Review
- Verified that conversation history survives worker restarts through Durable Object persistent storage.
- Confirmed that context truncation preserves the original user incident report, ensuring the AI never loses sight of the root symptom.
- Confirmed type safety across all RPC methods.
