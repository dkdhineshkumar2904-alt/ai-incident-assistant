import { describe, expect, it } from 'vitest';
import { IncidentDurableObject } from '../src/durable-object/IncidentDurableObject';
import { IncidentAnalysis, IncidentReport, MessageRole } from '../src/types';

// In-memory mock of Cloudflare DurableObjectState
function createMockDOContext() {
  const store = new Map<string, any>();
  return {
    ctx: {
      storage: {
        get: async (key: string) => store.get(key),
        put: async (key: string, value: any) => store.set(key, value),
        delete: async (key: string) => store.delete(key)
      }
    } as any,
    env: {
      AI: null,
      INCIDENT_DO: null as any,
      INCIDENT_WORKFLOW: null as any
    }
  };
}

describe('IncidentDurableObject Memory & State', () => {
  it('initializes a new incident with metadata and initial message', async () => {
    const { ctx, env } = createMockDOContext();
    const doInstance = new IncidentDurableObject(ctx, env);

    const incidentId = 'inc-12345';
    const state = await doInstance.initIncident(
      incidentId,
      'Payment API 500 Spike',
      'Payment API started returning HTTP 500 errors after today deployment.'
    );

    expect(state.id).toBe(incidentId);
    expect(state.title).toBe('Payment API 500 Spike');
    expect(state.status).toBe('INVESTIGATING');
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('user');
    expect(state.messages[0].content).toContain('HTTP 500 errors');
  });

  it('persists conversation messages in order', async () => {
    const { ctx, env } = createMockDOContext();
    const doInstance = new IncidentDurableObject(ctx, env);
    await doInstance.initIncident('inc-order');

    await doInstance.addMessage('user', 'Error rate is 15%');
    await doInstance.addMessage('assistant', 'Check database connection count.');
    await doInstance.addMessage('user', 'Max connections reached.');

    const messages = await doInstance.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('Error rate is 15%');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].content).toBe('Max connections reached.');
  });

  it('implements bounded context window for AI (preserves root symptom + sliding window)', async () => {
    const { ctx, env } = createMockDOContext();
    const doInstance = new IncidentDurableObject(ctx, env);
    await doInstance.initIncident('inc-context', 'Context Test', 'ORIGINAL INCIDENT DECLARATION: 500 errors');

    // Add 15 sequential messages to exceed MAX_CONTEXT_MESSAGES (10)
    for (let i = 1; i <= 15; i++) {
      await doInstance.addMessage((i % 2 === 0 ? 'assistant' : 'user') as MessageRole, `Message number ${i}`);
    }

    const fullMessages = await doInstance.getMessages();
    expect(fullMessages).toHaveLength(16); // 1 initial + 15 added

    const aiContext = await doInstance.getContextForAI();
    expect(aiContext.messages).toHaveLength(10);
    // Crucial requirement: The original incident declaration is retained
    expect(aiContext.messages[0].content).toContain('ORIGINAL INCIDENT DECLARATION');
    // And the end of the context window is the most recent message
    expect(aiContext.messages[aiContext.messages.length - 1].content).toBe('Message number 15');
  });

  it('updates structured analysis and updates severity', async () => {
    const { ctx, env } = createMockDOContext();
    const doInstance = new IncidentDurableObject(ctx, env);
    await doInstance.initIncident('inc-analysis');

    const analysis: IncidentAnalysis = {
      title: 'Database Pool Starvation',
      severity: 'HIGH',
      symptoms: ['HTTP 500', 'Connection timeout'],
      possibleRootCauses: ['Leaked connection in worker'],
      investigationSteps: ['Run pg_stat_activity'],
      recommendedActions: ['Restart container pool'],
      followUpQuestions: ['Are connections dropping?'],
      summary: 'High severity connection leak.'
    };

    const updatedState = await doInstance.updateAnalysis(analysis);
    expect(updatedState.severity).toBe('HIGH');
    expect(updatedState.analysis?.title).toBe('Database Pool Starvation');
  });

  it('updates and persists incident report', async () => {
    const { ctx, env } = createMockDOContext();
    const doInstance = new IncidentDurableObject(ctx, env);
    await doInstance.initIncident('inc-report');

    const report: IncidentReport = {
      incidentId: 'inc-report',
      title: 'Incident Review',
      severity: 'MEDIUM',
      status: 'IDENTIFIED',
      executiveSummary: 'Resolved via pool restart.',
      timeline: [{ timestamp: Date.now(), description: 'Identified' }],
      rootCauseAnalysis: 'Connection leak',
      mitigationTaken: ['Restarted pool'],
      preventativeMeasures: ['Add pool monitor'],
      rawMarkdown: '# Incident Review\nAll systems nominal.',
      generatedAt: Date.now()
    };

    const updatedState = await doInstance.updateReport(report);
    expect(updatedState.report?.rawMarkdown).toContain('All systems nominal.');
    expect(updatedState.status).toBe('IDENTIFIED');
  });

  it('manages incident registry summaries', async () => {
    const { ctx, env } = createMockDOContext();
    const registryInstance = new IncidentDurableObject(ctx, env);

    await registryInstance.recordIncidentSummary({
      id: 'inc-1',
      title: 'Incident One',
      severity: 'LOW',
      status: 'INVESTIGATING',
      createdAt: 1000,
      updatedAt: 1000
    });

    await registryInstance.recordIncidentSummary({
      id: 'inc-2',
      title: 'Incident Two',
      severity: 'CRITICAL',
      status: 'IDENTIFIED',
      createdAt: 2000,
      updatedAt: 2000
    });

    const list = await registryInstance.listAllIncidents();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('inc-2'); // Unshifted (newest first)
  });
});
