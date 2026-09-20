# 02 - Backend Architecture & HTTP API Router

## Prompt
> "Backend: Cloudflare Worker, TypeScript... Design clean endpoints such as:
> POST /api/incidents
> POST /api/incidents/:id/messages
> GET /api/incidents/:id
> GET /api/incidents/:id/messages
> POST /api/incidents/:id/analyze
> POST /api/incidents/:id/report
> Adjust the API design if your architecture requires something better.
> Use proper HTTP status codes and JSON responses...
> Build this as a real software project. Use TypeScript, clear module boundaries, input validation, error handling, async/await, typed API contracts, clean REST endpoints."

## Purpose
Implement a typed, high-performance edge HTTP router in Cloudflare Workers connecting incoming user requests to the `IncidentDurableObject`, `WorkersAIService`, and `IncidentAnalysisWorkflow`.

## Result
1. Created `src/types/index.ts`:
   - Strongly-typed domain models: `IncidentState`, `ChatMessage`, `IncidentAnalysis`, `IncidentReport`, `Severity`, `IncidentStatus`.
   - API request/response contracts: `CreateIncidentRequest`, `SendMessageRequest`, `ApiResponse<T>`, `WorkflowParams`, `WorkflowResult`.
2. Created `src/index.ts`:
   - Full CORS preflight handler (`OPTIONS`).
   - `POST /api/incidents`: Initializes an incident in a dedicated Durable Object and registers it in the global registry; if an initial description is provided, immediately generates first SRE guidance and analysis.
   - `GET /api/incidents`: Retrieves registered active/historical incidents.
   - `GET /api/incidents/:id`: Fetches complete incident state.
   - `GET /api/incidents/:id/messages`: Fetches chronological chat stream.
   - `POST /api/incidents/:id/messages`: Appends user message, feeds bounded context window to AI, appends assistant response, updates analysis asynchronously.
   - `POST /api/incidents/:id/analyze`: Dispatches the Cloudflare Workflow orchestration while computing immediate structured analysis for real-time UI feedback.
   - `POST /api/incidents/:id/report`: Generates finalized Post-Incident Review (PIR) report with timeline and preventative action items.
   - `GET /api/incidents/:id/workflow/:instanceId`: Polls status of running Cloudflare Workflow executions.
   - Serves frontend static assets via `env.ASSETS` with single-page app (SPA) fallback to `index.html`.
3. Exported `IncidentDurableObject` and `IncidentAnalysisWorkflow` for Wrangler bindings.

## Human Review
- Verified all endpoints adhere to REST conventions with appropriate 200, 201, 400, 404, and 500 status codes.
- Confirmed input validation protects against empty message bodies and invalid IDs.
- Ensured zero secret leakage in error responses.
