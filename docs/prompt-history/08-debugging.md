# 08 - Debugging & Resolution Log

## Focus
Documenting errors encountered during TypeScript compilation, Vitest execution, and runtime conversational flow, and the exact architectural resolutions applied.

---

### Issue 1: Cloudflare Workflows `step.do` Return Type Serialization
- **Symptom**:
  ```text
  error TS2345: Argument of type '() => Promise<IncidentState>' is not assignable to parameter of type '(ctx: WorkflowStepContext) => Promise<Serializable<IncidentState>>'
  ```
- **Root Cause**: In `@cloudflare/workers-types` v5, `step.do` enforces recursive `Serializable<T>`. `ChatMessage.metadata?: Record<string, unknown>` permitted un-serializable primitives (like `Function` or `symbol`).
- **Fix**: Refined `ChatMessage.metadata` in `src/types/index.ts` to strictly allow serializable primitives:
  `Record<string, string | number | boolean | null | undefined>`. Added explicit type assertions to `step.do` return values in `src/workflows/IncidentAnalysisWorkflow.ts`.

---

### Issue 2: Vitest Node.js Runtime Resolution of `cloudflare:workers`
- **Symptom**:
  ```text
  Error: Cannot find package 'cloudflare:workers' imported from 'src/durable-object/IncidentDurableObject.ts'
  ```
- **Root Cause**: `cloudflare:workers` is a virtual builtin module provided by workerd/Cloudflare Edge runtime, unavailable in standard Node.js without an alias.
- **Fix**: Created `tests/mocks/cloudflare-workers.ts` providing typed shims for `DurableObject` and `WorkflowEntrypoint`. Configured an alias in `vitest.config.ts`:
  ```ts
  alias: {
    'cloudflare:workers': path.resolve(__dirname, './tests/mocks/cloudflare-workers.ts')
  }
  ```
  This enables sub-second test execution inside local Vitest runners without requiring heavy container or binary boot times.

---

### Issue 3: Heuristic Severity Detection for 500 Error Rates
- **Symptom**:
  `tests/ai-parser.test.ts` expected heuristic recovery for text mentioning "500 errors" to produce `HIGH` severity, but received `MEDIUM`.
- **Root Cause**: `normalizeSeverity` checked for `CRITICAL`, `HIGH`, `P0`, `SEV-1`, but did not include `'500'` in the `HIGH` severity detection regex.
- **Fix**: Updated `normalizeSeverity` in `src/ai/parser.ts` to include `upper.includes('500')`, appropriately classifying HTTP 500 errors as `HIGH` severity.

---

### Issue 4: Conversational Repetition & Ignored User Messages (OMS Latency Sequence)
- **Symptom**:
  When a user said *"Production API's are dead slow..."*, the AI asked for service name/telemetry. When the user answered *"oms"* or *"microservice name : oms"*, the assistant repeatedly produced the identical response asking for the service name again, effectively ignoring new user messages.
- **Root Cause**:
  1. **Local Dev Fallback**: In local development without live Cloudflare remote credentials, Workers AI binding (`env.AI`) errors with `Binding AI needs to be run remotely`, routing execution to `MockAIService`.
  2. **Stateless Fallback Template**: `MockAIService.chat` inspected only `messages[messages.length - 1]` with crude keyword filters (`500`, `db`). For any other input (like `"oms"` or `"microservice name : oms"`), it defaulted to a static fallback template asking for the service name, ignoring the entire conversation history and previously asked questions.
  3. **Llama 3 Multi-System Prompt Issue**: `formatChatContext` passed multiple consecutive `{ role: 'system' }` messages to the LLM, violating Llama 3 alternating turn requirements and causing prompt reset.
- **Fix**:
  1. Built an entity- and dialogue-aware conversation state engine in `MockAIService` that evaluates the full transcript, tracks user answers to previous assistant questions, extracts microservices (`OMS`, `payment`, etc.), and progresses triage logically without repeating previous assistant turns.
  2. Refactored `formatChatContext` in `src/ai/prompts.ts` to combine system instructions and incident context into a single system message, map internal system notifications into user turns, and merge consecutive turns of identical roles.
  3. Added explicit conversational continuity instructions to `SYSTEM_PROMPT_SENIOR_SRE`.
  4. Implemented all 7 required logging checkpoints in `src/index.ts` and `src/ai/ai-service.ts`.
  5. Added an automated end-to-end multi-turn test in `tests/api.test.ts` verifying that `"Production API is slow"` -> `"oms"` -> `"microservice name: oms"` yields three distinct, progressive responses incorporating OMS.
