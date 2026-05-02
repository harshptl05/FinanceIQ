'use client';

/**
 * VoiceComposerButton — ChatGPT/Claude-style inline voice control.
 *
 * Two pieces:
 *
 *   1. <VoiceComposerButton />    a small mic button that lives inside the
 *                                 chat composer between the "+" and the text
 *                                 input. Tapping it starts a voice session;
 *                                 tapping again ends it.
 *
 *   2. <VoiceLiveStrip />         a slim status strip that appears ABOVE the
 *                                 chat composer while voice is active —
 *                                 shows pulsing state, the live transcript
 *                                 fragment, current tool call (if any), and
 *                                 a stop control. Replaces the giant card
 *                                 that previously sat above the chat.
 *
 * Both pieces share a single useVoiceAgent() instance via a tiny context so
 * the button reflects the right state without prop drilling.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Loader2, Mic, MicOff, Sparkles, Square, X } from 'lucide-react';
import {
  useVoiceAgent,
  type VoiceAgentState,
} from '@/hooks/use-voice-agent';
import { cn } from '@/lib/utils';

interface VoiceContextValue {
  state: VoiceAgentState;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  messages: ReturnType<typeof useVoiceAgent>['messages'];
  tools: ReturnType<typeof useVoiceAgent>['tools'];
  error: string | null;
}

const VoiceCtx = createContext<VoiceContextValue | undefined>(undefined);

interface VoiceProviderProps {
  children: ReactNode;
  onAction?: (toolName: string, result: unknown) => void;
}

/** Wrap the chat area in this so the mic button + live strip share one
 *  voice agent instance. */
export function VoiceComposerProvider({ children, onAction }: VoiceProviderProps) {
  const agent = useVoiceAgent({ onAction });
  const value = useMemo<VoiceContextValue>(
    () => ({
      state: agent.state,
      isActive: agent.isActive,
      start: agent.start,
      stop: agent.stop,
      reset: agent.reset,
      messages: agent.messages,
      tools: agent.tools,
      error: agent.error,
    }),
    [
      agent.state,
      agent.isActive,
      agent.start,
      agent.stop,
      agent.reset,
      agent.messages,
      agent.tools,
      agent.error,
    ],
  );
  return <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider>;
}

function useVoiceCtx(): VoiceContextValue {
  const ctx = useContext(VoiceCtx);
  if (!ctx) {
    throw new Error('VoiceComposerButton must be used inside <VoiceComposerProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Mic button
// ---------------------------------------------------------------------------

const STATE_BG: Record<VoiceAgentState, string> = {
  idle: 'bg-white border border-gray-200 hover:bg-gray-50',
  connecting: 'bg-amber-100 border border-amber-200',
  listening: 'bg-rose-500 hover:bg-rose-600 text-white border border-rose-600',
  thinking: 'bg-indigo-500 text-white border border-indigo-600',
  speaking: 'bg-purple-500 text-white border border-purple-600',
  error: 'bg-rose-50 border border-rose-200',
};

const STATE_RING: Record<VoiceAgentState, string> = {
  idle: '',
  connecting: 'animate-pulse',
  listening: 'shadow-[0_0_0_4px_rgba(244,63,94,0.18)]',
  thinking: 'shadow-[0_0_0_4px_rgba(99,102,241,0.18)]',
  speaking: 'shadow-[0_0_0_4px_rgba(168,85,247,0.18)]',
  error: '',
};

export function VoiceComposerButton({
  className,
  disabled,
}: {
  className?: string;
  disabled?: boolean;
}) {
  const { state, isActive, start, stop } = useVoiceCtx();

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (isActive) stop();
    else void start();
  }, [disabled, isActive, start, stop]);

  const Icon =
    state === 'connecting'
      ? Loader2
      : isActive
        ? Square
        : Mic;

  const title = isActive
    ? 'Stop voice chat'
    : state === 'connecting'
      ? 'Connecting…'
      : 'Start voice chat';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'connecting'}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        'shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-50',
        STATE_BG[state],
        STATE_RING[state],
        className,
      )}
    >
      <Icon
        className={cn(
          'w-4 h-4',
          state === 'connecting' && 'animate-spin text-amber-700',
          state === 'idle' && 'text-gray-700',
          state === 'error' && 'text-rose-600',
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Live strip
// ---------------------------------------------------------------------------

const STATE_LABEL: Record<VoiceAgentState, string> = {
  idle: 'Ready',
  connecting: 'Connecting…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  error: 'Connection issue',
};

const STATE_DOT: Record<VoiceAgentState, string> = {
  idle: 'bg-gray-300',
  connecting: 'bg-amber-500 animate-pulse',
  listening: 'bg-rose-500 animate-pulse',
  thinking: 'bg-indigo-500 animate-pulse',
  speaking: 'bg-purple-500 animate-pulse',
  error: 'bg-rose-500',
};

/** Slim status banner shown while a voice session is active. */
export function VoiceLiveStrip({ className }: { className?: string }) {
  const { state, isActive, stop, messages, tools, error } = useVoiceCtx();

  // Don't render anything until the user actually starts a session.
  if (!isActive && state !== 'connecting' && !error) return null;

  // Show the most recent transcript line — pick the latest non-empty one.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const inProgressTool = [...tools].reverse().find((t) => t.phase === 'start');

  const subline =
    inProgressTool?.label ??
    (state === 'speaking' ? lastAssistant?.text : lastUser?.text) ??
    (state === 'listening'
      ? 'Listening — try “rebalance my retirement”.'
      : 'Connecting to your advisor…');

  return (
    <div
      className={cn(
        'mb-2 rounded-2xl border border-purple-200/70 bg-gradient-to-r from-indigo-50 via-white to-purple-50 px-3 py-2 flex items-center gap-3',
        error && 'border-rose-200 from-rose-50 via-white to-rose-50',
        className,
      )}
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn('w-1.5 h-1.5 rounded-full', STATE_DOT[state])} />
          <span className="font-semibold text-gray-700">
            {STATE_LABEL[state]}
          </span>
          {inProgressTool && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {inProgressTool.label}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 truncate mt-0.5">
          {error ?? subline}
        </p>
      </div>
      <button
        type="button"
        onClick={() => stop()}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium px-3 py-1.5 transition"
        title="End voice chat"
      >
        <MicOff className="w-3 h-3" />
        End
      </button>
    </div>
  );
}

/** Optional: an error toast-style strip that survives after stop(). */
export function VoiceErrorBanner() {
  const { error, isActive, reset } = useVoiceCtx();
  if (!error || isActive) return null;
  return (
    <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs px-3 py-2 flex items-start gap-2">
      <span className="flex-1">{error}</span>
      <button
        type="button"
        onClick={reset}
        className="shrink-0 text-rose-500 hover:text-rose-700"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
