import {
  ChatMessage,
  Env,
  IncidentAnalysis,
  IncidentReport,
  IncidentState,
  Severity
} from '../types';
import {
  formatChatContext,
  formatReportPrompt,
  STRUCTURED_ANALYSIS_PROMPT,
  SYSTEM_PROMPT_SENIOR_SRE
} from './prompts';
import { parseIncidentAnalysis } from './parser';

export interface IAIService {
  chat(messages: ChatMessage[], incidentContext?: Partial<IncidentState>): Promise<string>;
  analyzeIncident(context: {
    title: string;
    messages: ChatMessage[];
    currentAnalysis?: IncidentAnalysis | null;
  }): Promise<IncidentAnalysis>;
  generateReport(incident: IncidentState): Promise<IncidentReport>;
}

export class WorkersAIService implements IAIService {
  private ai: any;
  private model: string;

  constructor(aiBinding: any, model = '@cf/meta/llama-3.3-70b-instruct') {
    this.ai = aiBinding;
    this.model = model;
  }

  async chat(messages: ChatMessage[], incidentContext?: Partial<IncidentState>): Promise<string> {
    const formattedMessages = formatChatContext(messages, incidentContext);

    try {
      const response = await this.ai.run(this.model, {
        messages: formattedMessages,
        max_tokens: 1024,
        temperature: 0.3
      });

      return response?.response || response?.result?.response || (typeof response === 'string' ? response : 'No response from AI.');
    } catch (err: any) {
      console.error('Workers AI chat error:', err);
      // Fallback model attempt if llama-3.3 encounters rate limit or is unavailable
      if (this.model.includes('llama-3.3')) {
        try {
          const fallbackModel = '@cf/meta/llama-3.1-70b-instruct';
          const fallbackRes = await this.ai.run(fallbackModel, {
            messages: formattedMessages,
            max_tokens: 1024,
            temperature: 0.3
          });
          return fallbackRes?.response || fallbackRes?.result?.response || 'Response generated from fallback model.';
        } catch (fbErr) {
          console.error('Fallback Workers AI error:', fbErr);
        }
      }
      throw new Error(`Workers AI chat execution failed: ${err.message || String(err)}`);
    }
  }

  async analyzeIncident(context: {
    title: string;
    messages: ChatMessage[];
    currentAnalysis?: IncidentAnalysis | null;
  }): Promise<IncidentAnalysis> {
    const systemPrompt = `${SYSTEM_PROMPT_SENIOR_SRE}\n\n${STRUCTURED_ANALYSIS_PROMPT}`;
    const transcript = context.messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n');

    const promptMessages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Incident Title: ${context.title}\n\nIncident Conversation Transcript:\n${transcript}\n\nGenerate structured incident assessment JSON:`
      }
    ];

    try {
      const response = await this.ai.run(this.model, {
        messages: promptMessages,
        max_tokens: 1200,
        temperature: 0.2
      });

      const rawText = response?.response || response?.result?.response || (typeof response === 'string' ? response : '');
      return parseIncidentAnalysis(rawText, context.title);
    } catch (err: any) {
      console.error('Workers AI analyzeIncident error:', err);
      // Construct fallback analysis so workflows do not abort completely
      return parseIncidentAnalysis('', context.title);
    }
  }

  async generateReport(incident: IncidentState): Promise<IncidentReport> {
    const prompt = formatReportPrompt(incident);

    const promptMessages = [
      { role: 'system', content: SYSTEM_PROMPT_SENIOR_SRE },
      { role: 'user', content: prompt }
    ];

    try {
      const response = await this.ai.run(this.model, {
        messages: promptMessages,
        max_tokens: 2048,
        temperature: 0.3
      });

      const rawMarkdown = response?.response || response?.result?.response || (typeof response === 'string' ? response : '');

      return {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        executiveSummary: incident.analysis?.summary || 'Executive summary not provided.',
        timeline: incident.messages.map(m => ({
          timestamp: m.timestamp,
          description: `${m.role.toUpperCase()}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`
        })),
        rootCauseAnalysis: incident.analysis?.possibleRootCauses.join('\n') || 'Under active investigation.',
        mitigationTaken: incident.analysis?.recommendedActions || ['Standard incident stabilization applied.'],
        preventativeMeasures: [
          'Add automated pre-release canary checks',
          'Improve circuit-breaker observability and alert thresholds',
          'Implement automated database connection pool monitoring'
        ],
        rawMarkdown: rawMarkdown || `# Post-Incident Review: ${incident.title}\n\n${incident.analysis?.summary || 'No report generated.'}`,
        generatedAt: Date.now()
      };
    } catch (err: any) {
      console.error('Workers AI generateReport error:', err);
      return {
        incidentId: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        executiveSummary: incident.analysis?.summary || 'Post-incident analysis unavailable.',
        timeline: [],
        rootCauseAnalysis: 'Report generation degraded.',
        mitigationTaken: [],
        preventativeMeasures: [],
        rawMarkdown: `# Incident Report: ${incident.title}\n\n*Report generation experienced an upstream error.*`,
        generatedAt: Date.now()
      };
    }
  }
}

export class MockAIService implements IAIService {
  async chat(messages: ChatMessage[], incidentContext?: Partial<IncidentState>): Promise<string> {
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';

    if (lastMsg.includes('500') || lastMsg.includes('deploy')) {
      return (
        "I'm tracking the HTTP 500 error spike following today's deployment. In distributed environments, post-deployment 500s typically point to missing environment variables, database schema drift, or connection pool exhaustion.\n\n" +
        '**Immediate triage steps:**\n' +
        '1. Check deployment logs for database migration failures or unhandled promise rejections.\n' +
        '2. Inspect server error logs for the specific stack trace.\n' +
        '3. If error rates exceed 5%, initiate an immediate rollback to the previous stable release artifact to restore availability while we investigate.\n\n' +
        '**Follow-up questions:**\n' +
        '- What exact exception or error code appears in the application logs?\n' +
        '- Did this deployment include database migrations or environment variable changes?'
      );
    }

    if (lastMsg.includes('db') || lastMsg.includes('database') || lastMsg.includes('timeout')) {
      return (
        'Database connection timeouts can quickly trigger cascading failures across dependent microservices. When connection pools saturate, worker threads block waiting for available sockets.\n\n' +
        '**Recommended actions:**\n' +
        '1. Check active database connection counts against `max_connections`.\n' +
        '2. Check for long-running transactions or unindexed slow queries holding row locks.\n' +
        '3. Temporarily enable query read-replicas or shedding non-critical batch workloads.\n\n' +
        'Are you seeing `MaxConnectionsExceeded` or query timeout errors in the telemetry?'
      );
    }

    return (
      `I have registered this update for incident **${incidentContext?.title || 'Active Incident'}**.\n\n` +
      'As a senior production engineer, my primary focus is maintaining availability and minimizing MTTR.\n\n' +
      '**Next actions:**\n' +
      '- Check metrics dashboards for error rates and p99 latency spikes.\n' +
      '- Review recent configuration and infrastructure changes.\n\n' +
      'Could you share the specific service name or any recent telemetry signals you have observed?'
    );
  }

  async analyzeIncident(context: {
    title: string;
    messages: ChatMessage[];
    currentAnalysis?: IncidentAnalysis | null;
  }): Promise<IncidentAnalysis> {
    const transcript = context.messages.map(m => m.content.toLowerCase()).join(' ');

    let severity: Severity = 'MEDIUM';
    if (transcript.includes('500') || transcript.includes('payment') || transcript.includes('outage')) {
      severity = 'HIGH';
    }
    if (transcript.includes('critical') || transcript.includes('data loss') || transcript.includes('total')) {
      severity = 'CRITICAL';
    }

    return {
      title: context.title || 'Production Service Degradation',
      severity,
      symptoms: [
        'HTTP 500 Internal Server Error rate spike',
        'Downstream API response latency elevation',
        'Customer checkout/workflow failures reported'
      ],
      possibleRootCauses: [
        'Missing environment configuration in newly deployed container',
        'Database connection pool exhaustion due to leaked transactions',
        'Incompatible ORM schema migration applied during release'
      ],
      investigationSteps: [
        'Check stderr / exception logs for stack traces matching the 500 errors',
        'Inspect database active connections, lock waits, and query latency',
        'Diff release config variables between previous stable release and current release'
      ],
      recommendedActions: [
        'Initiate canary/release rollback if customer impact exceeds 5 minutes',
        'Enable circuit breaking or shedding non-critical background jobs',
        'Scale worker replica count if CPU/Memory limits are saturated'
      ],
      followUpQuestions: [
        'What specific stack trace or exception is logged for the 500 errors?',
        'Did the deployment include schema migrations or new database queries?'
      ],
      summary: `High-priority incident affecting service availability following recent deployment. Immediate rollback recommended if root cause cannot be isolated within 10 minutes.`
    };
  }

  async generateReport(incident: IncidentState): Promise<IncidentReport> {
    const md = `# Post-Incident Review: ${incident.title}

## Executive Summary
On ${new Date(incident.createdAt).toLocaleDateString()}, a **${incident.severity}** severity incident affected production services. The incident was flagged when error rates surged following operational changes. Mitigation actions stabilized the service within the target MTTR window.

## Timeline
${incident.messages
  .map(m => `- **${new Date(m.timestamp).toLocaleTimeString()} UTC**: [${m.role.toUpperCase()}] ${m.content.slice(0, 120)}`)
  .join('\n')}

## Contributing Factors & Root Cause
- **Primary Factor**: Code deployment introduced unhandled exception under high-concurrency traffic.
- **Secondary Factor**: Downstream database connection limits were saturated by unpooled queries.

## Recovery & Remediation Actions
- **Immediate Mitigation**: Rolled back release to previous stable artifact.
- **Verification**: Error rates returned to baseline (<0.01%); p99 latency normalized to 45ms.

## Preventative Action Items
- [P0] Implement automated canary analysis with auto-rollback on elevated 5xx error rates.
- [P1] Add connection pool saturation alerts in Prometheus / Cloudflare Analytics.
- [P2] Update developer runbook for emergency traffic shedding.
`;

    return {
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      executiveSummary: incident.analysis?.summary || 'Incident resolved after operational rollback.',
      timeline: incident.messages.map(m => ({
        timestamp: m.timestamp,
        description: `${m.role.toUpperCase()}: ${m.content.slice(0, 100)}`
      })),
      rootCauseAnalysis: 'Post-deployment regression causing database pool starvation.',
      mitigationTaken: ['Release rollback', 'Traffic shedding'],
      preventativeMeasures: ['Automated canary gating', 'Database pool alerts'],
      rawMarkdown: md,
      generatedAt: Date.now()
    };
  }
}

/**
 * Factory creating the appropriate AI service implementation based on runtime environment.
 */
export function getAIService(env: Env): IAIService {
  if (env.AI && typeof env.AI.run === 'function') {
    const model = (env.AI_MODEL as string) || '@cf/meta/llama-3.3-70b-instruct';
    return new WorkersAIService(env.AI, model);
  }
  return new MockAIService();
}
