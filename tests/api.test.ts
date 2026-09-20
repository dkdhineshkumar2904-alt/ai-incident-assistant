import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { IncidentDurableObject } from '../src/durable-object/IncidentDurableObject';
import { Env } from '../src/types';

function createMockEnvironment() {
  const objects = new Map<string, IncidentDurableObject>();

  const mockDO: any = {
    idFromName: (name: string) => ({ toString: () => name, name }),
    get: (idObj: any) => {
      const key = idObj.name || idObj.toString();
      if (!objects.has(key)) {
        const store = new Map<string, any>();
        const ctx: any = {
          storage: {
            get: async (k: string) => store.get(k),
            put: async (k: string, v: any) => store.set(k, v),
            delete: async (k: string) => store.delete(k)
          }
        };
        objects.set(key, new IncidentDurableObject(ctx, {} as any));
      }
      return objects.get(key);
    }
  };

  const env: Env = {
    AI: null, // Uses MockAIService fallback
    INCIDENT_DO: mockDO,
    INCIDENT_WORKFLOW: {
      create: async ({ params }: any) => ({ id: `wf-${Date.now()}` }),
      get: async (id: string) => ({ status: async () => ({ status: 'success', instanceId: id }) })
    }
  };

  const ctx: any = {
    waitUntil: (p: Promise<any>) => p,
    passThroughOnException: () => {}
  };

  return { env, ctx };
}

describe('Incident Assistant API Router', () => {
  it('handles CORS preflight OPTIONS requests', async () => {
    const { env, ctx } = createMockEnvironment();
    const req = new Request('http://localhost/api/incidents', { method: 'OPTIONS' });
    const res = await worker.fetch(req, env, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('creates an incident via POST /api/incidents with initial description and triggers AI triage', async () => {
    const { env, ctx } = createMockEnvironment();
    const req = new Request('http://localhost/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Payment 500 Outage',
        initialDescription: 'Payment API started returning HTTP 500 errors after today deployment.'
      })
    });

    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(201);

    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.title).toBe('Payment 500 Outage');
    expect(json.data.messages.length).toBeGreaterThanOrEqual(2); // user msg + assistant reply
    expect(json.data.messages[0].role).toBe('user');
    expect(json.data.messages[1].role).toBe('assistant');
    expect(json.data.analysis).toBeDefined();
  });

  it('rejects empty message on POST /api/incidents/:id/messages with HTTP 400', async () => {
    const { env, ctx } = createMockEnvironment();

    // Create an incident first
    const createReq = new Request('http://localhost/api/incidents', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Incident' })
    });
    const createRes = await worker.fetch(createReq, env, ctx);
    const incident = ((await createRes.json()) as any).data;

    // Send empty message
    const msgReq = new Request(`http://localhost/api/incidents/${incident.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });

    const msgRes = await worker.fetch(msgReq, env, ctx);
    expect(msgRes.status).toBe(400);
    const msgJson = (await msgRes.json()) as any;
    expect(msgJson.success).toBe(false);
    expect(msgJson.error).toContain('Field "message" is required');
  });

  it('successfully sends message and receives context-aware response', async () => {
    const { env, ctx } = createMockEnvironment();

    const createReq = new Request('http://localhost/api/incidents', {
      method: 'POST',
      body: JSON.stringify({ title: 'DB Outage' })
    });
    const createRes = await worker.fetch(createReq, env, ctx);
    const incident = ((await createRes.json()) as any).data;

    const msgReq = new Request(`http://localhost/api/incidents/${incident.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Database connection timeouts spiking on checkout service' })
    });

    const msgRes = await worker.fetch(msgReq, env, ctx);
    expect(msgRes.status).toBe(200);

    const msgJson = (await msgRes.json()) as any;
    expect(msgJson.success).toBe(true);
    expect(msgJson.data.userMessage.content).toContain('connection timeouts');
    expect(msgJson.data.assistantMessage.role).toBe('assistant');
    expect(msgJson.data.assistantMessage.content).toContain('connection');
  });

  it('triggers deep analysis via POST /api/incidents/:id/analyze', async () => {
    const { env, ctx } = createMockEnvironment();

    const createReq = new Request('http://localhost/api/incidents', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Critical Outage',
        initialDescription: 'Total outage on payment microservice'
      })
    });
    const createRes = await worker.fetch(createReq, env, ctx);
    const incident = ((await createRes.json()) as any).data;

    const analyzeReq = new Request(`http://localhost/api/incidents/${incident.id}/analyze`, {
      method: 'POST'
    });
    const analyzeRes = await worker.fetch(analyzeReq, env, ctx);
    expect(analyzeRes.status).toBe(200);

    const analyzeJson = (await analyzeRes.json()) as any;
    expect(analyzeJson.success).toBe(true);
    expect(analyzeJson.data.analysis.symptoms.length).toBeGreaterThan(0);
    expect(analyzeJson.data.analysis.possibleRootCauses.length).toBeGreaterThan(0);
  });

  it('generates a Post-Incident Review via POST /api/incidents/:id/report', async () => {
    const { env, ctx } = createMockEnvironment();

    const createReq = new Request('http://localhost/api/incidents', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Post-Mortem Test',
        initialDescription: 'Redis cache eviction caused upstream timeouts'
      })
    });
    const createRes = await worker.fetch(createReq, env, ctx);
    const incident = ((await createRes.json()) as any).data;

    const reportReq = new Request(`http://localhost/api/incidents/${incident.id}/report`, {
      method: 'POST'
    });
    const reportRes = await worker.fetch(reportReq, env, ctx);
    expect(reportRes.status).toBe(200);

    const reportJson = (await reportRes.json()) as any;
    expect(reportJson.success).toBe(true);
    expect(reportJson.data.rawMarkdown).toContain('# Post-Incident Review');
    expect(reportJson.data.preventativeMeasures.length).toBeGreaterThan(0);
  });

  it('handles multi-turn conversation sequence without repeating responses and incorporates newly provided entities (OMS sequence)', async () => {
    const { env, ctx } = createMockEnvironment();

    // 1. Create session
    const createReq = new Request('http://localhost/api/incidents', {
      method: 'POST',
      body: JSON.stringify({ title: 'API Performance Degradation' })
    });
    const createRes = await worker.fetch(createReq, env, ctx);
    const incident = ((await createRes.json()) as any).data;

    // Turn 1: User says "Production API is slow"
    const turn1Req = new Request(`http://localhost/api/incidents/${incident.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Production API is slow' })
    });
    const turn1Res = await worker.fetch(turn1Req, env, ctx);
    expect(turn1Res.status).toBe(200);
    const turn1Json = (await turn1Res.json()) as any;
    const reply1 = turn1Json.data.assistantMessage.content;
    expect(reply1).toContain('latency');
    expect(reply1).toContain('service');

    // Turn 2: User answers "oms"
    const turn2Req = new Request(`http://localhost/api/incidents/${incident.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'oms' })
    });
    const turn2Res = await worker.fetch(turn2Req, env, ctx);
    expect(turn2Res.status).toBe(200);
    const turn2Json = (await turn2Res.json()) as any;
    const reply2 = turn2Json.data.assistantMessage.content;

    // Crucial requirement: Reply 2 MUST NOT be identical to Reply 1
    expect(reply2).not.toBe(reply1);
    // Crucial requirement: Reply 2 acknowledges OMS
    expect(reply2).toContain('OMS');
    expect(reply2).toContain('affected service is OMS');

    // Turn 3: User clarifies "microservice name: oms"
    const turn3Req = new Request(`http://localhost/api/incidents/${incident.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'microservice name: oms' })
    });
    const turn3Res = await worker.fetch(turn3Req, env, ctx);
    expect(turn3Res.status).toBe(200);
    const turn3Json = (await turn3Res.json()) as any;
    const reply3 = turn3Json.data.assistantMessage.content;

    // Crucial requirement: All three responses must be distinct
    expect(reply3).not.toBe(reply1);
    expect(reply3).not.toBe(reply2);
    // Crucial requirement: Reply 3 incorporates confirmed microservice OMS and advances triage
    expect(reply3).toContain('microservice is OMS');
    expect(reply3).toContain('endpoint');

    // Verify conversation state contains all 6 turns in order
    const fullHistoryReq = new Request(`http://localhost/api/incidents/${incident.id}/messages`);
    const historyRes = await worker.fetch(fullHistoryReq, env, ctx);
    const historyJson = (await historyRes.json()) as any;
    expect(historyJson.data).toHaveLength(6);
    expect(historyJson.data[0].role).toBe('user');
    expect(historyJson.data[1].role).toBe('assistant');
    expect(historyJson.data[2].role).toBe('user');
    expect(historyJson.data[3].role).toBe('assistant');
    expect(historyJson.data[4].role).toBe('user');
    expect(historyJson.data[5].role).toBe('assistant');
  });

  it('returns 404 for unknown endpoints', async () => {
    const { env, ctx } = createMockEnvironment();
    const req = new Request('http://localhost/api/nonexistent-path');
    const res = await worker.fetch(req, env, ctx);
    expect(res.status).toBe(404);
  });
});
