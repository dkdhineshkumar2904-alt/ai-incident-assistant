import React from 'react';
import {
  FileText,
  GitPullRequest,
  PlusCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { IncidentState, Severity } from '../types';

interface HeaderProps {
  incident: IncidentState | null;
  onNewIncident: () => void;
  onGenerateReport: () => void;
  onTriggerAnalysis: () => void;
  isAnalyzing: boolean;
  isGeneratingReport: boolean;
}

function getSeverityBadge(sev: Severity) {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'HIGH':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    case 'MEDIUM':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    case 'LOW':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

export const Header: React.FC<HeaderProps> = ({
  incident,
  onNewIncident,
  onGenerateReport,
  onTriggerAnalysis,
  isAnalyzing,
  isGeneratingReport
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-white">
                Incident Assistant
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30">
                Cloudflare Edge
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
              {incident ? incident.title : 'No active incident session'}
            </p>
          </div>
        </div>

        {incident && (
          <div className="hidden md:flex items-center space-x-2 ml-4 pl-4 border-l border-slate-800">
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded border ${getSeverityBadge(
                incident.severity
              )}`}
            >
              {incident.severity}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {incident.status}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2.5">
        {incident && (
          <>
            <button
              onClick={onTriggerAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              title="Run Cloudflare Workflow 5-step incident analysis"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
              ) : (
                <GitPullRequest className="w-3.5 h-3.5 text-orange-400" />
              )}
              <span>{isAnalyzing ? 'Analyzing...' : 'Run Workflow'}</span>
            </button>

            <button
              onClick={onGenerateReport}
              disabled={isGeneratingReport}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              title="Generate Post-Incident Review"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>PIR Report</span>
            </button>
          </>
        )}

        <button
          onClick={onNewIncident}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Incident</span>
        </button>
      </div>
    </header>
  );
};
