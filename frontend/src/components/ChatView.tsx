import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Cpu,
  Send,
  Sparkles,
  Terminal,
  User
} from 'lucide-react';
import { IncidentState } from '../types';

interface ChatViewProps {
  incident: IncidentState;
  onSendMessage: (msg: string) => void;
  isLoading: boolean;
}

const QUICK_PROMPTS = [
  "Payment API started returning HTTP 500 errors after today's deployment.",
  'What immediate database diagnostic queries should I run?',
  'What is the blast radius and customer impact of this failure?',
  'Provide a step-by-step safe rollback procedure.'
];

export const ChatView: React.FC<ChatViewProps> = ({
  incident,
  onSendMessage,
  isLoading
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [incident.messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-950">
      {/* Incident Mini Banner */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-active" />
          <span className="text-xs font-mono text-slate-300">
            Session Memory: {incident.messages.length} messages active in Durable Object
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Model: <span className="text-slate-400 font-semibold">Workers AI (Llama 3.3)</span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {incident.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">Incident Triage Room Ready</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Describe the symptoms, error messages, or anomalies observed in your systems. The AI SRE will formulate ranked hypotheses and remediation steps.
              </p>
            </div>
            <div className="pt-4 flex flex-wrap gap-2 justify-center max-w-lg">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(prompt)}
                  className="text-xs text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          incident.messages.map(msg => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="rounded-lg border border-orange-500/30 bg-orange-950/20 p-4 space-y-2 max-w-3xl mx-auto shadow-sm"
                >
                  <div className="flex items-center space-x-2 text-xs font-semibold text-orange-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Cloudflare Workflow System Event</span>
                    <span className="text-[10px] text-orange-500/70 font-mono ml-auto">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex space-x-3.5 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-orange-500/20 border border-orange-500/40 text-orange-400'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                </div>

                {/* Content Bubble */}
                <div
                  className={`flex-1 rounded-xl p-4 space-y-2 border text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600/10 border-blue-500/30 text-slate-100'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1.5">
                    <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                      {isUser ? 'On-Call Engineer' : 'Senior Production SRE'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition"
                        title="Copy text"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap leading-relaxed font-sans">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading / Typing Indicator */}
        {isLoading && (
          <div className="flex space-x-3.5 max-w-xl">
            <div className="w-7 h-7 rounded-md bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div className="rounded-xl p-3.5 bg-slate-900 border border-slate-800 text-xs flex items-center space-x-2 text-slate-400">
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                Senior SRE analyzing telemetry & state...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Fast Actions */}
      {incident.messages.length > 0 && (
        <div className="px-6 py-2 border-t border-slate-900 bg-slate-950/60 flex items-center space-x-2 overflow-x-auto text-[11px]">
          <span className="text-slate-500 font-medium whitespace-nowrap">Suggested:</span>
          {QUICK_PROMPTS.slice(1).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(prompt)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 whitespace-nowrap transition disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Describe symptoms, error logs, or ask investigation steps... (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 resize-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center self-end h-[46px]"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
