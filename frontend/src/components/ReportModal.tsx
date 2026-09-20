import React, { useState } from 'react';
import {
  Check,
  Code,
  Copy,
  Download,
  Eye,
  FileText,
  X
} from 'lucide-react';
import { IncidentReport } from '../types';

interface ReportModalProps {
  report: IncidentReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  report,
  isOpen,
  onClose
}) => {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !report) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(report.rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report.rawMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PIR-${report.incidentId.slice(0, 8)}-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Post-Incident Review (PIR)
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Incident #{report.incidentId.slice(0, 8)} • Severity: {report.severity}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 border border-slate-700 transition"
              title="Toggle raw Markdown"
            >
              {showRaw ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
              <span>{showRaw ? 'Formatted' : 'Raw Markdown'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 border border-slate-700 transition"
              title="Copy markdown to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1.5 border border-slate-700 transition"
              title="Download markdown file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .md</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {showRaw ? (
            <pre className="text-xs font-mono text-slate-200 bg-slate-950 p-4 rounded-lg border border-slate-800 whitespace-pre-wrap leading-relaxed">
              {report.rawMarkdown}
            </pre>
          ) : (
            <div className="space-y-6 text-xs text-slate-200 leading-relaxed font-sans">
              <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-lg space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Executive Summary
                </h4>
                <p className="text-slate-300">{report.executiveSummary}</p>
              </div>

              {/* Preventative Action Items */}
              {report.preventativeMeasures && report.preventativeMeasures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preventative Action Items
                  </h4>
                  <div className="space-y-1.5">
                    {report.preventativeMeasures.map((measure, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-md bg-emerald-950/15 border border-emerald-500/20 text-emerald-200 text-xs flex items-center space-x-2"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>{measure}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Markdown Report Rendering */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Full Report Transcript
                </h4>
                <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 text-xs whitespace-pre-wrap leading-relaxed font-mono text-slate-300">
                  {report.rawMarkdown}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
