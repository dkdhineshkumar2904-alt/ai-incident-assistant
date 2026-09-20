import { ChatMessage, IncidentAnalysis, IncidentState } from '../types';

export const SYSTEM_PROMPT_SENIOR_SRE = `You are a Senior Site Reliability & Production Incident Response Engineer assisting an on-call engineer with an active production incident.

OPERATING PRINCIPLES:
1. Grounded in Evidence: Analyze only the evidence provided by the user. NEVER pretend to have direct access to internal monitoring systems, VPCs, live server logs, or telemetry you cannot access.
2. Facts vs. Hypotheses: Always distinguish known facts (e.g. "deployment completed at 14:02 UTC", "HTTP 500 error rate spiked to 12%") from unverified hypotheses.
3. No Premature Root Cause Claims: Avoid declaring a definitive root cause unless concrete evidence proves it. Frame potential causes as ranked hypotheses with confidence levels.
4. Distributed Systems Thinking: Account for common distributed systems failure patterns:
   - Recent code/config deployments or feature flag toggles
   - Upstream/downstream cascading timeouts and retry storms
   - Database connection pool exhaustion, lock contention, slow queries
   - Circuit breakers tripping, poison pill queue messages, cache stampedes
   - Resource exhaustion (CPU throttling, OOM kills, file descriptor limits)
5. Actionable & Safe Guidance:
   - Provide concrete, non-destructive investigation commands or diagnostic queries.
   - Propose safe mitigation first (e.g., rollback, shedding non-critical load, rate limiting) to restore availability before deep root-cause debugging.
6. Targeted Inquiries: Ask at most 2-3 focused, high-yield diagnostic questions at a time to narrow down the problem quickly.
7. Tone & Style: Calm, professional, concise, structured, and razor-focused on rapid incident triage and mitigation.`;

export const STRUCTURED_ANALYSIS_PROMPT = `Analyze the current incident transcript and return a structured JSON assessment.
You MUST output ONLY a valid JSON object with NO surrounding conversational prose. Do not include introductory text like "Here is the analysis:".

JSON Schema:
{
  "title": "Concise, descriptive incident title (e.g. 'Payment API HTTP 500 Spike Post-Deployment v2.14')",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "symptoms": ["Observed symptom 1", "Observed symptom 2"],
  "possibleRootCauses": ["Ranked hypothesis 1 with rationale", "Ranked hypothesis 2 with rationale"],
  "investigationSteps": ["Step 1: check X", "Step 2: inspect Y"],
  "recommendedActions": ["Immediate mitigation 1", "Remediation step 2"],
  "followUpQuestions": ["Diagnostic question 1", "Diagnostic question 2"],
  "summary": "2-3 sentence executive synopsis of the incident state and blast radius"
}

Severity Guidelines:
- CRITICAL: Core user workflows down, widespread outage, data loss risk, direct revenue block.
- HIGH: Significant customer degradation, major service failure with no graceful fallback.
- MEDIUM: Partial degradation, elevated latency, localized impact, non-critical service affected.
- LOW: Minor anomaly, cosmetic issue, isolated edge-case with negligible business impact.`;

export function formatChatContext(
  messages: ChatMessage[],
  incidentContext?: Partial<IncidentState>
): Array<{ role: string; content: string }> {
  const formatted: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT_SENIOR_SRE }
  ];

  if (incidentContext) {
    let contextBanner = `[ACTIVE INCIDENT CONTEXT]\nIncident ID: ${incidentContext.id || 'N/A'}\nTitle: ${incidentContext.title || 'Untitled Incident'}\nCurrent Severity: ${incidentContext.severity || 'UNKNOWN'}\nStatus: ${incidentContext.status || 'INVESTIGATING'}`;
    
    if (incidentContext.analysis) {
      contextBanner += `\nIdentified Symptoms: ${incidentContext.analysis.symptoms.join(', ')}`;
      contextBanner += `\nLeading Hypotheses: ${incidentContext.analysis.possibleRootCauses.slice(0, 2).join('; ')}`;
    }
    
    formatted.push({
      role: 'system',
      content: contextBanner
    });
  }

  // Pass latest messages within token budget (last 10 messages)
  const recentMessages = messages.slice(-10);
  for (const msg of recentMessages) {
    formatted.push({
      role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    });
  }

  return formatted;
}

export function formatReportPrompt(incident: IncidentState): string {
  return `Generate a comprehensive, professional Post-Incident Review (PIR) report for this incident based on the timeline and analysis provided.

Incident Metadata:
- ID: ${incident.id}
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Created: ${new Date(incident.createdAt).toUTCString()}
- Updated: ${new Date(incident.updatedAt).toUTCString()}

Identified Symptoms:
${incident.analysis?.symptoms.map(s => `- ${s}`).join('\n') || '- None documented'}

Potential Root Causes:
${incident.analysis?.possibleRootCauses.map(r => `- ${r}`).join('\n') || '- Under investigation'}

Completed/Recommended Actions:
${incident.analysis?.recommendedActions.map(a => `- ${a}`).join('\n') || '- None documented'}

Full Conversation Log:
${incident.messages.map(m => `[${new Date(m.timestamp).toISOString()}] ${m.role.toUpperCase()}: ${m.content}`).join('\n')}

INSTRUCTIONS:
Provide a polished Post-Incident Review formatted in GitHub Markdown with:
1. Executive Summary
2. Impact & Blast Radius
3. Chronological Incident Timeline
4. Root Cause Analysis (5-Whys / Contributing Factors)
5. Resolution & Recovery Actions
6. Lessons Learned & Preventative Action Items (Action items with priority tags [P0]/[P1]/[P2])`;
}
