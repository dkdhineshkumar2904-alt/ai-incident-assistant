import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import {
  ChatMessage,
  Env,
  IncidentAnalysis,
  IncidentReport,
  IncidentState,
  Severity,
  WorkflowParams,
  WorkflowResult
} from '../types';
import { getAIService } from '../ai/ai-service';

export class IncidentAnalysisWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(
    event: WorkflowEvent<WorkflowParams>,
    step: WorkflowStep
  ): Promise<WorkflowResult> {
    const { incidentId, triggerSource } = event.payload;
    const ai = getAIService(this.env);

    // Step 1: Retrieve Incident State from Durable Object
    const incidentState = (await step.do('fetch incident state', async () => {
      const doId = this.env.INCIDENT_DO.idFromName(incidentId);
      const stub = this.env.INCIDENT_DO.get(doId);
      const state = (await (stub as any).getState()) as IncidentState | null;

      if (!state) {
        throw new Error(`Incident with ID ${incidentId} not found`);
      }
      return state as any;
    })) as IncidentState;

    // Step 2: Classify Incident Severity & Blast Radius
    const classification = (await step.do('classify incident', async () => {
      const transcript = incidentState.messages.map((m: ChatMessage) => m.content).join('\n');
      
      let severity: Severity = 'MEDIUM';
      let category = 'Application Performance Degradation';
      let blastRadius = 'Localized service impact';

      const lower = transcript.toLowerCase();
      if (lower.includes('payment') || lower.includes('checkout') || lower.includes('500') || lower.includes('outage')) {
        severity = 'HIGH';
        category = 'Critical Customer Path Failure';
        blastRadius = 'All active checkout/payment transactions';
      }
      if (lower.includes('total') || lower.includes('data loss') || lower.includes('database down') || lower.includes('unrecoverable')) {
        severity = 'CRITICAL';
        category = 'Complete Infrastructure Outage';
        blastRadius = 'Global service disruption';
      } else if (lower.includes('minor') || lower.includes('warning') || lower.includes('cosmetic')) {
        severity = 'LOW';
        category = 'Minor Telemetry Drift';
        blastRadius = 'Internal or non-blocking';
      }

      return { severity, category, blastRadius };
    })) as { severity: Severity; category: string; blastRadius: string };

    // Step 3: Analyze Incident & Formulate Hypotheses
    const analysis = (await step.do('analyze incident', async () => {
      const result = await ai.analyzeIncident({
        title: incidentState.title,
        messages: incidentState.messages,
        currentAnalysis: incidentState.analysis
      });

      // Override with classification severity if more specific
      if (classification.severity && (classification.severity as string) !== 'UNKNOWN') {
        result.severity = classification.severity;
      }
      return result as any;
    })) as IncidentAnalysis;

    // Step 4: Generate Recommendations & Structured Report
    const report = (await step.do('generate recommendations and report', async () => {
      const enrichedState: IncidentState = {
        ...incidentState,
        severity: analysis.severity,
        analysis
      };

      const generated = await ai.generateReport(enrichedState);
      return generated as any;
    })) as IncidentReport;

    // Step 5: Persist Final Result to Durable Object & Announce System Message
    await step.do('persist final result', async () => {
      const doId = this.env.INCIDENT_DO.idFromName(incidentId);
      const stub = this.env.INCIDENT_DO.get(doId);

      // Save structured analysis
      await (stub as any).updateAnalysis(analysis);

      // Save finalized report
      await (stub as any).updateReport(report);

      // Add system announcement into the conversation
      await (stub as any).addMessage(
        'system',
        `🚀 **Automated Incident Workflow Completed**\n\n` +
        `• **Severity Assessed**: \`${analysis.severity}\`\n` +
        `• **Classification**: ${classification.category} (${classification.blastRadius})\n` +
        `• **Primary Recommendation**: ${analysis.recommendedActions[0] || 'Monitor metrics'}\n\n` +
        `Structured post-incident review has been generated and attached to this session.`,
        { isWorkflowStatus: true, suggestedSeverity: analysis.severity }
      );
    });

    return {
      incidentId,
      status: 'COMPLETED',
      classification,
      analysis,
      report,
      completedAt: Date.now()
    };
  }
}
