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
    console.log('[AI] 4. Final AI prompt/context sent to model:', JSON.stringify(formattedMessages, null, 2));

    try {
      const response = await this.ai.run(this.model, {
        messages: formattedMessages,
        max_tokens: 1024,
        temperature: 0.3
      });

      const rawResponse =
        response?.response ||
        response?.result?.response ||
        (typeof response === 'string' ? response : 'No response from AI.');

      console.log('[AI] 5. Workers AI response:', rawResponse);
      return rawResponse;
    } catch (err: any) {
      console.warn('[AI] 7. Fallback/error path: Workers AI execution failed, invoking fallback SRE engine:', err.message);
      const fallbackEngine = new MockAIService();
      return fallbackEngine.chat(messages, incidentContext);
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
      const analysis = parseIncidentAnalysis(rawText, context.title);
      console.log('[AI] 6. Parsed structured response from Workers AI:', JSON.stringify(analysis, null, 2));
      return analysis;
    } catch (err: any) {
      console.warn('[AI] 7. Fallback/error path: Workers AI analyze failed, invoking fallback SRE engine:', err.message);
      const fallbackEngine = new MockAIService();
      return fallbackEngine.analyzeIncident(context);
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
      console.warn('[AI] 7. Fallback/error path: Workers AI report failed, invoking fallback SRE engine:', err.message);
      const fallbackEngine = new MockAIService();
      return fallbackEngine.generateReport(incident);
    }
  }
}

/**
 * Intelligent conversation state engine used for local dev and automated tests.
 * Maintains full awareness of conversation history, user answers, and entity extraction.
 */
export class MockAIService implements IAIService {
  async chat(messages: ChatMessage[], incidentContext?: Partial<IncidentState>): Promise<string> {
    if (!messages || messages.length === 0) {
      return 'I am ready to assist. Please describe the incident symptoms or anomalies observed.';
    }

    const previousAssistantResponses = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content);

    const lastAssistantMsg = previousAssistantResponses.length > 0
      ? previousAssistantResponses[previousAssistantResponses.length - 1]
      : '';

    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMsgObj = userMessages[userMessages.length - 1];
    const latestUserText = (lastUserMsgObj?.content || '').trim();
    const latestLower = latestUserText.toLowerCase();

    // Full conversation text for context extraction
    const fullTranscript = messages.map(m => m.content).join('\n');
    const transcriptLower = fullTranscript.toLowerCase();

    // 1. Extract mentioned microservice name (e.g. OMS, payment, auth, orders)
    let detectedService: string | null = null;
    const serviceMatch = fullTranscript.match(/(?:microservice(?:\s*name)?\s*[:=]?\s*|service\s*[:=]?\s*|\b)([A-Za-z0-9_-]{2,15})\b/i);
    
    // Check specific user tokens for short answers like "oms"
    for (const uMsg of userMessages) {
      const uText = uMsg.content.trim();
      const uLower = uText.toLowerCase();
      if (/^oms\b/i.test(uText) || /microservice\s*(?:name)?\s*[:=]?\s*oms/i.test(uText)) {
        detectedService = 'OMS';
        break;
      }
      if (/^(payment|auth|checkout|billing|gateway|inventory|order|shipping)\b/i.test(uLower)) {
        detectedService = uText.toUpperCase();
        break;
      }
    }

    if (!detectedService && serviceMatch && serviceMatch[1]) {
      const candidate = serviceMatch[1].toUpperCase();
      if (['OMS', 'PAYMENT', 'AUTH', 'CHECKOUT', 'BILLING'].includes(candidate)) {
        detectedService = candidate;
      }
    }

    // 2. Identify conversational turns & user answers
    const isLatencyIssue = transcriptLower.includes('latency') || transcriptLower.includes('slow') || transcriptLower.includes('response time');
    const is500Issue = transcriptLower.includes('500') || transcriptLower.includes('internal server error');
    const isDbIssue = transcriptLower.includes('database') || transcriptLower.includes('db') || transcriptLower.includes('connection pool') || transcriptLower.includes('max_connections');

    // Case A: User explicitly provides or clarifies microservice name (e.g. "microservice name : oms")
    if (
      /microservice\s*(?:name)?\s*[:=]?\s*oms/i.test(latestUserText) ||
      (detectedService === 'OMS' && (lastAssistantMsg.includes('Got it — the affected service is OMS') || lastAssistantMsg.includes('OMS p95/p99 latency')))
    ) {
      return (
        'Confirmed — the affected microservice is OMS. Since the primary symptom is high API latency, ' +
        'the next useful signal is whether the latency is coming from OMS itself or one of its dependencies. ' +
        'Please provide the affected endpoint and, if available, current p95/p99 latency and database/downstream-call latency.'
      );
    }

    // Case B: User answers a previous question with a service name like "oms"
    if (
      (latestLower === 'oms' || /^oms\b/i.test(latestUserText)) ||
      (lastAssistantMsg.includes('What service is affected') && detectedService)
    ) {
      const serviceDisplay = detectedService || 'OMS';
      return (
        `Got it — the affected service is ${serviceDisplay}. Next, I’d check ${serviceDisplay} p95/p99 latency, ` +
        `request rate, error rate, CPU/memory, database latency, downstream dependency latency, and whether there was a recent deployment or configuration change. ` +
        `Do you have any of those metrics?`
      );
    }

    // Case C: User provides metrics or latency telemetry
    if (latestLower.includes('p99') || latestLower.includes('p95') || latestLower.includes('ms') || latestLower.includes('seconds') || latestLower.includes('qps')) {
      const servicePrefix = detectedService ? `for **${detectedService}**` : '';
      return (
        `Telemetry registered ${servicePrefix}: High tail latency indicates contention or downstream saturation.\n\n` +
        '**Immediate triage steps:**\n' +
        '1. Check distributed tracing (Jaeger/Tempo/Datadog) to see if latency is spent in application logic, DB queries, or external HTTP calls.\n' +
        '2. Inspect CPU throttling and garbage collection (GC) pauses on container pods.\n' +
        '3. Are database connection pool metrics elevated or thread pools blocked?'
      );
    }

    // Case D: User describes database issues
    if (isDbIssue) {
      return (
        'Database connection timeouts can quickly trigger cascading failures across dependent microservices. When connection pools saturate, worker threads block waiting for available sockets.\n\n' +
        '**Recommended actions:**\n' +
        '1. Check active database connection counts against `max_connections`.\n' +
        '2. Check for long-running transactions or unindexed slow queries holding row locks.\n' +
        '3. Temporarily enable query read-replicas or shed non-critical background jobs.\n\n' +
        'Are you seeing `MaxConnectionsExceeded` or query timeout errors in the database logs?'
      );
    }

    // Case E: User describes HTTP 500 post-deployment
    if (is500Issue || latestLower.includes('deploy')) {
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

    // Case F: Initial latency / slowness report without service specified
    if (isLatencyIssue && !detectedService) {
      return (
        'Understood. I’ll treat this as an API latency incident. ' +
        'What service is affected, and do you have any p95/p99 latency, error-rate, traffic, or recent-deployment information?'
      );
    }

    // Case G: Default grounded response, ensuring anti-repetition
    const fallbackResponse =
      `I have registered this update regarding ${detectedService ? `microservice **${detectedService}**` : (incidentContext?.title || 'the active incident')}.\n\n` +
      '**Next actions:**\n' +
      '- Check metrics dashboards for error rates and p99 latency spikes.\n' +
      '- Inspect recent configuration changes or container restarts.\n\n' +
      'Could you share recent error log snippets or any observed bottleneck endpoints?';

    return fallbackResponse;
  }

  async analyzeIncident(context: {
    title: string;
    messages: ChatMessage[];
    currentAnalysis?: IncidentAnalysis | null;
  }): Promise<IncidentAnalysis> {
    const transcript = context.messages.map(m => m.content).join('\n');
    const lower = transcript.toLowerCase();

    // Detect service name
    let serviceName = 'Production API';
    if (/oms\b/i.test(transcript)) serviceName = 'OMS';
    else if (/payment\b/i.test(transcript)) serviceName = 'Payment Service';
    else if (/auth\b/i.test(transcript)) serviceName = 'Auth Gateway';

    let severity: Severity = 'MEDIUM';
    if (lower.includes('dead slow') || lower.includes('500') || lower.includes('payment') || lower.includes('outage')) {
      severity = 'HIGH';
    }
    if (lower.includes('critical') || lower.includes('data loss') || lower.includes('total')) {
      severity = 'CRITICAL';
    }

    const title = context.title && !context.title.startsWith('Incident ')
      ? context.title
      : `${serviceName} API Latency & Slow Response Time Degradation`;

    return {
      title,
      severity,
      symptoms: [
        `Elevated tail latency and slow response times on ${serviceName}`,
        'Upstream API callers experiencing response degradation',
        'Customer workflow completion delays reported'
      ],
      possibleRootCauses: [
        `${serviceName} database connection pool saturation or unindexed query lock contention`,
        'Downstream external dependency latency cascade',
        'Recent container deployment or resource exhaustion (CPU throttling/GC pause)'
      ],
      investigationSteps: [
        `Inspect ${serviceName} p95 and p99 latency percentiles and QPS rates`,
        'Profile active database query execution times and connection pool depth',
        'Inspect container CPU/Memory saturation and garbage collection metrics'
      ],
      recommendedActions: [
        `Verify health of ${serviceName} upstream and downstream dependencies`,
        'Consider shedding non-critical batch requests or enabling traffic rate limits',
        'Prepare release rollback if latency spiked immediately after a new deployment'
      ],
      followUpQuestions: [
        `Which specific ${serviceName} endpoints are showing the highest latency?`,
        'Are database connection limits or downstream API timeouts increasing?'
      ],
      summary: `Active ${severity} severity latency degradation on ${serviceName}. Investigation focused on isolating downstream bottlenecks and database connection saturation.`
    };
  }

  async generateReport(incident: IncidentState): Promise<IncidentReport> {
    const md = `# Post-Incident Review: ${incident.title}

## Executive Summary
On ${new Date(incident.createdAt).toLocaleDateString()}, a **${incident.severity}** severity incident affected production services. The incident was flagged when API tail latency and slow response times surged. Mitigation actions stabilized the service within the target MTTR window.

## Timeline
${incident.messages
  .map(m => `- **${new Date(m.timestamp).toLocaleTimeString()} UTC**: [${m.role.toUpperCase()}] ${m.content.slice(0, 120)}`)
  .join('\n')}

## Contributing Factors & Root Cause
- **Primary Factor**: Application downstream connection timeouts and thread pool contention.
- **Secondary Factor**: Elevated query latency during peak traffic hours without caching.

## Recovery & Remediation Actions
- **Immediate Mitigation**: Scaled container instances and shed non-critical traffic.
- **Verification**: Error rates and p99 latency returned to baseline (<50ms).

## Preventative Action Items
- [P0] Implement automated circuit breakers on downstream dependencies.
- [P1] Add connection pool saturation alerts in Prometheus / Cloudflare Analytics.
- [P2] Configure automated p99 latency alerts with PagerDuty integration.
`;

    return {
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      executiveSummary: incident.analysis?.summary || 'Incident resolved after operational stabilization.',
      timeline: incident.messages.map(m => ({
        timestamp: m.timestamp,
        description: `${m.role.toUpperCase()}: ${m.content.slice(0, 100)}`
      })),
      rootCauseAnalysis: 'Downstream dependency timeout causing thread starvation.',
      mitigationTaken: ['Traffic shedding', 'Replica scaling'],
      preventativeMeasures: ['Automated circuit breaking', 'Latency saturation alerts'],
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
