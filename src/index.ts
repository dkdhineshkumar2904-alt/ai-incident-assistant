import {
  ApiResponse,
  CreateIncidentRequest,
  Env,
  IncidentAnalysis,
  IncidentReport,
  IncidentState,
  SendMessageRequest,
  WorkflowParams
} from './types';
import { getAIService } from './ai/ai-service';
import { IncidentDurableObject, IncidentSummary } from './durable-object/IncidentDurableObject';
import { IncidentAnalysisWorkflow } from './workflows/IncidentAnalysisWorkflow';

export { IncidentDurableObject, IncidentAnalysisWorkflow };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json'
};

function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse<ApiResponse>({ success: false, error: message }, status);
}

/**
 * Helper to get an IncidentDurableObject stub for a specific incident ID or registry.
 */
function getDOStub(env: Env, id: string): IncidentDurableObject {
  const doId = env.INCIDENT_DO.idFromName(id);
  return env.INCIDENT_DO.get(doId) as unknown as IncidentDurableObject;
}

/**
 * Updates the global registry with the latest incident status.
 */
async function syncRegistry(env: Env, state: IncidentState): Promise<void> {
  try {
    const registryStub = getDOStub(env, 'global_registry');
    const summary: IncidentSummary = {
      id: state.id,
      title: state.title,
      severity: state.severity,
      status: state.status,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt
    };
    await registryStub.recordIncidentSummary(summary);
  } catch (err) {
    console.warn('Failed to sync incident to registry:', err);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Route only /api/* requests; non-API requests are passed to static assets
    if (!pathname.startsWith('/api/')) {
      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
        // SPA fallback to index.html for client-side routing
        const spaRequest = new Request(new URL('/', request.url), request);
        return env.ASSETS.fetch(spaRequest);
      }
      return new Response('AI Incident Assistant Backend API is operational. Run frontend dev server for UI.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    try {
      // 1. POST /api/incidents - Create a new incident
      if (request.method === 'POST' && pathname === '/api/incidents') {
        const body = (await request.json().catch(() => ({}))) as CreateIncidentRequest;
        const incidentId = crypto.randomUUID();
        const stub = getDOStub(env, incidentId);

        let state = await stub.initIncident(incidentId, body.title, body.initialDescription);

        // If user initiated with an initial description, immediately process SRE response
        if (body.initialDescription && body.initialDescription.trim()) {
          const ai = getAIService(env);
          const aiReply = await ai.chat(state.messages, state);
          await stub.addMessage('assistant', aiReply);

          // Fast background initial analysis
          const quickAnalysis = await ai.analyzeIncident({
            title: state.title,
            messages: state.messages
          });
          state = await stub.updateAnalysis(quickAnalysis);
        }

        await syncRegistry(env, state);
        return jsonResponse<ApiResponse<IncidentState>>({ success: true, data: state }, 201);
      }

      // 2. GET /api/incidents - List all incidents
      if (request.method === 'GET' && pathname === '/api/incidents') {
        const registryStub = getDOStub(env, 'global_registry');
        const incidents = await registryStub.listAllIncidents();
        return jsonResponse<ApiResponse<IncidentSummary[]>>({ success: true, data: incidents });
      }

      // Match /api/incidents/:id and subroutes
      const incidentMatch = pathname.match(/^\/api\/incidents\/([a-zA-Z0-9_-]+)(?:\/(.*))?$/);
      if (!incidentMatch) {
        return errorResponse('Endpoint not found', 404);
      }

      const incidentId = incidentMatch[1];
      const subPath = incidentMatch[2] || '';
      const stub = getDOStub(env, incidentId);

      // 3. GET /api/incidents/:id - Get incident state
      if (request.method === 'GET' && subPath === '') {
        const state = await stub.getState();
        if (!state) {
          return errorResponse(`Incident ${incidentId} not found`, 404);
        }
        return jsonResponse<ApiResponse<IncidentState>>({ success: true, data: state });
      }

      // 4. GET /api/incidents/:id/messages - Get incident message history
      if (request.method === 'GET' && subPath === 'messages') {
        const messages = await stub.getMessages();
        return jsonResponse<ApiResponse>( { success: true, data: messages });
      }

      // 5. POST /api/incidents/:id/messages - Send message and get AI reply
      if (request.method === 'POST' && subPath === 'messages') {
        const body = (await request.json().catch(() => ({}))) as SendMessageRequest;
        if (!body.message || !body.message.trim()) {
          return errorResponse('Field "message" is required', 400);
        }

        console.log(`[API] 1. Received user message for incident ${incidentId}: "${body.message.trim()}"`);

        // Add user message to persistent DO
        const userMsg = await stub.addMessage('user', body.message.trim());
        const stateAfterUserMsg = await stub.getState();
        if (!stateAfterUserMsg) {
          return errorResponse('Incident state not found', 404);
        }
        console.log(`[DO] 2. Persisted conversation messages count: ${stateAfterUserMsg.messages.length}`);

        // Retrieve messages before AI generation
        const context = await stub.getContextForAI();
        console.log(`[DO] 3. Messages retrieved before AI generation:`, JSON.stringify(context.messages.map(m => ({ role: m.role, content: m.content }))));

        // Generate AI response using bounded context window
        const ai = getAIService(env);
        const aiReply = await ai.chat(context.messages, stateAfterUserMsg);

        // Add assistant message to DO
        const assistantMsg = await stub.addMessage('assistant', aiReply);

        // Fetch latest state containing both user and assistant turns for analysis
        const stateAfterAssistant = await stub.getState();
        const updatedAnalysis = await ai.analyzeIncident({
          title: stateAfterAssistant?.title || stateAfterUserMsg.title,
          messages: stateAfterAssistant?.messages || [...stateAfterUserMsg.messages, assistantMsg],
          currentAnalysis: stateAfterAssistant?.analysis || stateAfterUserMsg.analysis
        });
        console.log(`[API] 6. Parsed structured response:`, JSON.stringify(updatedAnalysis));

        const updatedState = await stub.updateAnalysis(updatedAnalysis);
        await syncRegistry(env, updatedState);

        return jsonResponse<ApiResponse>({
          success: true,
          data: {
            userMessage: userMsg,
            assistantMessage: assistantMsg,
            analysis: updatedState.analysis,
            state: updatedState
          }
        });
      }

      // 6. POST /api/incidents/:id/analyze - Trigger deep analysis / Workflow
      if (request.method === 'POST' && subPath === 'analyze') {
        const state = await stub.getState();
        if (!state) {
          return errorResponse('Incident not found', 404);
        }

        let workflowInstanceId: string | undefined;

        // Trigger Cloudflare Workflow if binding is active
        if (env.INCIDENT_WORKFLOW && typeof env.INCIDENT_WORKFLOW.create === 'function') {
          try {
            const instance = await env.INCIDENT_WORKFLOW.create({
              params: {
                incidentId,
                triggerSource: 'user_action'
              } satisfies WorkflowParams
            });
            workflowInstanceId = instance.id;
            if (workflowInstanceId) {
              await stub.addWorkflowInstance(workflowInstanceId);
            }
          } catch (wfErr) {
            console.warn('Cloudflare Workflow invocation warning:', wfErr);
          }
        }

        // Also perform immediate direct analysis so the client has immediate results
        const ai = getAIService(env);
        const analysis = await ai.analyzeIncident({
          title: state.title,
          messages: state.messages,
          currentAnalysis: state.analysis
        });
        const updatedState = await stub.updateAnalysis(analysis);
        await syncRegistry(env, updatedState);

        return jsonResponse<ApiResponse<{ analysis: IncidentAnalysis; workflowId?: string }>>({
          success: true,
          data: {
            analysis: updatedState.analysis || analysis,
            workflowId: workflowInstanceId
          }
        });
      }

      // 7. POST /api/incidents/:id/report - Generate post-incident review report
      if (request.method === 'POST' && subPath === 'report') {
        const state = await stub.getState();
        if (!state) {
          return errorResponse('Incident not found', 404);
        }

        const ai = getAIService(env);
        const report = await ai.generateReport(state);
        const updatedState = await stub.updateReport(report);
        await syncRegistry(env, updatedState);

        return jsonResponse<ApiResponse<IncidentReport>>({
          success: true,
          data: report
        });
      }

      // 8. GET /api/incidents/:id/workflow/:instanceId - Check workflow status
      const workflowMatch = subPath.match(/^workflow\/([a-zA-Z0-9_-]+)$/);
      if (request.method === 'GET' && workflowMatch) {
        const instanceId = workflowMatch[1];
        if (env.INCIDENT_WORKFLOW && typeof env.INCIDENT_WORKFLOW.get === 'function') {
          try {
            const instance = await env.INCIDENT_WORKFLOW.get(instanceId);
            const status = await instance.status();
            return jsonResponse<ApiResponse>({ success: true, data: status });
          } catch (err: any) {
            return errorResponse(`Failed to get workflow status: ${err.message}`, 500);
          }
        }
        return jsonResponse<ApiResponse>({
          success: true,
          data: { status: 'completed', instanceId, message: 'Direct analysis applied.' }
        });
      }

      return errorResponse('Endpoint not found', 404);
    } catch (err: any) {
      console.error('API Router unhandled error:', err);
      return jsonResponse<ApiResponse>({ success: false, error: err.message || 'Internal Server Error' }, 500);
    }
  }
};
