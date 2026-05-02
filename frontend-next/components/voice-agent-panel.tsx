'use client';

import { useEffect, useRef } from 'react';
import {
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Wand2,
  X,
} from 'lucide-react';
import {
  useVoiceAgent,
  type VoiceAgentState,
} from '@/hooks/use-voice-agent';

/**
 * VoiceAgentPanel — the chat-style UI for the live Deepgram voice advisor.
 *
 * Lives inline in the AI tab so the user can see the existing dashboard
 * (allocation, holdings, etc) while talking. Re-renders on every transcript
 * delta and tool-call event from `useVoiceAgent`.
 *
 * Mutating tools (rebalance, contribute, create_goal, mark_alerts_read) fire
 * the `onAction` callback so the parent can refresh whatever data changed.
 */

interface VoiceAgentPanelProps {
  className?: string;
  /** Called when a state-mutating tool finishes (rebalance, contribute, etc).
   *  Use this to refresh the host page's portfolio data. */
  onAction?: (toolName: string, result: unknown) => void;
}

const STATE_COPY: Record<VoiceAgentState, { label: string; tone: string }> = {
  idle: { label: 'Ready', tone: 'text-gray-500' },
  connecting: { label: 'Connecting…', tone: 'text-amber-600' },
  listening: { label: 'Listening', tone: 'text-emerald-600' },
  thinking: { label: 'Thinking…', tone: 'text-indigo-600' },
  speaking: { label: 'Speaking', tone: 'text-purple-600' },
  error: { label: 'Connection issue', tone: 'text-rose-600' },
};

const STATE_DOT: Record<VoiceAgentState, string> = {
  idle: 'bg-gray-300',
  connecting: 'bg-amber-500 animate-pulse',
  listening: 'bg-emerald-500 animate-pulse',
  thinking: 'bg-indigo-500 animate-pulse',
  speaking: 'bg-purple-500 animate-pulse',
  error: 'bg-rose-500',
};

export function VoiceAgentPanel({ className, onAction }: VoiceAgentPanelProps) {
  const { state, messages, tools, error, isActive, start, stop, reset } =
    useVoiceAgent({ onAction });

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, tools, state]);

  const stateCopy = STATE_COPY[state];

  return (
    <div
      className={
        'rounded-3xl border border-purple-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-5 shadow-sm ' +
        (className ?? '')
      }
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900">
              Live voice advisor
            </h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide rounded-full bg-white/80 border border-purple-100 px-2 py-0.5 text-purple-700">
              <Wand2 className="w-3 h-3" />
              Can take action
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Powered by Deepgram + Claude. Ask anything about your money — or just
            say <span className="font-medium">&quot;rebalance my portfolio&quot;</span> and I&apos;ll
            actually do it.
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          <span className={`flex items-center gap-1.5 text-xs ${stateCopy.tone}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOT[state]}`} />
            {stateCopy.label}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        {!isActive ? (
          <button
            onClick={() => void start()}
            className="inline-flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            disabled={state === 'connecting'}
          >
            {state === 'connecting' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            {state === 'connecting' ? 'Connecting…' : 'Start voice chat'}
          </button>
        ) : (
          <button
            onClick={() => stop()}
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            <MicOff className="w-4 h-4" />
            End voice chat
          </button>
        )}
        {messages.length > 0 && !isActive && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 text-sm font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear transcript
          </button>
        )}
        <span
          className={`sm:hidden flex items-center gap-1.5 text-xs ${stateCopy.tone}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOT[state]}`} />
          {stateCopy.label}
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className="rounded-2xl bg-white border border-gray-100 max-h-[320px] min-h-[160px] overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && tools.length === 0 ? (
          <EmptyState state={state} />
        ) : (
          <>
            {tools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-gray-100">
                {tools.map((t, i) => (
                  <ToolBadge
                    key={`${t.name}-${i}-${t.phase}`}
                    label={t.label}
                    phase={t.phase}
                  />
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0">
                    <Volume2 className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed max-w-[80%] whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-black text-white'
                      : 'bg-gray-50 text-gray-900 border border-gray-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {state === 'thinking' && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0">
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="px-3 py-2 rounded-2xl bg-gray-50 border border-gray-100 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse [animation-delay:240ms]" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Allow microphone access. The agent uses the same Claude model as the
        text chat, plus tools that can read and update your real portfolio.
      </p>
    </div>
  );
}

function EmptyState({ state }: { state: VoiceAgentState }) {
  if (state === 'idle' || state === 'error') {
    return (
      <div className="text-center py-6 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">
          Tap <span className="text-purple-700">Start voice chat</span> to begin.
        </p>
        <p>
          Try: <span className="italic">&quot;What&apos;s my portfolio worth?&quot;</span>{' '}
          ·{' '}
          <span className="italic">&quot;Rebalance my retirement.&quot;</span>{' '}
          ·{' '}
          <span className="italic">&quot;What if 2008 happened today?&quot;</span>
        </p>
      </div>
    );
  }
  if (state === 'connecting') {
    return (
      <div className="text-center py-6 text-sm text-gray-500 inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="w-4 h-4 animate-spin" />
        Connecting to your advisor…
      </div>
    );
  }
  return (
    <div className="text-center py-6 text-sm text-gray-500">
      Listening… ask anything about your money.
    </div>
  );
}

function ToolBadge({ label, phase }: { label: string; phase: 'start' | 'end' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold rounded-full px-2 py-0.5 border ${
        phase === 'end'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-100'
      }`}
    >
      {phase === 'end' ? '✓' : (
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
      )}
      {label}
    </span>
  );
}
