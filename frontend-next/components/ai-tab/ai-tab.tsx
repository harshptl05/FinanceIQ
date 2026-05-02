'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  ChevronsLeft, 
  Plus, 
  Home, 
  Sparkles, 
  Lightbulb, 
  Bookmark, 
  Share2, 
  Settings,
  History,
  Languages,
  HeartHandshake,
  UserSquare2,
  Moon,
  Users,
  Shield,
  Receipt,
  FileText,
  ArrowUpRight,
  ArrowUp,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCcw,
  Wallet,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, streamChat, type ScenarioResult } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { PortfolioData } from '@/hooks/use-portfolio-data';
import { fmtMoney, fmtPct, initials } from '@/lib/format';
import { toast } from 'sonner';

// ---------- TIME MACHINE ----------

const SCENARIO_OPTIONS = [
  { key: 'dot_com_crash', label: 'Dot-Com Bust' },
  { key: '2008_financial_crisis', label: '2008 Crisis' },
  { key: 'covid_crash_2020', label: 'COVID Crash' },
  { key: '2022_rate_hikes', label: '2022 Rate Hikes' },
  { key: 'high_inflation', label: 'High Inflation' },
];

function TimeMachineDialog({
  open,
  onOpenChange,
  totalValue,
  initialKey,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  totalValue: number;
  initialKey?: string;
}) {
  const [idx, setIdx] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sync slider when an initialKey is supplied (e.g., from Saved scenarios).
  useEffect(() => {
    if (open && initialKey) {
      const i = SCENARIO_OPTIONS.findIndex((s) => s.key === initialKey);
      if (i >= 0) setIdx(i);
    }
  }, [open, initialKey]);

  const scenario = SCENARIO_OPTIONS[idx];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setResult(null);
    api.scenarios
      .run(scenario.key)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, scenario.key]);

  // Synthesize a smooth curve so the chart feels alive even though our
  // backend only returns aggregate numbers.
  const chartData = useMemo(() => {
    if (!result) return [];
    const months = Math.max(result.duration_months, 4);
    const start = result.total_portfolio_before;
    const end = result.total_portfolio_after;
    const trough = start + (end - start) * 1.4;
    const points: Array<{ month: string; value: number }> = [];
    const step = months / 6;
    for (let i = 0; i <= 6; i++) {
      const m = i * step;
      const t = i / 6;
      const dip = Math.sin(Math.PI * t) * (trough - start) * 0.6;
      const linear = start + (end - start) * t;
      const value = i === 6 ? end : Math.round(linear + dip);
      points.push({
        month: `M${Math.round(m)}`,
        value,
      });
    }
    return points;
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <History className="w-5 h-5 text-indigo-600" />
            </div>
            <DialogTitle className="text-xl">Portfolio time machine</DialogTitle>
          </div>
          <p className="text-sm text-gray-500">
            Drag the slider to a past crisis. We&apos;ll show how{' '}
            <span className="font-semibold tabular-nums">
              {fmtMoney(totalValue)}
            </span>{' '}
            of your real holdings would have moved.
          </p>
        </DialogHeader>

        <div className="my-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2 flex-wrap gap-2">
            {SCENARIO_OPTIONS.map((s, i) => (
              <span
                key={s.key}
                className={
                  idx === i ? 'text-indigo-600 font-semibold' : ''
                }
              >
                {s.label}
              </span>
            ))}
          </div>
          <Slider
            value={[idx]}
            onValueChange={(v) => setIdx(v[0])}
            min={0}
            max={SCENARIO_OPTIONS.length - 1}
            step={1}
            className="w-full"
          />
        </div>

        {err && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-3 text-sm">
            {err}
          </div>
        )}

        {loading && (
          <div className="h-56 flex items-center justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {result && !loading && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  {result.scenario}
                </div>
                <div className="text-2xl font-bold mt-1 tabular-nums">
                  {fmtMoney(result.total_portfolio_after)}
                </div>
                <div className="text-xs text-gray-500">at the bottom</div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <div
                    className={`flex items-center justify-center gap-1 font-bold text-lg ${result.total_pct_impact < 0 ? 'text-rose-600' : 'text-green-600'}`}
                  >
                    {result.total_pct_impact < 0 ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <TrendingUp className="w-4 h-4" />
                    )}
                    {fmtPct(result.total_pct_impact, { decimals: 1 })}
                  </div>
                  <div className="text-xs text-gray-500">vs today</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-gray-900">
                    {result.duration_months}mo
                  </div>
                  <div className="text-xs text-gray-500">duration</div>
                </div>
              </div>
            </div>

            <div className="h-56 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="tmFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop
                        offset="100%"
                        stopColor="#6366F1"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#111827',
                      border: 'none',
                      borderRadius: 8,
                      color: 'white',
                      fontSize: 13,
                    }}
                    formatter={(v: number) => [fmtMoney(v), 'Value']}
                  />
                  <ReferenceLine
                    y={result.total_portfolio_before}
                    stroke="#9CA3AF"
                    strokeDasharray="3 3"
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6366F1"
                    strokeWidth={2}
                    fill="url(#tmFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-900 mb-1">
                  What this means
                </div>
                <p className="text-sm text-amber-900/80 leading-relaxed">
                  {result.plain_english}
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- TRANSLATE ----------

type ChatTurn = { role: 'user' | 'assistant'; text: string };

function TranslateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      text: "Hi! Type any financial term and I'll explain it like a friend would. Try expense ratio, index fund, 401(k), dividend, or bond.",
    },
  ]);

  const send = async () => {
    const term = input.trim();
    if (!term || busy) return;
    setInput('');
    setBusy(true);
    const myTurn: ChatTurn = { role: 'user', text: term };
    setTurns((t) => [...t, myTurn, { role: 'assistant', text: '' }]);
    try {
      let buf = '';
      // Translate jargon is intentionally a one-off Q&A — we mark it
      // ephemeral so it doesn't pollute the saved conversation list.
      await streamChat(
        `Explain "${term}" in 2-3 plain English sentences a beginner can understand. No jargon.`,
        null,
        {
          onChunk: (chunk) => {
            buf += chunk;
            setTurns((t) => {
              const next = [...t];
              next[next.length - 1] = { role: 'assistant', text: buf };
              return next;
            });
          },
          onToolCall: () => {},
          onDone: () => {},
        },
        { ephemeral: true },
      );
    } catch (e) {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = {
          role: 'assistant',
          text:
            e instanceof Error
              ? `Sorry — ${e.message}`
              : 'Sorry, something went wrong.',
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Languages className="w-5 h-5 text-blue-600" />
            </div>
            <DialogTitle className="text-xl">Translate jargon</DialogTitle>
          </div>
          <p className="text-sm text-gray-500">
            Powered by Claude — answers come from the same advisor that knows
            your portfolio.
          </p>
        </DialogHeader>

        <div className="bg-gray-50 rounded-xl p-4 max-h-80 overflow-y-auto space-y-3 my-4">
          {turns.map((m, i) => (
            <div
              key={i}
              className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={`px-3 py-2 rounded-2xl text-sm leading-relaxed max-w-[80%] ${
                  m.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                {m.text || (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse [animation-delay:120ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse [animation-delay:240ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send();
            }}
            placeholder="Type a term, e.g. expense ratio..."
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => void send()}
            disabled={busy}
            className="px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- MAIN AI WORKSPACE ----------

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  tools?: Array<{ name: string; phase: 'start' | 'end' }>;
};

const SUGGESTED = [
  "Am I on track to retire in 20 years?",
  'How is my portfolio diversified?',
  'What does my biggest holding actually do?',
  'What should I worry about right now?',
];

type Panel = 'home' | 'insights' | 'scenarios' | 'shared';

type Conversation = {
  id: string;
  title: string | null;
  first_at: string | null;
  last_at: string | null;
  message_count: number;
  is_legacy?: boolean;
};

export function AITab({ data }: { data: PortfolioData }) {
  const { user } = useAuth();
  const totalValue = data.summary?.total_value ?? 0;

  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [timeMachineKey, setTimeMachineKey] = useState<string | undefined>();
  const [translateOpen, setTranslateOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('home');

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsMigrated, setConversationsMigrated] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const refreshConversations = useCallback(async () => {
    try {
      const r = await api.chat.conversations();
      setConversations(r.conversations);
      setConversationsMigrated(r.migrated);
    } catch {
      /* fall back to legacy below */
    }
  }, []);

  // On mount: load conversation list + last conversation's messages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.chat.conversations();
        if (cancelled) return;
        setConversations(r.conversations);
        setConversationsMigrated(r.migrated);
        const newest = r.conversations[0];
        if (newest) {
          setActiveConversationId(newest.id);
          const c = await api.chat.conversation(newest.id);
          if (!cancelled) {
            setMessages(
              c.messages.map((m) => ({ role: m.role, content: m.content })),
            );
          }
        } else {
          // No conversations yet — fall back to legacy flat history so the
          // user still sees their old chats during the transition.
          const h = await api.chat.history();
          if (!cancelled) {
            setMessages(
              h.history.map((m) => ({ role: m.role, content: m.content })),
            );
          }
        }
      } catch {
        try {
          const h = await api.chat.history();
          if (!cancelled) {
            setMessages(
              h.history.map((m) => ({ role: m.role, content: m.content })),
            );
          }
        } catch {
          /* ignore */
        }
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: 'user', content: message },
      { role: 'assistant', content: '', tools: [] },
    ]);
    let buf = '';
    let newConvId: string | null = activeConversationId;
    try {
      await streamChat(message, activeConversationId, {
        onChunk: (chunk) => {
          buf += chunk;
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: buf,
            };
            return next;
          });
        },
        onToolCall: (tool, phase) => {
          setMessages((m) => {
            const next = [...m];
            const last = { ...next[next.length - 1] };
            const tools = [...(last.tools ?? [])];
            if (phase === 'start') tools.push({ name: tool, phase });
            else {
              const i = tools.findIndex(
                (t) => t.name === tool && t.phase === 'start',
              );
              if (i >= 0) tools[i] = { name: tool, phase: 'end' };
            }
            last.tools = tools;
            next[next.length - 1] = last;
            return next;
          });
        },
        onConversation: (id) => {
          newConvId = id;
          setActiveConversationId(id);
        },
        onDone: () => {},
      });
    } catch (e) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content:
            e instanceof Error
              ? `Sorry — ${e.message}`
              : 'Sorry, something went wrong.',
        };
        return next;
      });
    } finally {
      setBusy(false);
      // Pull the conversations list so the sidebar reflects this new chat.
      void refreshConversations();
      // Make sure we keep the id locally even if React batched the state.
      if (newConvId && newConvId !== activeConversationId) {
        setActiveConversationId(newConvId);
      }
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveConversationId(null);
    setPanel('home');
  };

  const openConversation = async (id: string) => {
    setPanel('home');
    setActiveConversationId(id);
    try {
      const c = await api.chat.conversation(id);
      setMessages(c.messages.map((m) => ({ role: m.role, content: m.content })));
    } catch {
      /* ignore */
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.chat.deleteConversation(id);
      if (activeConversationId === id) {
        setMessages([]);
        setActiveConversationId(null);
      }
      void refreshConversations();
    } catch {
      /* ignore */
    }
  };

  const userName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
    user?.email?.split('@')[0] ??
    'there';

  const userInitials = initials(user?.email);

  // Bucket conversations into Today / Yesterday / Last 7 days / Earlier.
  const groupedConversations = useMemo(() => {
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const lastWeek: Conversation[] = [];
    const earlier: Conversation[] = [];

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfYesterday = startOfToday - 86400_000;
    const startOf7Days = startOfToday - 6 * 86400_000;

    for (const c of conversations) {
      const t = c.last_at ? new Date(c.last_at).getTime() : 0;
      if (t >= startOfToday) today.push(c);
      else if (t >= startOfYesterday) yesterday.push(c);
      else if (t >= startOf7Days) lastWeek.push(c);
      else earlier.push(c);
    }
    return { today, yesterday, lastWeek, earlier };
  }, [conversations]);

  const toolCards = [
    {
      section: 'Reality checks',
      cards: [
        {
          icon: History,
          iconBg: 'bg-indigo-50',
          iconColor: 'text-indigo-600',
          title: 'Portfolio time machine',
          description:
            'Drag a slider to 2008, 2020, or the dot-com bust — see how your CURRENT holdings would have done.',
          onClick: () => setTimeMachineOpen(true),
        },
        {
          icon: Languages,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
          title: 'Translate jargon',
          description:
            'Stuck on a term in a fund prospectus? Get a plain-English explanation in seconds.',
          onClick: () => setTranslateOpen(true),
        },
        {
          icon: HeartHandshake,
          iconBg: 'bg-orange-50',
          iconColor: 'text-orange-600',
          title: 'Life events',
          description:
            "Tell me what's happening — baby, layoff, marriage, market panic — and I'll guide you through it.",
          onClick: () => void send("I have a major life event coming up. Walk me through how to think about my portfolio."),
        },
      ],
    },
    {
      section: 'Coaching',
      cards: [
        {
          icon: UserSquare2,
          iconBg: 'bg-purple-50',
          iconColor: 'text-purple-600',
          title: 'Sanity check my portfolio',
          description:
            'A short, friendly review of how my money is allocated and whether anything looks off.',
          onClick: () => void send("Give me a sanity check on my current portfolio. What looks healthy and what looks off?"),
        },
        {
          icon: Moon,
          iconBg: 'bg-slate-100',
          iconColor: 'text-slate-700',
          title: 'Sleep at night test',
          description:
            "How big a drop could you actually stomach? Most people overestimate. Let's find out honestly.",
          onClick: () => void send("Help me figure out how big a drawdown I could actually emotionally tolerate."),
        },
        {
          icon: Users,
          iconBg: 'bg-cyan-50',
          iconColor: 'text-cyan-600',
          title: 'People like you',
          description:
            'Compare yourself to others with similar age and savings. Just context — not advice.',
          onClick: () => void send("How does my portfolio compare to others with similar age and savings?"),
        },
      ],
    },
    {
      section: 'Health & rules',
      cards: [
        {
          icon: Shield,
          iconBg: 'bg-green-50',
          iconColor: 'text-green-600',
          title: 'Risk capacity vs tolerance',
          description:
            "Tolerance is how you feel; capacity is what you can actually afford. We score both.",
          onClick: () => void send("Walk me through the difference between my risk tolerance and my risk capacity, using my actual situation."),
        },
        {
          icon: Receipt,
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
          title: 'Hidden cost calculator',
          description:
            'Estimate how much expense ratios will cost you over your lifetime — it adds up.',
          onClick: () => void send("Estimate how much I'll pay in fund expense ratios over my lifetime, given my current holdings."),
        },
        {
          icon: FileText,
          iconBg: 'bg-rose-50',
          iconColor: 'text-rose-600',
          title: 'Your investment rules',
          description:
            'A short, plain-English document codifying your goals and limits. Read it when markets tempt you to deviate.',
          onClick: () => void send("Help me write a one-page set of investing rules for myself based on my goals and risk profile."),
        },
      ],
    },
  ];

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)] min-h-[600px]">
      {/* Sidebar */}
      <div className="hidden md:flex w-[280px] bg-gray-50 rounded-2xl p-4 flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-[11px] font-semibold flex items-center justify-center">
              {userInitials}
            </div>
            <span className="text-sm font-semibold capitalize">{userName}</span>
          </div>
          <ChevronsLeft className="w-4 h-4 text-gray-400" />
        </div>

        <button
          onClick={startNewChat}
          className="w-full bg-black text-white rounded-xl py-2.5 flex items-center justify-center gap-2 mb-4 hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New chat</span>
        </button>

        <nav className="space-y-1 mb-6">
          {(
            [
              { id: 'home' as Panel, label: 'AI Home', icon: Home },
              { id: 'insights' as Panel, label: 'My insights', icon: Lightbulb },
              { id: 'scenarios' as Panel, label: 'Saved scenarios', icon: Bookmark },
              { id: 'shared' as Panel, label: 'Conversation starters', icon: Share2 },
            ] as Array<{ id: Panel; label: string; icon: typeof Home }>
          ).map((item) => {
            const Active = item.icon;
            const active = panel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPanel(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${
                  active
                    ? 'bg-white text-gray-900 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-white'
                }`}
              >
                <Active className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => {
              setTimeMachineKey(undefined);
              setTimeMachineOpen(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-white"
          >
            <History className="w-4 h-4" />
            <span className="text-sm">Time machine</span>
          </button>
          <button
            onClick={() => setTranslateOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-white"
          >
            <Languages className="w-4 h-4" />
            <span className="text-sm">Translate jargon</span>
          </button>
        </nav>

        <ConversationList
          grouped={groupedConversations}
          activeId={activeConversationId}
          onOpen={openConversation}
          onDelete={deleteConversation}
          showSchemaHint={!conversationsMigrated}
        />

        <div className="bg-white rounded-xl p-3 mt-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3 h-3 text-indigo-600" />
            <span className="text-[11px] text-gray-500">Portfolio value</span>
          </div>
          <p className="text-xl font-bold tabular-nums">
            {fmtMoney(totalValue)}
          </p>
          <p className="text-[11px] text-gray-400 mb-2">
            {data.holdings.length} holdings
          </p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
              style={{
                width: `${Math.min(((data.summary?.expected_annual_return ?? 0) / 12) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-3">
          <button
            onClick={() => void data.refresh()}
            className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700"
          >
            <RefreshCcw className="w-3 h-3" />
            Refresh data
          </button>
          <button className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700">
            <Settings className="w-3 h-3" />
            Settings
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2" ref={scrollRef}>
          {panel === 'insights' ? (
            <InsightsPanel
              data={data}
              messages={messages}
              onAsk={(q) => {
                setPanel('home');
                void send(q);
              }}
            />
          ) : panel === 'scenarios' ? (
            <SavedScenariosPanel
              onRun={(key) => {
                setTimeMachineKey(key);
                setTimeMachineOpen(true);
              }}
            />
          ) : panel === 'shared' ? (
            <StartersPanel
              onPick={(q) => {
                setPanel('home');
                void send(q);
              }}
            />
          ) : messages.length === 0 ? (
            <>
              <h1 className="text-3xl sm:text-[32px] font-bold mb-1 capitalize">
                Welcome back,{' '}
                <span className="bg-yellow-100 px-1 rounded">{userName}</span>
          </h1>
              <p className="text-2xl font-medium text-gray-400 mb-8">
                How can I help with your money today?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div 
              onClick={() => setTimeMachineOpen(true)}
                  className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 hover:shadow-md transition cursor-pointer hover:scale-[1.01]"
            >
              <History className="w-6 h-6 text-purple-600 mb-2" />
                  <p className="text-[11px] text-purple-700 font-medium uppercase tracking-wide mb-1">
                    Try this
                  </p>
                  <p className="text-[15px] font-semibold text-gray-900 mb-1">
                    What if 2008 happened today?
                  </p>
                  <p className="text-[13px] text-gray-600 mb-3">
                    See your real portfolio dropped through one of the worst
                    years in modern markets.
                  </p>
                  <span className="text-purple-600 text-sm font-medium">
                    {'Run scenario →'}
                  </span>
            </div>

            <div 
              onClick={() => setTranslateOpen(true)}
                  className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 hover:shadow-md transition cursor-pointer hover:scale-[1.01]"
            >
              <Languages className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="text-[11px] text-blue-700 font-medium uppercase tracking-wide mb-1">
                    Try this
                  </p>
                  <p className="text-[15px] font-semibold text-gray-900 mb-1">
                    Confused by a term?
                  </p>
                  <p className="text-[13px] text-gray-600 mb-3">
                    {"Type any financial word — fund name, broker email, IRS letter — and I'll explain it in plain English."}
                  </p>
                  <span className="text-blue-600 text-sm font-medium">
                    {'Try it now →'}
                  </span>
            </div>
          </div>

          <h2 className="text-lg font-bold mb-4">Your money tools</h2>

          {toolCards.map((section) => (
            <div key={section.section} className="mb-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {section.section}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.cards.map((card) => (
                      <button
                    key={card.title}
                    onClick={card.onClick}
                        className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition cursor-pointer hover:scale-[1.01] relative group text-left"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}
                        >
                          <card.icon
                            className={`w-5 h-5 ${card.iconColor}`}
                          />
                    </div>
                        <p className="text-[15px] font-semibold mt-3 mb-1">
                          {card.title}
                        </p>
                        <p className="text-[13px] text-gray-500 line-clamp-3">
                          {card.description}
                        </p>
                    <ArrowUpRight className="w-4 h-4 text-gray-400 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                  </div>
                ))}
            </>
          ) : (
            <div className="space-y-4 pb-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-black text-white'
                        : 'bg-white border border-gray-100 shadow-sm text-gray-900'
                    }`}
                  >
                    {m.tools && m.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {m.tools.map((t, j) => (
                          <span
                            key={j}
                            className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              t.phase === 'end'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                          >
                            {t.phase === 'end' ? '✓' : '…'} {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' ? (
                      m.content ? (
                        <div className="prose prose-sm max-w-none prose-p:my-2 prose-li:my-0 prose-headings:my-2">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="inline-flex gap-1 items-center text-gray-400">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse [animation-delay:120ms]" />
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse [animation-delay:240ms]" />
                        </span>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
              </div>
            </div>
          ))}
              {!historyLoaded && (
                <div className="flex items-center justify-center text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading conversation…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center"
              title="New chat"
            >
              <Plus className="w-4 h-4 text-gray-500" />
            </button>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send();
              }}
              disabled={busy}
              placeholder="Ask anything about your money. The advisor sees your real holdings and goals."
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-400 disabled:opacity-50"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                busy || !input.trim()
                  ? 'bg-gray-300 text-white cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
              <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTED.map((chip) => (
              <button
                key={chip}
                onClick={() => void send(chip)}
                disabled={busy}
                className="px-3 py-1 rounded-full border border-gray-200 text-[12px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TimeMachineDialog
        open={timeMachineOpen}
        onOpenChange={setTimeMachineOpen}
        totalValue={totalValue}
        initialKey={timeMachineKey}
      />
      <TranslateDialog open={translateOpen} onOpenChange={setTranslateOpen} />
              </div>
  );
}

// ----- AI Sidebar Panels -----

function InsightsPanel({
  data,
  messages,
  onAsk,
}: {
  data: PortfolioData;
  messages: Msg[];
  onAsk: (q: string) => void;
}) {
  const summary = data.summary;
  const cashPct = summary?.current_allocation?.cash ?? 0;
  const drift = summary?.drift ?? {};
  const biggestDriftEntry = Object.entries(drift).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  )[0];
  const biggestHolding = [...data.holdings].sort(
    (a, b) => Number(b.current_value ?? 0) - Number(a.current_value ?? 0),
  )[0];
  const totalValue = summary?.total_value ?? 0;

  const insights: Array<{
    title: string;
    body: string;
    cta: string;
    color: string;
  }> = [];

  if (biggestDriftEntry && Math.abs(biggestDriftEntry[1]) > 0.03) {
    const [k, v] = biggestDriftEntry;
    insights.push({
      title: `${k.replace('_', ' ')} is ${v > 0 ? 'over' : 'under'}weight by ${(Math.abs(v) * 100).toFixed(1)}%`,
      body: 'Your allocation has drifted away from target. The Rebalance tab can show you the exact trades.',
      cta: `Why does my ${k.replace('_', ' ')} allocation matter?`,
      color: 'from-amber-50 to-orange-50',
    });
  }
  if (cashPct > 0.1) {
    insights.push({
      title: `You're holding ${(cashPct * 100).toFixed(0)}% in cash`,
      body: 'Cash is safe but loses to inflation. Worth checking whether some of it should be invested.',
      cta: 'Is my cash drag costing me money?',
      color: 'from-blue-50 to-cyan-50',
    });
  }
  if (biggestHolding && totalValue > 0) {
    const w = (Number(biggestHolding.current_value ?? 0) / totalValue) * 100;
    if (w > 30) {
      insights.push({
        title: `${biggestHolding.ticker} is ${w.toFixed(0)}% of your portfolio`,
        body: 'Concentration risk: a single position dominates your portfolio. Worth a sanity check.',
        cta: `What's the risk of having so much in ${biggestHolding.ticker}?`,
        color: 'from-rose-50 to-pink-50',
      });
    }
  }
  if (insights.length === 0) {
    insights.push({
      title: 'Your portfolio looks balanced today',
      body: 'No drift, concentration or cash-drag flags. The advisor will alert you when something changes.',
      cta: 'Give me a deeper look at my portfolio health.',
      color: 'from-emerald-50 to-green-50',
    });
  }

  const userQs = messages.filter((m) => m.role === 'user').slice(-10).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">My insights</h1>
        <p className="text-gray-500 text-sm">
          Personalized observations the advisor sees in your portfolio right now.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {insights.map((ins, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${ins.color} rounded-2xl p-5 border border-gray-100`}
          >
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-[15px] mb-1">{ins.title}</p>
                <p className="text-sm text-gray-700">{ins.body}</p>
            </div>
            </div>
            <button
              onClick={() => onAsk(ins.cta)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
            >
              Ask the advisor about this
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
          </div>

            <div>
        <h2 className="text-base font-semibold mb-2">Your recent questions</h2>
        {userQs.length === 0 ? (
          <p className="text-sm text-gray-500">
            You haven&apos;t asked anything yet — pick a card above to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {userQs.map((q, i) => (
              <button
                key={i}
                onClick={() => onAsk(q.content)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-gray-800 transition flex items-center justify-between gap-2"
              >
                <span className="truncate">{q.content}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            ))}
              </div>
        )}
              </div>
            </div>
  );
}

function SavedScenariosPanel({ onRun }: { onRun: (key: string) => void }) {
  const [scenarios, setScenarios] = useState<
    Array<{ key: string; name: string; description: string; duration_months: number }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.scenarios
      .list()
      .then((r) => !cancelled && setScenarios(r.scenarios))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Saved scenarios</h1>
        <p className="text-gray-500 text-sm">
          Macro stress tests you can re-run any time against your real holdings.
        </p>
                </div>

      {loading ? (
        <div className="flex items-center text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading scenarios…
              </div>
      ) : scenarios.length === 0 ? (
        <p className="text-sm text-gray-500">No scenarios available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scenarios.map((s) => (
            <button
              key={s.key}
              onClick={() => onRun(s.key)}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition text-left group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <History className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="font-semibold text-[15px]">{s.name}</p>
              </div>
              <p className="text-sm text-gray-600 mb-3">{s.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {s.duration_months} months
                </span>
                <span className="text-sm font-medium text-indigo-600 group-hover:translate-x-0.5 transition">
                  Run on my portfolio →
                </span>
            </div>
            </button>
          ))}
          </div>
      )}
          </div>
  );
}

function StartersPanel({ onPick }: { onPick: (q: string) => void }) {
  const groups = [
    {
      title: 'Goals & timeline',
      items: [
        'Am I on track to retire when I want to?',
        'Should I be saving more, given my current income?',
        'How much can I safely spend in retirement?',
      ],
    },
    {
      title: 'Risk',
      items: [
        'How much could my portfolio drop in a normal recession?',
        'Am I taking too much risk for someone my age?',
        'What is the worst-case loss I should plan for?',
      ],
    },
    {
      title: 'My holdings',
      items: [
        'Walk me through what each of my holdings actually does.',
        'Where am I overconcentrated?',
        'Are any of my funds quietly expensive?',
      ],
    },
    {
      title: 'Behavior',
      items: [
        "I'm worried about a market drop. Talk me down with facts.",
        'Everyone is buying tech stocks. Should I be FOMOing in?',
        'How do I know when to actually rebalance?',
      ],
    },
  ];

  return (
    <div className="space-y-6">
            <div>
        <h1 className="text-2xl font-bold mb-1">Conversation starters</h1>
        <p className="text-gray-500 text-sm">
          Curated questions to get the most out of your AI advisor. Click one to
          start the conversation.
        </p>
            </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {groups.map((g) => (
          <div key={g.title} className="bg-white border border-gray-100 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3">
              {g.title}
            </p>
            <div className="space-y-1">
              {g.items.map((q) => (
                <button
                  key={q}
                  onClick={() => onPick(q)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition flex items-center justify-between gap-2 group"
                >
                  <span>{q}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600 shrink-0" />
                </button>
              ))}
          </div>
              </div>
        ))}
            </div>
    </div>
  );
}

// ----- Conversation list (sidebar) -----

function ConversationList({
  grouped,
  activeId,
  onOpen,
  onDelete,
  showSchemaHint,
}: {
  grouped: {
    today: Conversation[];
    yesterday: Conversation[];
    lastWeek: Conversation[];
    earlier: Conversation[];
  };
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  showSchemaHint: boolean;
}) {
  const total =
    grouped.today.length +
    grouped.yesterday.length +
    grouped.lastWeek.length +
    grouped.earlier.length;

  if (showSchemaHint) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-[12px] leading-snug">
          <p className="font-semibold mb-1">Chat history is one-time setup</p>
          <p>
            Add the <code className="bg-amber-100 px-1 rounded">conversation_id</code>{' '}
            column to <code className="bg-amber-100 px-1 rounded">chat_history</code>{' '}
            in Supabase, then your conversations will list here just like
            ChatGPT.
          </p>
                  </div>
                </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center py-6 text-[12px] text-gray-400">
          <MessageSquare className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
          No chats yet — your conversations will appear here.
              </div>
          </div>
    );
  }

  const sections: Array<{ label: string; items: Conversation[] }> = [
    { label: 'Today', items: grouped.today },
    { label: 'Yesterday', items: grouped.yesterday },
    { label: 'Last 7 days', items: grouped.lastWeek },
    { label: 'Earlier', items: grouped.earlier },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1 px-2">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((c) => {
              const active = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-md transition ${
                    active
                      ? 'bg-white shadow-sm'
                      : 'hover:bg-white/60'
                  }`}
                >
            <button 
                    onClick={() => onOpen(c.id)}
                    className="flex-1 min-w-0 text-left px-2 py-1.5 text-[13px] truncate"
                    title={c.title ?? 'Untitled chat'}
                  >
                    <span
                      className={
                        active ? 'text-gray-900 font-medium' : 'text-gray-700'
                      }
                    >
                      {c.title ?? 'Untitled chat'}
                    </span>
            </button>
                  {!c.is_legacy && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Delete this chat? "${c.title ?? 'Untitled'}" — this cannot be undone.`,
                          )
                        ) {
                          onDelete(c.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-rose-600 transition"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
          </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
