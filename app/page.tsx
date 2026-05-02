'use client';

import { useState } from 'react';
import { Settings, Bell, ChevronDown, TrendingUp, TrendingDown, MoreHorizontal, CreditCard, Wallet, PiggyBank, BarChart3, Activity, Sparkles, HelpCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RadialBarChart } from '@/components/radial-bar-chart';
import { AITab } from '@/components/ai-tab/ai-tab';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'investment', label: 'Investment', icon: TrendingUp },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'saving', label: 'Saving', icon: PiggyBank },
  { id: 'ai', label: 'AI', icon: Sparkles },
];

const topGainers = [
  { ticker: 'AAPL', price: 189.84, change: 12.04, color: '#000000' },
  { ticker: 'AIRBNB', price: 156.32, change: 8.21, color: '#FF5A5F' },
  { ticker: 'NVDA', price: 875.28, change: 24.56, color: '#76B900' },
  { ticker: 'AMZN', price: 178.25, change: 5.67, color: '#FF9900' },
  { ticker: 'SPOT', price: 298.45, change: 11.32, color: '#1DB954' },
  { ticker: 'TSLA', price: 248.50, change: 15.89, color: '#CC0000' },
];

const chartData = [
  { month: 'Jan', value: 2800 },
  { month: 'Feb', value: 3200 },
  { month: 'Mar', value: 3100 },
  { month: 'Apr', value: 4200 },
  { month: 'May', value: 4800 },
  { month: 'Jun', value: 5980 },
  { month: 'Jul', value: 5400 },
  { month: 'Aug', value: 5800 },
  { month: 'Sep', value: 6200 },
  { month: 'Oct', value: 6800 },
  { month: 'Nov', value: 7100 },
  { month: 'Dec', value: 7500 },
];

const portfolioDistribution = [
  { ticker: 'AAPL', percentage: 40, value: 7518.00, color: '#6366F1' },
  { ticker: 'AIRBNB', percentage: 27, value: 5102.00, color: '#A855F7' },
  { ticker: 'NVDA', percentage: 21, value: 3916.00, color: '#F97316' },
  { ticker: 'AMZN', percentage: 12, value: 2518.00, color: '#22C55E' },
];

const myAssets = [
  { ticker: 'AAPL', name: 'Apple Inc.', percentage: 40, value: 7518.00, change: 12.04, isPositive: true, color: '#000000' },
  { ticker: 'AIRBNB', name: 'Airbnb Inc.', percentage: 40, value: 5102.00, change: 1.8, isPositive: true, color: '#FF5A5F' },
  { ticker: 'NVDA', name: 'NVIDIA Corp', percentage: 40, value: 3916.00, change: 2.3, isPositive: false, color: '#76B900' },
  { ticker: 'AMZN', name: 'Amazon.com', percentage: 40, value: 2518.00, change: 7.01, isPositive: true, color: '#FF9900' },
];

const marketInsights = [
  { 
    title: 'Tesla Rises 6% After Q2 Sales Report', 
    description: 'Tesla (TSLA) shares surged 6% after the company reported strong Q2 sales...',
    image: 'TSLA'
  },
  { 
    title: 'Apple Announces $100 Billion Share Buyback', 
    description: 'Apple (AAPL) announced the largest share buyback in company history...',
    image: 'AAPL'
  },
  { 
    title: 'Meta Launches AI-Powered Ad Platform', 
    description: 'Meta shares surged after launching their new AI advertising platform...',
    image: 'META'
  },
  { 
    title: 'Shares of Bank Indonesia Fall Due to Interest...', 
    description: 'Several major banking stocks such as BBRI and BMRI declined...',
    image: 'BANK'
  },
];

const transactions = [
  { type: 'buy', ticker: 'AAPL', shares: 10, amount: 1898.40, date: '2025-04-28' },
  { type: 'sell', ticker: 'TSLA', shares: 5, amount: 1242.50, date: '2025-04-27' },
  { type: 'buy', ticker: 'NVDA', shares: 3, amount: 2625.84, date: '2025-04-26' },
  { type: 'dividend', ticker: 'AAPL', shares: 0, amount: 24.50, date: '2025-04-25' },
  { type: 'buy', ticker: 'AMZN', shares: 8, amount: 1426.00, date: '2025-04-24' },
];

const cards = [
  { type: 'Visa', last4: '4532', balance: 12458.00, limit: 25000, color: 'from-indigo-500 to-purple-600' },
  { type: 'Mastercard', last4: '8821', balance: 3240.50, limit: 15000, color: 'from-gray-800 to-gray-900' },
];

const savingsGoals = [
  { name: 'Emergency Fund', current: 8500, target: 10000, color: '#22C55E' },
  { name: 'Vacation', current: 2400, target: 5000, color: '#3B82F6' },
  { name: 'New Car', current: 12000, target: 35000, color: '#F97316' },
  { name: 'Investment', current: 15000, target: 20000, color: '#8B5CF6' },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    const percentage = ((payload[0].value / 7500) * 100).toFixed(0);
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-xl shadow-lg">
        <p className="font-semibold tabular-nums">${payload[0].value.toLocaleString()} ({percentage}%)</p>
        <p className="text-xs text-gray-300">{label} 2025</p>
      </div>
    );
  }
  return null;
}

export default function PortfolioDashboard() {
  const [activeTab, setActiveTab] = useState('investment');

  return (
    <div className="min-h-screen bg-[#0B1238] p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Top Navigation */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-lg">Steady</span>
          </div>

          <nav className="flex items-center bg-gray-100 rounded-full p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full" />
          </div>
        </header>

        <main className="p-6 space-y-6">
          {activeTab === 'investment' && <InvestmentTab />}
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'card' && <CardTab />}
          {activeTab === 'activity' && <ActivityTab />}
          {activeTab === 'saving' && <SavingTab />}
          {activeTab === 'ai' && <AITab />}
        </main>

        {/* Floating Help Button - appears on all tabs except AI */}
        {activeTab !== 'ai' && (
          <button
            onClick={() => setActiveTab('ai')}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center z-50 group"
            aria-label="Get AI help"
          >
            <HelpCircle className="w-6 h-6 group-hover:hidden" />
            <Sparkles className="w-6 h-6 hidden group-hover:block" />
          </button>
        )}
      </div>
    </div>
  );
}

function InvestmentTab() {
  return (
    <>
      {/* Top Gainers */}
      <div className="bg-gray-50 rounded-2xl p-4">
        <div className="flex items-center gap-6">
          <span className="text-xs text-gray-500 font-medium">Top gainers:</span>
          <div className="flex items-center gap-6 overflow-x-auto">
            {topGainers.map((stock) => (
              <div key={stock.ticker} className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: stock.color }}
                >
                  {stock.ticker[0]}
                </div>
                <div>
                  <p className="font-semibold text-sm">{stock.ticker}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 tabular-nums">${stock.price.toFixed(2)}</span>
                    <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      +{stock.change.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Portfolio Value Chart */}
        <div className="col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Portfolio Value</h2>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-full text-sm text-gray-600">
                Yearly <ChevronDown className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:bg-gray-100 rounded-full">
                <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-4xl font-bold tabular-nums">$134,815.00</span>
            <span className="bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-sm font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              1.77
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-6">+ $19,698.00 from last years</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x="Jun" stroke="#6366F1" strokeOpacity={0.2} strokeWidth={40} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#6366F1" 
                  strokeWidth={2}
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Total Profits */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Total Profits</h2>
            <button className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-full text-sm text-gray-600">
              Yearly <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex justify-center mb-6">
            <RadialBarChart />
          </div>

          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-gray-600">Stocks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-gray-600">Funds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-gray-600">Bonds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-gray-600">Red Stocks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Portfolio Distribution */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Portfolio Distribution</h2>
            <button className="text-xs text-gray-500 hover:text-gray-700">View All</button>
          </div>
          
          <div className="h-3 rounded-full overflow-hidden flex mb-6">
            {portfolioDistribution.map((item, index) => (
              <div 
                key={item.ticker}
                className="h-full"
                style={{ 
                  width: `${item.percentage}%`, 
                  backgroundColor: item.color,
                  backgroundImage: index % 2 === 0 
                    ? 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.2) 2px, rgba(255,255,255,0.2) 4px)'
                    : 'none'
                }}
              />
            ))}
          </div>

          <div className="space-y-4">
            {portfolioDistribution.map((item) => (
              <div key={item.ticker} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="font-semibold text-sm">{item.ticker}</p>
                    <p className="text-xs text-gray-500">{item.percentage}%</p>
                  </div>
                </div>
                <span className="font-semibold text-sm tabular-nums">${item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* My Assets */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">My Assets</h2>
            <button className="text-xs text-gray-500 hover:text-gray-700">View All</button>
          </div>

          <div className="space-y-4">
            {myAssets.map((asset) => (
              <div key={asset.ticker} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: asset.color }}
                  >
                    {asset.ticker[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{asset.ticker}</p>
                    <p className="text-xs text-gray-500">{asset.percentage}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm tabular-nums">${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${asset.isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {asset.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {asset.isPositive ? '+' : '-'}{asset.change}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Insight */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Market Insight</h2>
            <button className="text-xs text-gray-500 hover:text-gray-700">View All</button>
          </div>

          <div className="space-y-4">
            {marketInsights.map((insight, index) => (
              <div key={index} className="flex gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500">
                  {insight.image}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{insight.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardTab() {
  const totalValue = 134815.00;
  const todayChange = 1247.32;
  const todayChangePercent = 0.93;

  return (
    <>
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Good morning, Alex</h1>
          <p className="text-gray-500">Here&apos;s your portfolio overview</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
            + Add Funds
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors">
            Withdraw
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
          <p className="text-sm opacity-80">Total Portfolio Value</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+${todayChange.toLocaleString()} ({todayChangePercent}%) today</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Available Cash</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">$4,523.00</p>
          <p className="text-xs text-gray-400 mt-2">Ready to invest</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Returns</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-green-600">+$19,698.00</p>
          <p className="text-xs text-gray-400 mt-2">All time</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-sm text-gray-500">Dividends Earned</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">$842.50</p>
          <p className="text-xs text-gray-400 mt-2">This year</p>
        </div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {transactions.slice(0, 4).map((tx, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.type === 'buy' ? 'bg-green-50' : tx.type === 'sell' ? 'bg-red-50' : 'bg-blue-50'
                  }`}>
                    {tx.type === 'buy' && <TrendingUp className="w-5 h-5 text-green-600" />}
                    {tx.type === 'sell' && <TrendingDown className="w-5 h-5 text-red-500" />}
                    {tx.type === 'dividend' && <Wallet className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm capitalize">{tx.type} {tx.ticker}</p>
                    <p className="text-xs text-gray-500">{tx.shares > 0 ? `${tx.shares} shares` : 'Dividend payment'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm tabular-nums ${tx.type === 'sell' || tx.type === 'dividend' ? 'text-green-600' : ''}`}>
                    {tx.type === 'buy' ? '-' : '+'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-400">{tx.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <span className="text-sm font-medium">Buy</span>
            </button>
            <button className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center">
              <TrendingDown className="w-6 h-6 mx-auto mb-2 text-red-500" />
              <span className="text-sm font-medium">Sell</span>
            </button>
            <button className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center">
              <Wallet className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <span className="text-sm font-medium">Transfer</span>
            </button>
            <button className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-center">
              <BarChart3 className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <span className="text-sm font-medium">Analysis</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function CardTab() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Cards</h1>
          <p className="text-gray-500">Manage your payment methods</p>
        </div>
        <button className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
          + Add Card
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {cards.map((card, index) => (
          <div key={index} className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <span className="text-lg font-medium">{card.type}</span>
                <CreditCard className="w-8 h-8 opacity-80" />
              </div>
              
              <p className="text-lg tracking-widest mb-6 font-mono">•••• •••• •••• {card.last4}</p>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-70">Balance</p>
                  <p className="text-xl font-bold tabular-nums">${card.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Limit</p>
                  <p className="text-sm font-medium tabular-nums">${card.limit.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Recent Card Transactions</h2>
        <div className="space-y-3">
          {[
            { merchant: 'Apple Store', amount: 1299.00, date: '2025-04-28', category: 'Electronics' },
            { merchant: 'Whole Foods', amount: 87.43, date: '2025-04-27', category: 'Groceries' },
            { merchant: 'Netflix', amount: 15.99, date: '2025-04-26', category: 'Subscription' },
            { merchant: 'Uber', amount: 24.50, date: '2025-04-25', category: 'Transport' },
          ].map((tx, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">{tx.merchant}</p>
                  <p className="text-xs text-gray-500">{tx.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm tabular-nums">-${tx.amount.toFixed(2)}</p>
                <p className="text-xs text-gray-400">{tx.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ActivityTab() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-gray-500">Your recent transactions and updates</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium">All</button>
          <button className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-full text-sm">Buys</button>
          <button className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-full text-sm">Sells</button>
          <button className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-full text-sm">Dividends</button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          {transactions.concat([
            { type: 'sell', ticker: 'AIRBNB', shares: 3, amount: 468.96, date: '2025-04-23' },
            { type: 'buy', ticker: 'SPOT', shares: 5, amount: 1492.25, date: '2025-04-22' },
            { type: 'dividend', ticker: 'NVDA', shares: 0, amount: 18.75, date: '2025-04-21' },
          ]).map((tx, index) => (
            <div key={index} className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  tx.type === 'buy' ? 'bg-green-50' : tx.type === 'sell' ? 'bg-red-50' : 'bg-blue-50'
                }`}>
                  {tx.type === 'buy' && <TrendingUp className="w-6 h-6 text-green-600" />}
                  {tx.type === 'sell' && <TrendingDown className="w-6 h-6 text-red-500" />}
                  {tx.type === 'dividend' && <Wallet className="w-6 h-6 text-blue-600" />}
                </div>
                <div>
                  <p className="font-semibold">
                    {tx.type === 'buy' && 'Bought '}
                    {tx.type === 'sell' && 'Sold '}
                    {tx.type === 'dividend' && 'Dividend from '}
                    {tx.ticker}
                  </p>
                  <p className="text-sm text-gray-500">
                    {tx.shares > 0 ? `${tx.shares} shares @ $${(tx.amount / tx.shares).toFixed(2)}` : 'Quarterly dividend payment'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold tabular-nums ${tx.type === 'buy' ? 'text-gray-900' : 'text-green-600'}`}>
                  {tx.type === 'buy' ? '-' : '+'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-400">{tx.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SavingTab() {
  const totalSavings = savingsGoals.reduce((acc, goal) => acc + goal.current, 0);
  const totalTarget = savingsGoals.reduce((acc, goal) => acc + goal.target, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Savings Goals</h1>
          <p className="text-gray-500">Track your progress towards your financial goals</p>
        </div>
        <button className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
          + New Goal
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
          <PiggyBank className="w-10 h-10 mb-4 opacity-80" />
          <p className="text-sm opacity-80">Total Savings</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">${totalSavings.toLocaleString()}</p>
          <div className="mt-4 bg-white/20 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all"
              style={{ width: `${(totalSavings / totalTarget) * 100}%` }}
            />
          </div>
          <p className="text-sm mt-2 opacity-80">{((totalSavings / totalTarget) * 100).toFixed(0)}% of total goals</p>
        </div>

        <div className="col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold mb-4">Auto-Deposit</h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium">Weekly deposit</p>
              <p className="text-sm text-gray-500">Every Monday</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums">$250.00</p>
              <p className="text-xs text-green-600">Active</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {savingsGoals.map((goal, index) => (
          <div key={index} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{goal.name}</h3>
              <span className="text-sm text-gray-500">{((goal.current / goal.target) * 100).toFixed(0)}%</span>
            </div>
            
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div 
                className="h-full rounded-full transition-all"
                style={{ width: `${(goal.current / goal.target) * 100}%`, backgroundColor: goal.color }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold tabular-nums">${goal.current.toLocaleString()}</span>
              <span className="text-gray-500 tabular-nums">of ${goal.target.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
