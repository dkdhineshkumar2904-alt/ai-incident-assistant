import { DurableObject } from 'cloudflare:workers';
import {
  ChatMessage,
  Env,
  IncidentAnalysis,
  IncidentReport,
  IncidentState,
  IncidentStatus,
  MessageRole,
  Severity
} from '../types';

const STORAGE_KEY = 'incident_state';
const REGISTRY_KEY = 'incident_registry';
const MAX_CONTEXT_MESSAGES = 10;

export interface IncidentSummary {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: number;
  updatedAt: number;
}

export class IncidentDurableObject extends DurableObject<Env> {
  private stateCache: IncidentState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Registry method to list all registered incidents
   */
  async listAllIncidents(): Promise<IncidentSummary[]> {
    const list = await this.ctx.storage.get<IncidentSummary[]>(REGISTRY_KEY);
    return list || [];
  }

  /**
   * Registry method to record or update an incident summary
   */
  async recordIncidentSummary(summary: IncidentSummary): Promise<void> {
    const list = (await this.ctx.storage.get<IncidentSummary[]>(REGISTRY_KEY)) || [];
    const idx = list.findIndex(item => item.id === summary.id);
    if (idx >= 0) {
      list[idx] = summary;
    } else {
      list.unshift(summary);
    }
    await this.ctx.storage.put(REGISTRY_KEY, list);
  }

  private async loadState(): Promise<IncidentState | null> {
    if (this.stateCache) {
      return this.stateCache;
    }
    const saved = await this.ctx.storage.get<IncidentState>(STORAGE_KEY);
    if (saved) {
      this.stateCache = saved;
      return saved;
    }
    return null;
  }

  private async saveState(state: IncidentState): Promise<void> {
    this.stateCache = state;
    await this.ctx.storage.put(STORAGE_KEY, state);
  }

  /**
   * Initializes a new incident state in the Durable Object.
   */
  async initIncident(id: string, title?: string, initialDescription?: string): Promise<IncidentState> {
    const existing = await this.loadState();
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const initialMessages: ChatMessage[] = [];

    if (initialDescription && initialDescription.trim()) {
      initialMessages.push({
        id: crypto.randomUUID(),
        role: 'user',
        content: initialDescription.trim(),
        timestamp: now
      });
    }

    const state: IncidentState = {
      id,
      title: title?.trim() || initialDescription?.slice(0, 60)?.trim() || `Incident ${id.slice(0, 8)}`,
      status: 'INVESTIGATING',
      severity: 'UNKNOWN',
      createdAt: now,
      updatedAt: now,
      messages: initialMessages,
      analysis: null,
      report: null,
      workflowInstances: []
    };

    await this.saveState(state);
    return state;
  }

  /**
   * Returns current incident state.
   */
  async getState(): Promise<IncidentState | null> {
    return this.loadState();
  }

  /**
   * Appends a message to the incident conversation memory.
   */
  async addMessage(
    role: MessageRole,
    content: string,
    metadata?: ChatMessage['metadata']
  ): Promise<ChatMessage> {
    let state = await this.loadState();
    if (!state) {
      // Auto-initialize if message added before explicit init
      state = await this.initIncident(crypto.randomUUID());
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      metadata
    };

    state.messages.push(message);
    state.updatedAt = Date.now();
    await this.saveState(state);

    return message;
  }

  /**
   * Returns complete message history.
   */
  async getMessages(): Promise<ChatMessage[]> {
    const state = await this.loadState();
    return state ? state.messages : [];
  }

  /**
   * Updates the structured analysis and syncs severity if identified.
   */
  async updateAnalysis(analysis: IncidentAnalysis): Promise<IncidentState> {
    const state = await this.loadState();
    if (!state) {
      throw new Error('Incident not initialized');
    }

    state.analysis = analysis;
    if (analysis.severity && analysis.severity !== 'UNKNOWN') {
      state.severity = analysis.severity;
    }
    if (analysis.title && (!state.title || state.title.startsWith('Incident '))) {
      state.title = analysis.title;
    }
    state.updatedAt = Date.now();

    await this.saveState(state);
    return state;
  }

  /**
   * Updates the final generated incident report.
   */
  async updateReport(report: IncidentReport): Promise<IncidentState> {
    const state = await this.loadState();
    if (!state) {
      throw new Error('Incident not initialized');
    }

    state.report = report;
    state.status = 'IDENTIFIED';
    state.updatedAt = Date.now();

    await this.saveState(state);
    return state;
  }

  /**
   * Updates mutable incident metadata (status, severity, title).
   */
  async updateMetadata(updates: {
    title?: string;
    status?: IncidentStatus;
    severity?: Severity;
  }): Promise<IncidentState> {
    const state = await this.loadState();
    if (!state) {
      throw new Error('Incident not initialized');
    }

    if (updates.title) state.title = updates.title.trim();
    if (updates.status) state.status = updates.status;
    if (updates.severity) state.severity = updates.severity;
    state.updatedAt = Date.now();

    await this.saveState(state);
    return state;
  }

  /**
   * Registers a Cloudflare Workflow execution instance ID.
   */
  async addWorkflowInstance(instanceId: string): Promise<void> {
    const state = await this.loadState();
    if (state) {
      state.workflowInstances.push(instanceId);
      await this.saveState(state);
    }
  }

  /**
   * Returns a context window tailored for the LLM token budget.
   * Preserves early incident description while sliding the recent window.
   */
  async getContextForAI(): Promise<{
    title: string;
    messages: ChatMessage[];
    currentAnalysis: IncidentAnalysis | null;
  }> {
    const state = await this.loadState();
    if (!state) {
      return { title: 'New Incident', messages: [], currentAnalysis: null };
    }

    let budgetedMessages = state.messages;
    if (state.messages.length > MAX_CONTEXT_MESSAGES) {
      // Retain the very first user message (incident declaration) + the last (MAX_CONTEXT_MESSAGES - 1)
      const firstUserMsg = state.messages[0];
      const recentWindow = state.messages.slice(-(MAX_CONTEXT_MESSAGES - 1));
      budgetedMessages = [firstUserMsg, ...recentWindow];
    }

    return {
      title: state.title,
      messages: budgetedMessages,
      currentAnalysis: state.analysis
    };
  }

  /**
   * Standard HTTP fetch handler allowing subrequest RPC or REST interaction.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (request.method === 'GET' && pathname === '/state') {
        const state = await this.loadState();
        return Response.json({ success: true, data: state });
      }

      if (request.method === 'POST' && pathname === '/init') {
        const body = (await request.json()) as { id: string; title?: string; initialDescription?: string };
        const state = await this.initIncident(body.id, body.title, body.initialDescription);
        return Response.json({ success: true, data: state });
      }

      if (request.method === 'GET' && pathname === '/messages') {
        const messages = await this.getMessages();
        return Response.json({ success: true, data: messages });
      }

      if (request.method === 'POST' && pathname === '/messages') {
        const body = (await request.json()) as { role: MessageRole; content: string; metadata?: ChatMessage['metadata'] };
        const msg = await this.addMessage(body.role, body.content, body.metadata);
        return Response.json({ success: true, data: msg });
      }

      if (request.method === 'POST' && pathname === '/analysis') {
        const analysis = (await request.json()) as IncidentAnalysis;
        const state = await this.updateAnalysis(analysis);
        return Response.json({ success: true, data: state });
      }

      if (request.method === 'POST' && pathname === '/report') {
        const report = (await request.json()) as IncidentReport;
        const state = await this.updateReport(report);
        return Response.json({ success: true, data: state });
      }

      if (request.method === 'POST' && pathname === '/metadata') {
        const updates = (await request.json()) as { title?: string; status?: IncidentStatus; severity?: Severity };
        const state = await this.updateMetadata(updates);
        return Response.json({ success: true, data: state });
      }

      if (request.method === 'GET' && pathname === '/context') {
        const context = await this.getContextForAI();
        return Response.json({ success: true, data: context });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message || 'Internal DO error' }, { status: 500 });
    }
  }
}
