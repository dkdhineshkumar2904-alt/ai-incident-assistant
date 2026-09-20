import {
  ChatMessage,
  IncidentAnalysis,
  IncidentReport,
  IncidentState,
  IncidentSummary
} from '../types';

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const data = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP error ${res.status}`);
  }

  return data.data as T;
}

export const api = {
  async createIncident(params: { title?: string; initialDescription?: string }): Promise<IncidentState> {
    return request<IncidentState>('/incidents', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async listIncidents(): Promise<IncidentSummary[]> {
    return request<IncidentSummary[]>('/incidents', { method: 'GET' });
  },

  async getIncident(id: string): Promise<IncidentState> {
    return request<IncidentState>(`/incidents/${id}`, { method: 'GET' });
  },

  async getMessages(id: string): Promise<ChatMessage[]> {
    return request<ChatMessage[]>(`/incidents/${id}/messages`, { method: 'GET' });
  },

  async sendMessage(
    id: string,
    message: string
  ): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    analysis: IncidentAnalysis;
    state: IncidentState;
  }> {
    return request<{
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      analysis: IncidentAnalysis;
      state: IncidentState;
    }>(`/incidents/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  async triggerAnalysis(id: string): Promise<{ analysis: IncidentAnalysis; workflowId?: string }> {
    return request<{ analysis: IncidentAnalysis; workflowId?: string }>(`/incidents/${id}/analyze`, {
      method: 'POST'
    });
  },

  async generateReport(id: string): Promise<IncidentReport> {
    return request<IncidentReport>(`/incidents/${id}/report`, {
      method: 'POST'
    });
  },

  async getWorkflowStatus(id: string, workflowId: string): Promise<any> {
    return request<any>(`/incidents/${id}/workflow/${workflowId}`, {
      method: 'GET'
    });
  }
};
