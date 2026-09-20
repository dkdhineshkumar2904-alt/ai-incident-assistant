import React, { useState } from 'react';
import {
  AlertCircle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-react';
import { IncidentSummary, Severity } from '../types';

interface SidebarProps {
  incidents: IncidentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

function getPill(sev: Severity) {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    case 'HIGH':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'LOW':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    default:
      return 'bg-slate-700/40 text-slate-400 border-slate-700';
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  incidents,
  selectedId,
  onSelect,
  onNew,
  onRefresh,
  isLoading
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = incidents.filter(inc =>
    inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inc.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span>Incident Sessions</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh incidents"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onNew}
              className="p-1 rounded text-orange-400 hover:text-orange-300 hover:bg-slate-800 transition"
              title="Create new incident"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter incidents..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
            <p className="text-xs">No incidents found.</p>
            <button
              onClick={onNew}
              className="text-xs text-orange-400 hover:text-orange-300 font-medium"
            >
              Start new incident
            </button>
          </div>
        ) : (
          filtered.map(inc => {
            const isSelected = inc.id === selectedId;
            return (
              <button
                key={inc.id}
                onClick={() => onSelect(inc.id)}
                className={`w-full text-left p-3.5 transition flex flex-col space-y-1.5 ${
                  isSelected
                    ? 'bg-orange-500/10 border-l-2 border-orange-500'
                    : 'hover:bg-slate-800/40 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getPill(
                      inc.severity
                    )}`}
                  >
                    {inc.severity}
                  </span>
                  <div className="flex items-center text-[10px] text-slate-500 space-x-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <p className="text-xs font-medium text-slate-200 line-clamp-2">
                  {inc.title}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                  <span>{inc.status}</span>
                  <span className="text-[10px] text-slate-600">
                    #{inc.id.slice(0, 8)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
