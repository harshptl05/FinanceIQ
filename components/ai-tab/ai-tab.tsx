'use client';

import { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, ReferenceLine, Tooltip, BarChart, Bar } from 'recharts';

// Time Machine Scenarios
const SCENARIOS: Record<number, {
  name: string;
  peakToBottom: number;
  recoveryYears: number;
  data: { month: string; value: number }[];
  verdict: string;
}> = {
  2008: {
    name: 'Global Financial Crisis',
    peakToBottom: -55,
    recoveryYears: 4,
    data: [
      { month: "Oct '07", value: 50000 },
      { month: "Apr '08", value: 45000 },
      { month: "Oct '08", value: 31000 },
      { month: "Mar '09", value: 22500 },
      { month: "Oct '09", value: 32000 },
      { month: "Apr '10", value: 38000 },
      { month: "Oct '10", value: 41000 },
      { month: "Apr '11", value: 46000 },
      { month: "Apr '12", value: 51000 },
    ],
    verdict: "If you held through 2008, you'd have dropped to about $22,500 at the worst point — a 55% loss. But you'd have fully recovered by April 2012. The investors who locked in losses were the ones who panic-sold near the bottom.",
  },
  2020: {
    name: 'COVID Crash',
    peakToBottom: -34,
    recoveryYears: 0.5,
    data: [
      { month: 'Jan', value: 50000 },
      { month: 'Feb', value: 48500 },
      { month: 'Mar', value: 33000 },
      { month: 'Apr', value: 38000 },
      { month: 'Jun', value: 44000 },
      { month: 'Aug', value: 51500 },
      { month: 'Oct', value: 53000 },
      { month: 'Dec', value: 57000 },
    ],
    verdict: "In COVID you'd have dropped to about $33,000 in 5 weeks — fast and scary. But the recovery was even faster: fully back by August. The sellers in March missed one of the best 6-month runs in history.",
  },
  2000: {
    name: 'Dot-Com Bust',
    peakToBottom: -49,
    recoveryYears: 7,
    data: [
      { month: "Mar '00", value: 50000 },
      { month: "Sep '00", value: 41000 },
      { month: "Mar '01", value: 35000 },
      { month: "Sep '01", value: 29000 },
      { month: "Mar '02", value: 28000 },
      { month: "Oct '02", value: 25500 },
      { month: "Mar '03", value: 28000 },
      { month: "Mar '05", value: 38000 },
      { month: "Mar '07", value: 50500 },
    ],
    verdict: "The dot-com bust was a long, slow grind: down to $25,500 over 2.5 years, then 4 more years to recover. This is the scenario most people underestimate — not the depth, but the duration. Patience matters as much as composure.",
  },
};

const YEAR_OPTIONS = [2000, 2008, 2020];

// Sample terms for jargon translation
const SAMPLE_TERMS: Record<string, string> = {
  'expense ratio': "A tiny annual fee a fund charges to run itself, expressed as a percentage. A 0.5% expense ratio means the fund takes 50¢ per year for every $100 you have invested. Lower is almost always better.",
  'index fund': "A type of fund that just buys all the stocks in a list (like the S&P 500) instead of trying to pick winners. Cheaper than other funds because nobody's actively choosing what to buy.",
  '401(k)': "A retirement savings account through your job. Money you put in usually isn't taxed today — you pay taxes when you take it out in retirement. Many employers also match a percentage of what you put in (free money).",
  'dividend': "A small payment some stocks send to shareholders, usually every 3 months. It's the company's way of sharing profits with its owners.",
  'bond': "A loan you give to a company or government. They pay you a fixed amount of interest every year, then return your original money on a set date. Steadier than stocks, smaller upside.",
};

// Fee comparison data for mini chart
const feeComparisonData = [
  { name: 'You', value: 0.32, fill: '#22C55E' },
  { name: 'Average', value: 0.68, fill: '#9CA3AF' },
  { name: 'Best', value: 0.03, fill: '#3B82F6' },
];

export function AITab() {
  const [timeMachineOpen, setTimeMachineOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [yearIndex, setYearIndex] = useState(1);
  const [jargonInput, setJargonInput] = useState('');
  const [jargonMessages, setJargonMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([
    {
      role: 'ai',
      text: "Hi! I'm here to translate financial jargon into plain English. Try asking about expense ratio, index fund, 401(k), dividend, or bond.",
    },
  ]);

  const year = YEAR_OPTIONS[yearIndex];
  const scenario = SCENARIOS[year];
  const minValue = Math.min(...scenario.data.map(d => d.value));
  const peakValue = scenario.data[0].value;

  const handleJargonSend = () => {
    if (!jargonInput.trim()) return;
    const userMsg = jargonInput.trim().toLowerCase();
    const matchedTerm = Object.keys(SAMPLE_TERMS).find(t => userMsg.includes(t));
    const response = matchedTerm
      ? SAMPLE_TERMS[matchedTerm]
      : `I'd explain "${jargonInput.trim()}" in plain English here. (For the demo, try one of these: ${Object.keys(SAMPLE_TERMS).join(', ')})`;

    setJargonMessages([
      ...jargonMessages,
      { role: 'user', text: jargonInput.trim() },
      { role: 'ai', text: response },
    ]);
    setJargonInput('');
  };

  const chatHistory = {
    today: [
      'Should I rebalance after Tesla drop?',
      'Explain my expense ratio',
      'Time machine: 2008 scenario',
    ],
    yesterday: [
      'Compare me to a 30-year-old saver',
      'Translate: convertible bond',
    ],
    earlier: [
      'Help me plan for a baby',
      'Stress test my portfolio',
    ],
  };

  const toolCards = [
    {
      section: 'Quick tools',
      cards: [
        {
          icon: Languages,
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
          title: 'Translate jargon',
          description: 'Highlight any financial term anywhere on the platform for a plain-English explanation.',
          onClick: () => setTranslateOpen(true),
        },
        {
          icon: HeartHandshake,
          iconBg: 'bg-orange-50',
          iconColor: 'text-orange-600',
          title: 'Life events',
          description: "Tell me what's happening — baby, layoff, marriage, market panic — and I'll guide you through it.",
        },
        {
          icon: UserSquare2,
          iconBg: 'bg-purple-50',
          iconColor: 'text-purple-600',
          title: 'What would they do?',
          description: "Compare your portfolio to a cautious retiree, a young saver, or Warren Buffett's known style.",
        },
      ],
    },
    {
      section: 'Reality checks',
      cards: [
        {
          icon: History,
          iconBg: 'bg-indigo-50',
          iconColor: 'text-indigo-600',
          title: 'Portfolio time machine',
          description: 'Drag a slider to 2008 or 2020 — see how your CURRENT holdings would have done in past crises.',
          onClick: () => setTimeMachineOpen(true),
        },
        {
          icon: Moon,
          iconBg: 'bg-slate-100',
          iconColor: 'text-slate-700',
          title: 'Sleep at night test',
          description: "How big a drop could you stomach before panicking? Most people overestimate. Let's find out honestly.",
        },
        {
          icon: Users,
          iconBg: 'bg-cyan-50',
          iconColor: 'text-cyan-600',
          title: 'People like you',
          description: 'Others your age with similar savings typically have 70% stocks. You have 85%. Just context — not advice.',
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
          title: 'Boring score',
          description: '82/100 today. Diversified, low-fee, long-term oriented — boring is exactly what you want.',
        },
        {
          icon: Receipt,
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
          title: 'Hidden cost calculator',
          description: "At your current pace, you'll pay about $14,200 in fees over your lifetime. Watch it shrink as you make changes.",
        },
        {
          icon: FileText,
          iconBg: 'bg-rose-50',
          iconColor: 'text-rose-600',
          title: 'Your investment rules',
          description: 'A one-page document codifying your goals and limits. Read it when markets tempt you to deviate.',
        },
      ],
    },
  ];

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)] min-h-[600px]">
      {/* Left Sidebar */}
      <div className="w-[280px] bg-gray-50 rounded-2xl p-4 flex flex-col">
        {/* Profile */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500" />
            <span className="text-sm font-semibold">Alex Chen</span>
          </div>
          <ChevronsLeft className="w-4 h-4 text-gray-400" />
        </div>

        {/* New Chat Button */}
        <button className="w-full bg-black text-white rounded-xl py-2.5 flex items-center justify-center gap-2 mb-4">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New chat</span>
        </button>

        {/* Nav Items */}
        <nav className="space-y-1 mb-6">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white text-gray-900 font-semibold">
            <Home className="w-4 h-4" />
            <span className="text-sm">AI Home</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-white cursor-pointer">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">Smart tools</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-white cursor-pointer">
            <Lightbulb className="w-4 h-4" />
            <span className="text-sm">My insights</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-white cursor-pointer">
            <Bookmark className="w-4 h-4" />
            <span className="text-sm">Saved scenarios</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-white cursor-pointer">
            <Share2 className="w-4 h-4" />
            <span className="text-sm">Shared with me</span>
          </div>
        </nav>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2 px-1">Today</p>
            {chatHistory.today.map((item, i) => (
              <p key={i} className="px-3 py-1.5 text-[13px] text-gray-700 rounded-md hover:bg-white cursor-pointer truncate">{item}</p>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2 px-1">Yesterday</p>
            {chatHistory.yesterday.map((item, i) => (
              <p key={i} className="px-3 py-1.5 text-[13px] text-gray-700 rounded-md hover:bg-white cursor-pointer truncate">{item}</p>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2 px-1">Earlier this week</p>
            {chatHistory.earlier.map((item, i) => (
              <p key={i} className="px-3 py-1.5 text-[13px] text-gray-700 rounded-md hover:bg-white cursor-pointer truncate">{item}</p>
            ))}
          </div>
        </div>

        {/* Boring Score Card */}
        <div className="bg-white rounded-xl p-3 mt-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="w-3 h-3 text-green-600" />
            <span className="text-[11px] text-gray-500">Boring score</span>
          </div>
          <p className="text-xl font-bold tabular-nums">82/100</p>
          <p className="text-[11px] text-gray-400 mb-2">Higher is healthier</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: '82%' }} />
          </div>
        </div>

        {/* Settings */}
        <div className="flex justify-end mt-3">
          <button className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700">
            <Settings className="w-3 h-3" />
            Settings
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2">
          {/* Greeting */}
          <h1 className="text-[32px] font-bold mb-1">
            {"Welcome back, "}<span className="bg-yellow-100 px-1 rounded">Alex</span>{"! 👋"}
          </h1>
          <p className="text-2xl font-medium text-gray-400 mb-8">How can I help with your money today?</p>

          {/* Continue / Suggested Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Continue Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-gray-500 font-medium">Pick up where you left off</span>
              </div>
              <p className="text-[15px] font-semibold mb-3">Should I rebalance after Tesla drop?</p>
              <div className="flex gap-2">
                <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-md text-[12px] text-gray-600">
                  <FileText className="w-3 h-3 text-yellow-500" />
                  Tesla position analysis
                </span>
                <span className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-md text-[12px] text-gray-600">
                  <TrendingDown className="w-3 h-3 text-blue-500" />
                  Risk reassessment
                </span>
              </div>
            </div>

            {/* Latest Insight Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-500 font-medium">Insight from this week</span>
              </div>
              <p className="text-[15px] font-semibold mb-3">Your fees vs. peers — you could save $40/year</p>
              <div className="h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feeComparisonData} layout="vertical">
                    <XAxis type="number" hide domain={[0, 1]} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={50} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick Suggested Actions */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* Time Machine Suggestion */}
            <div 
              onClick={() => setTimeMachineOpen(true)}
              className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02]"
            >
              <History className="w-6 h-6 text-purple-600 mb-2" />
              <p className="text-[11px] text-purple-700 font-medium uppercase tracking-wide mb-1">Try this</p>
              <p className="text-[15px] font-semibold text-gray-900 mb-1">What if 2008 happened today?</p>
              <p className="text-[13px] text-gray-600 mb-3">See your current portfolio dropped through the worst year in modern markets.</p>
              <span className="text-purple-600 text-sm font-medium">{"Run scenario →"}</span>
            </div>

            {/* Translate Jargon Suggestion */}
            <div 
              onClick={() => setTranslateOpen(true)}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02]"
            >
              <Languages className="w-6 h-6 text-blue-600 mb-2" />
              <p className="text-[11px] text-blue-700 font-medium uppercase tracking-wide mb-1">Try this</p>
              <p className="text-[15px] font-semibold text-gray-900 mb-1">Confused by a term?</p>
              <p className="text-[13px] text-gray-600 mb-3">{"Highlight any word — fund name, news headline, broker email — and I'll explain it in plain English."}</p>
              <span className="text-blue-600 text-sm font-medium">{"Try it now →"}</span>
            </div>
          </div>

          {/* Your Money Tools */}
          <h2 className="text-lg font-bold mb-4">Your money tools</h2>

          {toolCards.map((section) => (
            <div key={section.section} className="mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">{section.section}</h3>
              <div className="grid grid-cols-3 gap-4">
                {section.cards.map((card) => (
                  <div 
                    key={card.title}
                    onClick={card.onClick}
                    className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02] relative group"
                  >
                    <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                      <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                    <p className="text-[15px] font-semibold mt-3 mb-1">{card.title}</p>
                    <p className="text-[13px] text-gray-500 line-clamp-3">{card.description}</p>
                    <ArrowUpRight className="w-4 h-4 text-gray-400 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky Prompt Input */}
        <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-3 flex items-center gap-2">
            <button className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-gray-500" />
            </button>
            <input 
              type="text"
              placeholder="Ask anything about your money. Use @ to reference a fund or holding..."
              className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-400"
            />
            <button className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gray-500" />
            </button>
            <button className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center cursor-not-allowed">
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            {["What's a stock, really?", 'Am I doing okay?', 'What should I worry about?', 'Help me make a goal'].map((chip) => (
              <button key={chip} className="px-3 py-1 rounded-full border border-gray-200 text-[12px] text-gray-700 hover:bg-gray-50">
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Time Machine Modal */}
      <Dialog open={timeMachineOpen} onOpenChange={setTimeMachineOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <History className="w-5 h-5 text-indigo-600" />
              </div>
              <DialogTitle className="text-xl">Portfolio time machine</DialogTitle>
            </div>
            <p className="text-sm text-gray-500">
              {"Drag the slider to a past crisis. We'll show how your current $50,000 portfolio would have evolved."}
            </p>
          </DialogHeader>

          {/* Year selector */}
          <div className="my-6">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              {YEAR_OPTIONS.map((y) => (
                <span key={y} className={year === y ? 'text-indigo-600 font-semibold' : ''}>
                  {y}
                </span>
              ))}
            </div>
            <Slider
              value={[yearIndex]}
              onValueChange={(v) => setYearIndex(v[0])}
              min={0}
              max={YEAR_OPTIONS.length - 1}
              step={1}
              className="w-full"
            />
          </div>

          {/* Scenario stats */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {year} — {scenario.name}
              </div>
              <div className="text-2xl font-bold mt-1 tabular-nums">
                ${minValue.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">at the worst point</div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-red-600 font-bold text-lg">
                  <TrendingDown className="w-4 h-4" />
                  {scenario.peakToBottom}%
                </div>
                <div className="text-xs text-gray-500">Peak to bottom</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-green-600 font-bold text-lg">
                  <TrendingUp className="w-4 h-4" />
                  {scenario.recoveryYears}y
                </div>
                <div className="text-xs text-gray-500">To recover</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scenario.data}>
                <defs>
                  <linearGradient id="tmFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }}
                       tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: 'none', borderRadius: 8, color: 'white', fontSize: 13 }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, 'Value']}
                />
                <ReferenceLine y={peakValue} stroke="#9CA3AF" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} fill="url(#tmFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Verdict */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-900 mb-1">What this means</div>
              <p className="text-sm text-amber-900/80 leading-relaxed">{scenario.verdict}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Translate Jargon Modal */}
      <Dialog open={translateOpen} onOpenChange={setTranslateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Languages className="w-5 h-5 text-blue-600" />
              </div>
              <DialogTitle className="text-xl">Translate jargon</DialogTitle>
            </div>
            <p className="text-sm text-gray-500">{"Type any financial term — I'll explain it like a friend."}</p>
          </DialogHeader>

          {/* Conversation */}
          <div className="bg-gray-50 rounded-xl p-4 max-h-80 overflow-y-auto space-y-3 my-4">
            {jargonMessages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed max-w-[80%] ${
                  m.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={jargonInput}
              onChange={(e) => setJargonInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJargonSend(); }}
              placeholder="Type a term, e.g. expense ratio..."
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleJargonSend}
              className="px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
