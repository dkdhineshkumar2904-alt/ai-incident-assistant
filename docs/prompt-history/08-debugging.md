# 08 - Debugging & Resolution Log

## Focus
Documenting errors encountered during TypeScript compilation and Vitest execution, and the exact architectural resolutions applied.

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
