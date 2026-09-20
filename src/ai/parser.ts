import { IncidentAnalysis, Severity } from '../types';

const VALID_SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'];

/**
 * Normalizes any string or casing to a valid Severity enum value.
 */
export function normalizeSeverity(val: unknown): Severity {
  if (typeof val !== 'string') return 'UNKNOWN';
  const upper = val.trim().toUpperCase();
  if (VALID_SEVERITIES.includes(upper as Severity)) {
    return upper as Severity;
  }
  if (upper.includes('CRIT') || upper.includes('SEV-1') || upper.includes('SEV-0') || upper.includes('P0')) return 'CRITICAL';
  if (upper.includes('HIGH') || upper.includes('SEV-2') || upper.includes('P1') || upper.includes('500')) return 'HIGH';
  if (upper.includes('MED') || upper.includes('SEV-3') || upper.includes('P2')) return 'MEDIUM';
  if (upper.includes('LOW') || upper.includes('SEV-4') || upper.includes('P3')) return 'LOW';
  return 'UNKNOWN';
}

/**
 * Extracts a JSON string substring from markdown blocks or outer braces.
 */
export function extractJsonCandidate(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '{}';

  // 1. Check for markdown code fence ```json ... ``` or ``` ... ```
  const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // 2. Find outermost curly braces { ... }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return rawText.substring(firstBrace, lastBrace + 1).trim();
  }

  return rawText.trim();
}

/**
 * Ensures an input value is an array of non-empty strings.
 */
function toStringArray(input: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(input)) {
    return input
      .map(item => (typeof item === 'string' ? item.trim() : String(item).trim()))
      .filter(item => item.length > 0);
  }
  if (typeof input === 'string' && input.trim()) {
    // If it's a newline-delimited or bulleted string
    return input
      .split('\n')
      .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  return fallback;
}

/**
 * Parses raw AI model output into a validated, typed IncidentAnalysis object.
 * Guaranteed never to throw; safely repairs or falls back if output is malformed.
 */
export function parseIncidentAnalysis(rawText: string, fallbackTitle = 'Production Incident'): IncidentAnalysis {
  const candidate = extractJsonCandidate(rawText);

  try {
    const parsed = JSON.parse(candidate);

    if (parsed && typeof parsed === 'object') {
      return {
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : fallbackTitle,
        severity: normalizeSeverity(parsed.severity),
        symptoms: toStringArray(parsed.symptoms, ['Unspecified production anomaly observed']),
        possibleRootCauses: toStringArray(parsed.possibleRootCauses, ['Under active investigation']),
        investigationSteps: toStringArray(parsed.investigationSteps, ['Collect application server logs', 'Inspect recent deployment diffs']),
        recommendedActions: toStringArray(parsed.recommendedActions, ['Evaluate rolling back the latest release']),
        followUpQuestions: toStringArray(parsed.followUpQuestions, ['What exact error codes are appearing in the logs?']),
        summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : 'Incident analysis initiated.'
      };
    }
  } catch (err) {
    // JSON parsing failed, construct resilient fallback from raw text heuristics
  }

  // Fallback heuristic extraction from raw text
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const detectedSeverity = normalizeSeverity(rawText);

  return {
    title: fallbackTitle,
    severity: detectedSeverity,
    symptoms: lines.filter(l => /symptom|error|fail|500|exception/i.test(l)).slice(0, 4),
    possibleRootCauses: lines.filter(l => /cause|deploy|timeout|database|exhaustion|leak/i.test(l)).slice(0, 4),
    investigationSteps: [
      'Inspect application error rates and deployment logs',
      'Verify database connection saturation and upstream latency'
    ],
    recommendedActions: [
      'Stabilize traffic (consider rollbacks or enabling rate limiters)',
      'Escalate to the relevant service on-call engineer'
    ],
    followUpQuestions: [
      'Can you provide the recent error log snippets or stack traces?',
      'Are other microservices experiencing elevated error rates or timeouts?'
    ],
    summary: rawText.length > 300 ? `${rawText.slice(0, 297)}...` : rawText || 'Incident analysis generated from available evidence.'
  };
}
