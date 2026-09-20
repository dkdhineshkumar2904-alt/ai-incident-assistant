import React, { useState } from 'react';
import { Flame, Sparkles, X } from 'lucide-react';

interface NewIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string) => void;
  isLoading: boolean;
}

const TEMPLATES = [
  {
    title: 'Payment API HTTP 500 Outage Post-Deployment',
    description: "Payment API started returning HTTP 500 errors after today's deployment at 14:00 UTC. Error rates spiked to 12% across checkout requests."
  },
  {
    title: 'PostgreSQL Connection Pool Exhaustion',
    description: 'Orders database is reporting MaxConnectionsExceeded. Worker pods are timing out with connection reset by peer.'
  },
  {
    title: 'Authentication Service High Latency & 504 Timeouts',
    description: 'Customer login gateway p99 latency jumped from 80ms to 4200ms. Upstream reverse proxy is dropping connections.'
  }
];

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isLoading) return;
    onCreate(title.trim(), description.trim());
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setTitle(t.title);
    setDescription(t.description);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              Declare New Production Incident
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Demo Templates */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Quick Scenario Templates:</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="text-left text-xs p-2 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition truncate"
              >
                <span className="text-orange-400 font-mono mr-1.5">[{idx + 1}]</span>
                <span>{tmpl.title}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Incident Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Payment API HTTP 500 Outage"
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Initial Incident Description & Symptoms <span className="text-orange-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what broke, recent deployments, observed error codes, or customer impact..."
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !description.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-orange-600 hover:bg-orange-500 text-white transition disabled:opacity-50"
            >
              {isLoading ? 'Starting Triage...' : 'Start Incident Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
