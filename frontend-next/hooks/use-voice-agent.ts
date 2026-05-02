'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * useVoiceAgent — browser side of the FinanceIQ Deepgram Voice Agent.
 *
 *   1. Captures mic audio at 16 kHz mono linear16 and streams it to our
 *      FastAPI proxy as binary frames (the proxy bridges to Deepgram).
 *   2. Plays back the agent's TTS reply (24 kHz linear16) via WebAudio,
 *      scheduling chunks back-to-back so it doesn't stutter.
 *   3. Surfaces the conversation transcript + agent state for the UI.
 *
 * The Supabase JWT is passed as a query param because browsers can't set
 * `Authorization` headers on a WebSocket handshake.
 *
 * NOTE — sample rates here MUST match the Settings frame the proxy sends to
 * Deepgram in `api/voice.py`. Changing one without the other desyncs audio.
 */

export type VoiceAgentState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface VoiceMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface VoiceToolEvent {
  name: string;
  label: string;
  phase: 'start' | 'end';
  result?: unknown;
  timestamp: number;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

/**
 * Tools that mutate state. We tell the host page about these so it can
 * refresh the relevant data once the call finishes ("Rebalancing your
 * portfolio…" → instantly updated holdings table).
 */
const MUTATING_TOOLS = new Set([
  'rebalance_portfolio',
  'contribute_to_goal',
  'create_goal',
  'mark_alerts_read',
]);

function deriveWsUrl(apiBase: string): string {
  // Convert https://x.up.railway.app → wss://x.up.railway.app/api/voice/ws
  // Falls back to relative for local dev (Next.js rewrites won't forward WS,
  // but we hit the FastAPI server directly via NEXT_PUBLIC_API_BASE).
  if (!apiBase) {
    const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
    return `${proto}://${host}/api/voice/ws`;
  }
  return apiBase.replace(/^http(s?):\/\//, (_, s) => `ws${s}://`).replace(/\/+$/, '') + '/api/voice/ws';
}

export interface UseVoiceAgentOptions {
  /** Called when the agent finishes a state-mutating tool, so the host
   *  page can refresh whatever data that tool changed (holdings, goals,
   *  alerts, etc). Receives the tool name + raw result payload. */
  onAction?: (toolName: string, result: unknown) => void;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
  const [state, setState] = useState<VoiceAgentState>('idle');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [tools, setTools] = useState<VoiceToolEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackHeadRef = useRef<number>(0);
  const onActionRef = useRef(options.onAction);

  useEffect(() => {
    onActionRef.current = options.onAction;
  }, [options.onAction]);

  const cleanup = useCallback(() => {
    try { processorRef.current?.disconnect(); } catch { /* */ }
    try { sourceRef.current?.disconnect(); } catch { /* */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const ws = wsRef.current;
    if (ws && ws.readyState <= WebSocket.OPEN) {
      try { ws.close(); } catch { /* */ }
    }

    const inCtx = inputCtxRef.current;
    if (inCtx && inCtx.state !== 'closed') {
      void inCtx.close().catch(() => {});
    }
    const outCtx = outputCtxRef.current;
    if (outCtx && outCtx.state !== 'closed') {
      void outCtx.close().catch(() => {});
    }

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    inputCtxRef.current = null;
    outputCtxRef.current = null;
    wsRef.current = null;
    playbackHeadRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState('idle');
  }, [cleanup]);

  const start = useCallback(async () => {
    if (state !== 'idle' && state !== 'error') return;
    setError(null);
    setState('connecting');

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error('Please sign in to use the voice advisor.');
      }

      // 1. Mic capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: INPUT_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // 2. Two AudioContexts so the mic (16 kHz) and TTS (24 kHz) don't fight
      //    over the device sample rate. WebAudio handles the resampling.
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const inputCtx = new Ctx({ sampleRate: INPUT_SAMPLE_RATE });
      inputCtxRef.current = inputCtx;
      const outputCtx = new Ctx({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputCtxRef.current = outputCtx;
      playbackHeadRef.current = outputCtx.currentTime;

      // 3. WebSocket to our FastAPI proxy (which talks to Deepgram).
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '';
      const wsUrl = `${deriveWsUrl(apiBase)}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        // Wire mic → ws.
        const source = inputCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        // ScriptProcessor is deprecated but rock-solid across browsers and
        // far simpler than AudioWorklet for a hackathon-grade demo.
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcm.buffer);
        };
        source.connect(processor);
        // Output node is required to keep the processor pumping in some
        // browsers. We mute it so we don't echo the user's mic back at them.
        const muted = inputCtx.createGain();
        muted.gain.value = 0;
        processor.connect(muted);
        muted.connect(inputCtx.destination);
        setState('listening');
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handleControl(event.data);
        } else {
          handleAudio(event.data as ArrayBuffer);
        }
      };

      ws.onerror = () => {
        setError('Voice connection error');
        setState('error');
      };

      ws.onclose = (e) => {
        if (state !== 'error') {
          if (e.code !== 1000 && e.code !== 1005 && e.code !== 1001) {
            setError(`Voice connection closed (code ${e.code})`);
            setState('error');
          } else {
            setState('idle');
          }
        }
        cleanup();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice advisor.');
      setState('error');
      cleanup();
    }

    function handleControl(raw: string) {
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'Welcome':
        case 'SettingsApplied':
          break;
        case 'UserStartedSpeaking':
          setState('listening');
          break;
        case 'AgentThinking':
          setState('thinking');
          break;
        case 'AgentStartedSpeaking':
          setState('speaking');
          break;
        case 'AgentAudioDone':
          setState('listening');
          break;
        case 'ConversationText': {
          const role = msg.role as 'user' | 'assistant' | undefined;
          const content = (msg.content as string | undefined) ?? '';
          if ((role === 'user' || role === 'assistant') && content) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === role && last.text === content) return prev;
              return [...prev, { role, text: content, timestamp: Date.now() }];
            });
          }
          break;
        }
        case 'ToolCallStarted':
          setTools((prev) => [
            ...prev,
            {
              name: String(msg.name ?? 'tool'),
              label: String(msg.label ?? msg.name ?? 'tool'),
              phase: 'start',
              timestamp: Date.now(),
            },
          ]);
          break;
        case 'ToolCallFinished': {
          const name = String(msg.name ?? 'tool');
          setTools((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].name === name && next[i].phase === 'start') {
                next[i] = {
                  ...next[i],
                  phase: 'end',
                  result: msg.result,
                  timestamp: Date.now(),
                };
                break;
              }
            }
            return next;
          });
          if (MUTATING_TOOLS.has(name)) {
            try { onActionRef.current?.(name, msg.result); } catch { /* */ }
          }
          break;
        }
        case 'Error': {
          const desc = (msg.description as string | undefined) ?? 'Voice agent error';
          setError(desc);
          setState('error');
          break;
        }
        case 'Warning':
          // Surfaced in the dev console but not the UI.
          // eslint-disable-next-line no-console
          console.warn('[voice]', msg);
          break;
      }
    }

    function handleAudio(buffer: ArrayBuffer) {
      const ctx = outputCtxRef.current;
      if (!ctx) return;
      const int16 = new Int16Array(buffer);
      if (int16.length === 0) return;
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }
      const audioBuffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      audioBuffer.copyToChannel(float32, 0);
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      // Schedule chunks back-to-back to avoid TTS gaps.
      const startAt = Math.max(ctx.currentTime + 0.02, playbackHeadRef.current);
      try { src.start(startAt); } catch { /* the context may be closing */ }
      playbackHeadRef.current = startAt + audioBuffer.duration;
    }
  }, [state, cleanup]);

  // Cleanly tear down on unmount.
  useEffect(() => () => cleanup(), [cleanup]);

  const reset = useCallback(() => {
    setMessages([]);
    setTools([]);
    setError(null);
  }, []);

  return {
    state,
    messages,
    tools,
    error,
    isActive: state !== 'idle' && state !== 'error',
    start,
    stop,
    reset,
  };
}
