export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: {
    isWorkflowStatus?: boolean;
    suggestedSeverity?: Severity;
    [key: string]: string | number | boolean | null | undefined;
  };
}

export interface IncidentAnalysis {
  title: string;
  severity: Severity;
  symptoms: string[];
  possibleRootCauses: string[];
  investigationSteps: string[];
  recommendedActions: string[];
  followUpQuestions: string[];
  summary: string;
}

export interface TimelineEntry {
  timestamp: number;
  description: string;
}

export interface IncidentReport {
  incidentId: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  executiveSummary: string;
  timeline: TimelineEntry[];
  rootCauseAnalysis: string;
  mitigationTaken: string[];
  preventativeMeasures: string[];
  rawMarkdown: string;
  generatedAt: number;
}

export interface IncidentState {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  analysis: IncidentAnalysis | null;
  report: IncidentReport | null;
  workflowInstances: string[];
}

export interface CreateIncidentRequest {
  title?: string;
  initialDescription?: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface UpdateIncidentRequest {
  title?: string;
  status?: IncidentStatus;
  severity?: Severity;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface WorkflowParams {
  incidentId: string;
  triggerSource: 'user_action' | 'auto_triage';
  contextSnapshot?: {
    title: string;
    messages: ChatMessage[];
    currentSeverity: Severity;
  };
}

export interface WorkflowResult {
  incidentId: string;
  status: 'COMPLETED' | 'FAILED';
  classification?: {
    severity: Severity;
    category: string;
    blastRadius: string;
  };
  analysis?: IncidentAnalysis;
  report?: IncidentReport;
  error?: string;
  completedAt: number;
}

export interface Env {
  AI: any;
  INCIDENT_DO: DurableObjectNamespace;
  INCIDENT_WORKFLOW: any;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  AI_MODEL?: string;
  [key: string]: unknown;
}
