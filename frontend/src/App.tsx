import React, { useEffect, useState } from 'react';
import { api } from './services/api';
import { IncidentReport, IncidentState, IncidentSummary } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { IncidentAnalysisPanel } from './components/IncidentAnalysisPanel';
import { ReportModal } from './components/ReportModal';
import { NewIncidentModal } from './components/NewIncidentModal';
import { AlertTriangle, PlusCircle, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentIncident, setCurrentIncident] = useState<IncidentState | null>(null);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<IncidentReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchIncidents = async () => {
    try {
      setIsLoadingList(true);
      const list = await api.listIncidents();
      setIncidents(list);
      // Auto-select first incident if none selected and list not empty
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load incident list:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadIncident = async (id: string) => {
    try {
      const state = await api.getIncident(id);
      setCurrentIncident(state);
      setSelectedId(id);
      if (state.report) {
        setActiveReport(state.report);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to load incident ${id}: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadIncident(selectedId);
    }
  }, [selectedId]);

  const handleCreateIncident = async (title: string, description: string) => {
    try {
      setIsAnalyzing(true);
      const created = await api.createIncident({
        title: title || undefined,
        initialDescription: description
      });

      setIsNewModalOpen(false);
      await fetchIncidents();
      setSelectedId(created.id);
      setCurrentIncident(created);
    } catch (err: any) {
      setErrorMessage(`Failed to create incident: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (msg: string) => {
    if (!selectedId) return;

    try {
      setIsSendingMessage(true);
      // Optimistically append user message
      const tempUserMsg = {
        id: `temp-${Date.now()}`,
        role: 'user' as const,
        content: msg,
        timestamp: Date.now()
      };

      setCurrentIncident(prev =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, tempUserMsg]
            }
          : null
      );

      const response = await api.sendMessage(selectedId, msg);
      setCurrentIncident(response.state);
      // Refresh sidebar list in background to sync severity & titles
      fetchIncidents();
    } catch (err: any) {
      setErrorMessage(`Failed to send message: ${err.message}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!selectedId) return;

    try {
      setIsAnalyzing(true);
      const res = await api.triggerAnalysis(selectedId);
      setCurrentIncident(prev =>
        prev
          ? {
              ...prev,
              analysis: res.analysis,
              severity: res.analysis.severity
            }
          : null
      );
      fetchIncidents();
    } catch (err: any) {
      setErrorMessage(`Workflow analysis error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedId) return;

    try {
      setIsGeneratingReport(true);
      const report = await api.generateReport(selectedId);
      setActiveReport(report);
      setIsReportModalOpen(true);
      setCurrentIncident(prev => (prev ? { ...prev, report } : null));
    } catch (err: any) {
      setErrorMessage(`Report generation failed: ${err.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <Header
        incident={currentIncident}
        onNewIncident={() => setIsNewModalOpen(true)}
        onGenerateReport={handleGenerateReport}
        onTriggerAnalysis={handleTriggerAnalysis}
        isAnalyzing={isAnalyzing}
        isGeneratingReport={isGeneratingReport}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-2 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-white font-mono text-xs"
          >
            [dismiss]
          </button>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Sidebar Sessions */}
        <Sidebar
          incidents={incidents}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={() => setIsNewModalOpen(true)}
          onRefresh={fetchIncidents}
          isLoading={isLoadingList}
        />

        {/* Column 2: Center Incident Chat Stream */}
        {currentIncident ? (
          <ChatView
            incident={currentIncident}
            onSendMessage={handleSendMessage}
            isLoading={isSendingMessage}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-slate-950">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-100">No Incident Selected</h2>
              <p className="text-xs text-slate-400 max-w-sm">
                Select an existing incident from the sidebar, or initialize a new triage room to begin investigation.
              </p>
            </div>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Incident</span>
            </button>
          </div>
        )}

        {/* Column 3: Live Observability & Structured Analysis */}
        {currentIncident && (
          <IncidentAnalysisPanel
            analysis={currentIncident.analysis}
            onRunWorkflow={handleTriggerAnalysis}
            isAnalyzing={isAnalyzing}
          />
        )}
      </div>

      {/* Post-Incident Review Modal */}
      <ReportModal
        report={activeReport}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      {/* New Incident Starter Modal */}
      <NewIncidentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateIncident}
        isLoading={isAnalyzing}
      />
    </div>
  );
};
export default App;
