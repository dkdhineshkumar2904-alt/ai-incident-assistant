import { describe, expect, it } from 'vitest';
import {
  extractJsonCandidate,
  normalizeSeverity,
  parseIncidentAnalysis
} from '../src/ai/parser';

describe('AI Parser & Schema Validator', () => {
  describe('normalizeSeverity', () => {
    it('normalizes standard uppercase strings', () => {
      expect(normalizeSeverity('CRITICAL')).toBe('CRITICAL');
      expect(normalizeSeverity('HIGH')).toBe('HIGH');
      expect(normalizeSeverity('MEDIUM')).toBe('MEDIUM');
      expect(normalizeSeverity('LOW')).toBe('LOW');
    });

    it('normalizes lowercase and whitespace', () => {
      expect(normalizeSeverity('  critical  ')).toBe('CRITICAL');
      expect(normalizeSeverity('high')).toBe('HIGH');
      expect(normalizeSeverity('medium')).toBe('MEDIUM');
      expect(normalizeSeverity('low')).toBe('LOW');
    });

    it('handles industry aliases like P0, SEV-1, etc.', () => {
      expect(normalizeSeverity('P0 outage')).toBe('CRITICAL');
      expect(normalizeSeverity('SEV-1')).toBe('CRITICAL');
      expect(normalizeSeverity('SEV-2 degradation')).toBe('HIGH');
      expect(normalizeSeverity('SEV-3')).toBe('MEDIUM');
      expect(normalizeSeverity('SEV-4')).toBe('LOW');
    });

    it('falls back to UNKNOWN for invalid input', () => {
      expect(normalizeSeverity('random string')).toBe('UNKNOWN');
      expect(normalizeSeverity(null)).toBe('UNKNOWN');
      expect(normalizeSeverity(undefined)).toBe('UNKNOWN');
    });
  });

  describe('extractJsonCandidate', () => {
    it('extracts JSON from standard markdown code fence', () => {
      const input = '```json\n{"title": "Test Incident", "severity": "HIGH"}\n```';
      const extracted = extractJsonCandidate(input);
      expect(extracted).toBe('{"title": "Test Incident", "severity": "HIGH"}');
    });

    it('extracts JSON from markdown code fence without language tag', () => {
      const input = '```\n{"title": "No Tag"}\n```';
      const extracted = extractJsonCandidate(input);
      expect(extracted).toBe('{"title": "No Tag"}');
    });

    it('extracts JSON surrounded by conversational text', () => {
      const input = 'Here is the analysis:\n{"title": "Wrapped"}\nLet me know if you need anything else.';
      const extracted = extractJsonCandidate(input);
      expect(extracted).toBe('{"title": "Wrapped"}');
    });

    it('handles empty or malformed strings without throwing', () => {
      expect(extractJsonCandidate('')).toBe('{}');
      expect(extractJsonCandidate(null as any)).toBe('{}');
    });
  });

  describe('parseIncidentAnalysis', () => {
    it('correctly parses a well-formed JSON analysis object', () => {
      const validJson = JSON.stringify({
        title: 'Payment Gateway 500 Spike',
        severity: 'CRITICAL',
        symptoms: ['HTTP 500 error rate at 18%', 'Checkout latency spike'],
        possibleRootCauses: ['Database pool exhaustion', 'Failed schema migration'],
        investigationSteps: ['Check database connection metrics', 'Inspect deployment diff'],
        recommendedActions: ['Rollback deployment to v1.2.3', 'Drain connection pool'],
        followUpQuestions: ['Are replica databases healthy?'],
        summary: 'Critical outage impacting payment completion post deployment.'
      });

      const result = parseIncidentAnalysis(validJson, 'Fallback Title');

      expect(result.title).toBe('Payment Gateway 500 Spike');
      expect(result.severity).toBe('CRITICAL');
      expect(result.symptoms).toHaveLength(2);
      expect(result.possibleRootCauses).toHaveLength(2);
      expect(result.investigationSteps).toHaveLength(2);
      expect(result.recommendedActions).toHaveLength(2);
      expect(result.followUpQuestions).toHaveLength(1);
      expect(result.summary).toContain('Critical outage impacting payment');
    });

    it('parses markdown-fenced JSON from real LLM response', () => {
      const llmOutput = `Here is the structured analysis of the incident:

\`\`\`json
{
  "title": "Stripe Webhook Timeout",
  "severity": "HIGH",
  "symptoms": ["Webhook HTTP 504 Gateway Timeout"],
  "possibleRootCauses": ["Upstream Stripe API rate limit"],
  "investigationSteps": ["Inspect nginx access logs"],
  "recommendedActions": ["Scale queue consumer workers"],
  "followUpQuestions": ["Is the webhook retry queue backing up?"],
  "summary": "Webhook processing is timing out due to slow downstream processing."
}
\`\`\`

I am standing by to assist with next steps.`;

      const result = parseIncidentAnalysis(llmOutput);

      expect(result.title).toBe('Stripe Webhook Timeout');
      expect(result.severity).toBe('HIGH');
      expect(result.symptoms[0]).toBe('Webhook HTTP 504 Gateway Timeout');
    });

    it('gracefully recovers from malformed/non-JSON model output using heuristics', () => {
      const garbageOutput = `The server is throwing 500 errors after deployment.
We suspect a database connection leak or timeout issue.
We recommend checking logs and rolling back immediately.`;

      const result = parseIncidentAnalysis(garbageOutput, 'Active Incident');

      expect(result.title).toBe('Active Incident');
      expect(result.severity).toBe('HIGH'); // Detected 500 keyword
      expect(result.investigationSteps.length).toBeGreaterThan(0);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.followUpQuestions.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });

    it('handles completely blank model output without crashing', () => {
      const result = parseIncidentAnalysis('', 'Fallback Title');

      expect(result.title).toBe('Fallback Title');
      expect(result.severity).toBe('UNKNOWN');
      expect(result.symptoms.length).toBeGreaterThan(0);
    });
  });
});
