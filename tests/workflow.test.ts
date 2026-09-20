import { describe, expect, it } from 'vitest';
import { IncidentAnalysisWorkflow } from '../src/workflows/IncidentAnalysisWorkflow';
import { IncidentDurableObject } from '../src/durable-object/IncidentDurableObject';
import { Env, IncidentState, WorkflowParams } from '../src/types';

describe('IncidentAnalysisWorkflow 5-Step Pipeline', () => {
  it('executes the 5 steps sequentially and persists analysis & report to Durable Object', async () => {
    // 1. Setup mock storage for Durable Object
    const store = new Map<string, any>();
    const mockCtx: any = {
      storage: {
        get: async (k: string) => store.get(k),
        put: async (k: string, v: any) => store.set(k, v),
        delete: async (k: string) => store.delete(k)
      }
    };

    const incidentId = 'inc-wf-test';
    const doStub = new IncidentDurableObject(mockCtx, {} as any);
    await doStub.initIncident(
      incidentId,
      'Payment API 500 Outage',
      'Payment API started returning HTTP 500 errors after today deployment.'
    );

    const env: Env = {
      AI: null, // Uses MockAIService
      INCIDENT_DO: {
        idFromName: () => ({ toString: () => incidentId }),
        get: () => doStub as any
      } as any,
      INCIDENT_WORKFLOW: null as any
    };

    // 2. Mock Cloudflare Workflow execution step runner
    const executedSteps: string[] = [];
    const mockStepRunner: any = {
      do: async (stepName: string, fn: Function) => {
        executedSteps.push(stepName);
        return fn();
      }
    };

    const workflow = new IncidentAnalysisWorkflow({} as any, env);
    const event = {
      payload: {
        incidentId,
        triggerSource: 'user_action'
      } as WorkflowParams
    };

    // 3. Run Workflow
    const result = await workflow.run(event as any, mockStepRunner);

    // 4. Assert 5 distinct steps executed in order
    expect(executedSteps).toEqual([
      'fetch incident state',
      'classify incident',
      'analyze incident',
      'generate recommendations and report',
      'persist final result'
    ]);

    expect(result.status).toBe('COMPLETED');
    expect(result.classification?.severity).toBe('HIGH');
    expect(result.classification?.category).toContain('Customer Path Failure');
    expect(result.analysis?.symptoms.length).toBeGreaterThan(0);
    expect(result.report?.rawMarkdown).toContain('Post-Incident Review');

    // 5. Assert that DO state was updated with report, analysis, and system message
    const updatedState = await doStub.getState();
    expect(updatedState?.severity).toBe('HIGH');
    expect(updatedState?.analysis).toBeDefined();
    expect(updatedState?.report).toBeDefined();

    // Check system message added
    const messages = await doStub.getMessages();
    const systemMsg = messages.find(m => m.role === 'system');
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.content).toContain('Automated Incident Workflow Completed');
  });
});
