import React from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ListChecks,
  RefreshCw,
  SearchCheck,
  Wrench
} from 'lucide-react';
import { IncidentAnalysis, Severity } from '../types';

interface AnalysisPanelProps {
  analysis: IncidentAnalysis | null;
  onRunWorkflow: () => void;
  isAnalyzing: boolean;
}

function getSeverityBadge(sev: Severity) {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'HIGH':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
    case 'LOW':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    default:
      return 'bg-slate-700/30 text-slate-400 border-slate-700';
  }
}

export const IncidentAnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  onRunWorkflow,
  isAnalyzing
}) => {
  if (!analysis) {
    return (
      <div className="w-88 border-l border-slate-800 bg-slate-900/30 p-6 flex flex-col items-center justify-center text-center space-y-3 h-[calc(100vh-4rem)]">
        <Activity className="w-8 h-8 text-slate-600 animate-pulse" />
        <p className="text-xs text-slate-400 font-medium">Awaiting Incident Data</p>
        <p className="text-[11px] text-slate-500 max-w-xs">
          Provide incident symptoms in the chat stream to generate live SRE telemetry, root cause hypotheses, and remediation plans.
        </p>
      </div>
    );
  }

  return (
    <aside className="w-96 border-l border-slate-800 bg-slate-900/40 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-orange-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Live Analysis
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getSeverityBadge(
              analysis.severity
            )}`}
          >
            {analysis.severity}
          </span>
          <button
            onClick={onRunWorkflow}
            disabled={isAnalyzing}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Re-run deep workflow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Executive Summary */}
        <div className="rounded-lg bg-slate-950 border border-slate-800/80 p-3.5 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400">
            <AlertOctagon className="w-3.5 h-3.5 text-orange-400" />
            <span>Executive Synopsis</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {analysis.summary}
          </p>
        </div>

        {/* Observed Symptoms */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
            <ListChecks className="w-3.5 h-3.5 text-blue-400" />
            <span>Observed Symptoms</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.symptoms.map((symptom, idx) => (
              <li
                key={idx}
                className="flex items-start space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2 rounded-md border border-slate-800/60"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <span>{symptom}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Possible Root Causes */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
            <span>Hypothesized Causes</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.possibleRootCauses.map((cause, idx) => (
              <li
                key={idx}
                className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-md border border-slate-800/60 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-yellow-500/90 font-medium">
                    Hypothesis #{idx + 1}
                  </span>
                </div>
                <p className="leading-snug">{cause}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommended Actions */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>Remediation Actions</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.recommendedActions.map((action, idx) => (
              <li
                key={idx}
                className="flex items-start space-x-2 text-xs text-slate-300 bg-emerald-950/10 p-2 rounded-md border border-emerald-500/20"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Investigation Steps */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
            <SearchCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Investigation Checklist</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.investigationSteps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start space-x-2 text-xs text-slate-300 bg-slate-900/60 p-2 rounded-md border border-slate-800/60"
              >
                <ChevronRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Follow-up Questions */}
        {analysis.followUpQuestions && analysis.followUpQuestions.length > 0 && (
          <div className="space-y-2 pb-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Targeted Questions</span>
            </div>
            <ul className="space-y-1.5">
              {analysis.followUpQuestions.map((q, idx) => (
                <li
                  key={idx}
                  className="text-xs text-sky-200/90 bg-sky-950/20 p-2 rounded-md border border-sky-500/20 leading-relaxed"
                >
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
};
