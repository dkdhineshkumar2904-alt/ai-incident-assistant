# 05 - Workflow & Orchestration (Cloudflare Workflows)

## Prompt
> "Workflow / coordination: Use Cloudflare Workers and/or Cloudflare Workflows... Cloudflare Workflows for longer-running incident-analysis coordination where appropriate. Workers can handle normal chat requests. Do NOT force Workflows into every simple chat request. Demonstrate a meaningful workflow such as: 1. receive incident, 2. classify incident, 3. analyze incident, 4. generate recommendations, 5. generate structured report, 6. persist final result."

## Purpose
Coordinate multi-step incident diagnosis using Cloudflare Workflows. Rather than blocking synchronous HTTP requests or risking worker CPU/wall-clock limits on heavy AI pipelines, Workflows provides stateful, retryable, step-based execution.

## Result
1. Created `src/workflows/IncidentAnalysisWorkflow.ts`:
   - Extends `WorkflowEntrypoint<Env, WorkflowParams>` from `cloudflare:workers`.
   - Organizes the incident analysis pipeline across 5 explicit, durable steps:
     - `step.do('fetch incident state')`: Reads session snapshot from the target `IncidentDurableObject`.
     - `step.do('classify incident')`: Computes incident category, severity tier, and blast radius.
     - `step.do('analyze incident')`: Invokes AI service with SRE heuristics to generate candidate root causes and investigation steps.
     - `step.do('generate recommendations and report')`: Constructs post-incident review (PIR) with 5-Whys and prioritized action items.
     - `step.do('persist final result')`: Commits analysis and report atomically back into the `IncidentDurableObject` and appends an informative system event message to the incident chat stream.
2. Fast conversational chat remains low-latency via Workers + Durable Objects, while deep triage runs reliably in the Workflow.

## Human Review
- Verified that Workflows execution is decoupled from synchronous chat, keeping UI responsive.
- Ensured step persistence handles retries automatically without duplicating side-effects.
- Confirmed type safety with `WorkflowParams` and `WorkflowResult`.
