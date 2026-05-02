# Portfolio Management Dashboard - Implementation Specification

A Robinhood-style portfolio management UI with 6 tabs (including AI assistant), clean design, and modern aesthetics.

---

## NEW: AI Tab and Floating Help Button

### Floating Help Button
A persistent help button appears on ALL tabs except the AI tab:
- Position: `fixed bottom-8 right-8`
- Size: 56x56px (w-14 h-14)
- Style: `rounded-full bg-gradient-to-br from-indigo-500 to-purple-600`
- Icons: HelpCircle by default, Sparkles on hover
- Action: Clicking navigates to AI tab (`setActiveTab('ai')`)
- z-index: 50

```jsx
{activeTab !== 'ai' && (
  <button
    onClick={() => setActiveTab('ai')}
    className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center z-50 group"
  >
    <HelpCircle className="w-6 h-6 group-hover:hidden" />
    <Sparkles className="w-6 h-6 hidden group-hover:block" />
  </button>
)}
```

### AI Tab Structure
The AI tab is a two-column layout inside the existing app card:
- Left sidebar: 280px wide, bg-gray-50, rounded-2xl
- Right main area: flex-1, white background

#### Left Sidebar Components:
1. **Profile Row**: 32px avatar (gradient indigo to purple) + "Alex Chen" + ChevronsLeft icon
2. **New Chat Button**: Full width, bg-black text-white, rounded-xl, py-2.5
3. **Nav Items** (space-y-1, each item px-3 py-2 rounded-lg):
   - AI Home (active: bg-white text-gray-900 font-semibold)
   - Smart tools (Sparkles icon)
   - My insights (Lightbulb icon)
   - Saved scenarios (Bookmark icon)
   - Shared with me (Share2 icon)
4. **Chat History**: Grouped by Today/Yesterday/Earlier with date labels (text-xs text-gray-500)
   - Each item: px-3 py-1.5 text-[13px] text-gray-700 rounded-md hover:bg-white truncate
5. **Boring Score Card**: White card, rounded-xl, p-3
   - Shield icon + "Boring score" label
   - "82/100" (text-xl font-bold tabular-nums)
   - "Higher is healthier" caption
   - Progress bar (h-1.5 bg-green-500)
6. **Settings Link**: Bottom right, text-[12px] text-gray-500

#### Main Workspace:
1. **Greeting**: 
   ```jsx
   <h1 className="text-[32px] font-bold mb-1">
     Welcome back, <span className="bg-yellow-100 px-1 rounded">Alex</span>! 👋
   </h1>
   ```
2. **Subtitle**: `text-2xl font-medium text-gray-400 mb-8`
3. **Continue/Suggested Row** (grid grid-cols-2 gap-4 mb-6):
   - Card 1: "Pick up where you left off" with Sparkles icon, file pills
   - Card 2: "Latest insight" with Lightbulb icon, mini bar chart
4. **Quick Suggested Actions** (grid grid-cols-2 gap-4 mb-8):
   - Time Machine card: `bg-gradient-to-br from-purple-50 to-indigo-50`
   - Translate Jargon card: `bg-gradient-to-br from-blue-50 to-cyan-50`
5. **Your Money Tools**: 9 tool cards in 3 sections
   - Section heading: `text-lg font-bold mb-4`
   - Subsection heading: `text-base font-semibold text-gray-900 mb-3`
   - Cards: `grid grid-cols-3 gap-4`
   
   **Quick tools**:
   - Translate jargon (blue-50/blue-600)
   - Life events (orange-50/orange-600)
   - What would they do? (purple-50/purple-600)
   
   **Reality checks**:
   - Portfolio time machine (indigo-50/indigo-600)
   - Sleep at night test (slate-100/slate-700)
   - People like you (cyan-50/cyan-600)
   
   **Health & rules**:
   - Boring score (green-50/green-600)
   - Hidden cost calculator (amber-50/amber-600)
   - Your investment rules (rose-50/rose-600)

6. **Sticky Prompt Input**: `sticky bottom-0 bg-white pt-4 border-t border-gray-100`
   - Input bar: bg-gray-50 rounded-2xl p-3 flex items-center gap-2
   - Suggestion chips below

### Time Machine Modal
Opens via Dialog component:
- Year slider: 2000, 2008, 2020 (using Slider component)
- Stats card: Year name, worst value, peak-to-bottom %, recovery years
- AreaChart showing portfolio value through crisis
- Verdict box: amber-50 with AlertTriangle icon

**Scenario Data**:
```javascript
const SCENARIOS = {
  2008: { name: 'Global Financial Crisis', peakToBottom: -55, recoveryYears: 4, ... },
  2020: { name: 'COVID Crash', peakToBottom: -34, recoveryYears: 0.5, ... },
  2000: { name: 'Dot-Com Bust', peakToBottom: -49, recoveryYears: 7, ... },
};
```

### Translate Jargon Modal
Chat-style dialog:
- AI avatar: gradient blue to cyan
- User messages: bg-black text-white rounded-2xl
- AI messages: bg-white border border-gray-200 rounded-2xl
- Pre-loaded terms: expense ratio, index fund, 401(k), dividend, bond

---

## Updated Tab Definitions

```javascript
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'investment', label: 'Investment', icon: TrendingUp },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'saving', label: 'Saving', icon: PiggyBank },
  { id: 'ai', label: 'AI', icon: Sparkles },  // NEW
];
```

---

## AI Tab File Structure

```
components/
  ai-tab/
    ai-tab.tsx          # Main AI tab component with all features
```

---

## Additional Icons for AI Tab

```javascript
import { 
  ChevronsLeft, Plus, Home, Sparkles, Lightbulb, Bookmark, Share2, 
  Settings, History, Languages, HeartHandshake, UserSquare2, Moon, 
  Users, Shield, Receipt, FileText, ArrowUpRight, ArrowUp, 
  TrendingDown, TrendingUp, AlertTriangle, HelpCircle
} from 'lucide-react';
```

---

---

## Overview

- **Name**: Steady
- **Framework**: Next.js 14+ (App Router), React 18+
- **Styling**: Tailwind CSS
- **Charts**: Recharts (recharts npm package)
- **Icons**: Lucide React (lucide-react npm package)

---

## Design System

### Colors

```
Primary Background (outer frame): #0B1238 (deep navy)
Card Background: #FFFFFF
Text Primary: #111827 (gray-900)
Text Secondary: #6B7280 (gray-500)
Text Muted: #9CA3AF (gray-400)
Border: #F3F4F6 (gray-100)
Hover State: #F9FAFB (gray-50)

Accent Colors:
- Green (positive): #22C55E, #10B981, #16A34A
- Red (negative): #EF4444, #DC2626
- Blue: #3B82F6, #6366F1 (indigo)
- Purple: #8B5CF6, #A855F7
- Orange: #F97316
- Pink: #EC4899
```

### Typography

- Font: System default (Geist if available)
- Numbers: Use `tabular-nums` class for all financial figures
- Headings: font-bold, text-lg to text-2xl
- Body: text-sm, font-medium or font-semibold

### Border Radius

- Cards: rounded-2xl (16px)
- Buttons/Pills: rounded-full
- Small elements: rounded-xl (12px)
- Progress bars: rounded-full

### Shadows

- Cards: shadow-sm
- Outer container: shadow-xl

---

## Layout Structure

### Page Container

```jsx
<div className="min-h-screen bg-[#0B1238] p-4">
  <div className="max-w-7xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
    {/* Header */}
    {/* Main Content */}
  </div>
</div>
```

### Header

```jsx
<header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
  {/* Logo */}
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
      <span className="text-white font-bold text-sm">S</span>
    </div>
    <span className="font-bold text-lg">Steady</span>
  </div>

  {/* Tab Navigation */}
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

  {/* Right Actions */}
  <div className="flex items-center gap-3">
    <button className="p-2 hover:bg-gray-100 rounded-full">
      <Settings className="w-5 h-5 text-gray-600" />
    </button>
    <button className="p-2 hover:bg-gray-100 rounded-full relative">
      <Bell className="w-5 h-5 text-gray-600" />
      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
    </button>
    <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full" />
  </div>
</header>
```

---

## Tab Definitions

```javascript
const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'investment', label: 'Investment' },
  { id: 'card', label: 'Card' },
  { id: 'activity', label: 'Activity' },
  { id: 'saving', label: 'Saving' },
];
```

State management:
```javascript
const [activeTab, setActiveTab] = useState('investment');
```

---

## Tab 1: Investment (Default Tab)

### Section 1: Top Gainers Strip

Horizontal scrollable strip showing top performing stocks.

```javascript
const topGainers = [
  { ticker: 'AAPL', price: 189.84, change: 12.04, color: '#000000' },
  { ticker: 'AIRBNB', price: 156.32, change: 8.21, color: '#FF5A5F' },
  { ticker: 'NVDA', price: 875.28, change: 24.56, color: '#76B900' },
  { ticker: 'AMZN', price: 178.25, change: 5.67, color: '#FF9900' },
  { ticker: 'SPOT', price: 298.45, change: 11.32, color: '#1DB954' },
  { ticker: 'TSLA', price: 248.50, change: 15.89, color: '#CC0000' },
];
```

**Layout**:
```jsx
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
```

### Section 2: Portfolio Value Chart (2/3 width) + Total Profits Radial (1/3 width)

**Grid Layout**: `grid grid-cols-3 gap-6`

#### Portfolio Value Card (col-span-2)

```javascript
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
```

**Features**:
- Title: "Portfolio Value"
- Dropdown: "Yearly" selector
- Large value: $134,815.00
- Change badge: Green pill with +1.77 and TrendingUp icon
- Subtext: "+ $19,698.00 from last years"
- Recharts AreaChart with gradient fill
- Custom tooltip showing value and percentage

**Chart Config**:
```jsx
<AreaChart data={chartData}>
  <defs>
    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
    </linearGradient>
  </defs>
  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
  <Tooltip content={<CustomTooltip />} />
  <ReferenceLine x="Jun" stroke="#6366F1" strokeOpacity={0.2} strokeWidth={40} />
  <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} fill="url(#colorValue)" />
</AreaChart>
```

**Custom Tooltip**:
```jsx
function CustomTooltip({ active, payload, label }) {
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
```

#### Total Profits Radial Chart

**Features**:
- Title: "Total Profits"
- Dropdown: "Yearly" selector
- Custom SVG radial bar chart (see component below)
- Center: $8,436, -$268.20, "from last years"
- Legend: Stocks (green), Funds (blue), Bonds (purple), Red Stocks (red)

### Section 3: Bento Grid (3 columns)

**Grid Layout**: `grid grid-cols-3 gap-6`

#### Column 1: Portfolio Distribution

```javascript
const portfolioDistribution = [
  { ticker: 'AAPL', percentage: 40, value: 7518.00, color: '#6366F1' },
  { ticker: 'AIRBNB', percentage: 27, value: 5102.00, color: '#A855F7' },
  { ticker: 'NVDA', percentage: 21, value: 3916.00, color: '#F97316' },
  { ticker: 'AMZN', percentage: 12, value: 2518.00, color: '#22C55E' },
];
```

**Features**:
- Horizontal stacked bar showing distribution
- Alternating bars have striped pattern
- List of assets with colored dot, ticker, percentage, and dollar value

#### Column 2: My Assets

```javascript
const myAssets = [
  { ticker: 'AAPL', name: 'Apple Inc.', percentage: 40, value: 7518.00, change: 12.04, isPositive: true, color: '#000000' },
  { ticker: 'AIRBNB', name: 'Airbnb Inc.', percentage: 40, value: 5102.00, change: 1.8, isPositive: true, color: '#FF5A5F' },
  { ticker: 'NVDA', name: 'NVIDIA Corp', percentage: 40, value: 3916.00, change: 2.3, isPositive: false, color: '#76B900' },
  { ticker: 'AMZN', name: 'Amazon.com', percentage: 40, value: 2518.00, change: 7.01, isPositive: true, color: '#FF9900' },
];
```

**Features**:
- Each asset: colored icon (rounded-xl), ticker, percentage, value, change with arrow

#### Column 3: Market Insight

```javascript
const marketInsights = [
  { 
    title: 'Tesla Rises 6% After Q2 Sales Report', 
    description: 'Tesla (TSLA) shares surged 6% after the company reported strong Q2 sales...',
    image: 'TSLA'
  },
  // ... more items
];
```

**Features**:
- Each insight: small image placeholder, title (line-clamp-1), description (line-clamp-2)

---

## Tab 2: Dashboard

### Welcome Section

```jsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold">Good morning, Alex</h1>
    <p className="text-gray-500">Here&apos;s your portfolio overview</p>
  </div>
  <div className="flex gap-3">
    <button className="px-4 py-2 bg-black text-white rounded-full text-sm font-medium">+ Add Funds</button>
    <button className="px-4 py-2 border border-gray-200 rounded-full text-sm font-medium">Withdraw</button>
  </div>
</div>
```

### Stats Cards (4 columns)

```jsx
<div className="grid grid-cols-4 gap-4">
  {/* Card 1: Total Portfolio Value - Gradient purple */}
  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
    <p className="text-sm opacity-80">Total Portfolio Value</p>
    <p className="text-2xl font-bold mt-1 tabular-nums">$134,815.00</p>
    <div className="flex items-center gap-1 mt-2 text-sm">
      <TrendingUp className="w-4 h-4" />
      <span>+$1,247.32 (0.93%) today</span>
    </div>
  </div>
  
  {/* Card 2: Available Cash */}
  {/* Card 3: Total Returns (green text) */}
  {/* Card 4: Dividends Earned */}
</div>
```

### Recent Activity + Quick Actions (2 column layout)

- Recent Activity (col-span-2): List of transactions
- Quick Actions: 2x2 grid with Buy, Sell, Transfer, Analysis buttons

---

## Tab 3: Card

### Header with "Your Cards" title and "+ Add Card" button

### Card Display (2 columns)

```javascript
const cards = [
  { type: 'Visa', last4: '4532', balance: 12458.00, limit: 25000, color: 'from-indigo-500 to-purple-600' },
  { type: 'Mastercard', last4: '8821', balance: 3240.50, limit: 15000, color: 'from-gray-800 to-gray-900' },
];
```

**Card Design**:
```jsx
<div className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 text-white relative overflow-hidden`}>
  {/* Decorative circles */}
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
        <p className="text-xl font-bold tabular-nums">${card.balance}</p>
      </div>
      <div className="text-right">
        <p className="text-xs opacity-70">Limit</p>
        <p className="text-sm font-medium tabular-nums">${card.limit}</p>
      </div>
    </div>
  </div>
</div>
```

### Recent Card Transactions list

---

## Tab 4: Activity

### Header with filter pills: All | Buys | Sells | Dividends

### Transaction List

```javascript
const transactions = [
  { type: 'buy', ticker: 'AAPL', shares: 10, amount: 1898.40, date: '2025-04-28' },
  { type: 'sell', ticker: 'TSLA', shares: 5, amount: 1242.50, date: '2025-04-27' },
  { type: 'buy', ticker: 'NVDA', shares: 3, amount: 2625.84, date: '2025-04-26' },
  { type: 'dividend', ticker: 'AAPL', shares: 0, amount: 24.50, date: '2025-04-25' },
  { type: 'buy', ticker: 'AMZN', shares: 8, amount: 1426.00, date: '2025-04-24' },
];
```

**Transaction Row**:
- Icon: Green bg for buy (TrendingUp), Red bg for sell (TrendingDown), Blue bg for dividend (Wallet)
- Text: "Bought/Sold/Dividend from {ticker}"
- Subtext: "{shares} shares @ ${price}" or "Quarterly dividend payment"
- Amount: Red for buy outflows, Green for sell/dividend inflows
- Date

---

## Tab 5: Saving

### Header with "Savings Goals" title and "+ New Goal" button

### Overview Row (3 columns)

```javascript
const savingsGoals = [
  { name: 'Emergency Fund', current: 8500, target: 10000, color: '#22C55E' },
  { name: 'Vacation', current: 2400, target: 5000, color: '#3B82F6' },
  { name: 'New Car', current: 12000, target: 35000, color: '#F97316' },
  { name: 'Investment', current: 15000, target: 20000, color: '#8B5CF6' },
];
```

**Left Card (col-span-1)**: Total Savings gradient card (green)
- PiggyBank icon
- Total amount
- Progress bar
- Percentage of total goals

**Right Card (col-span-2)**: Auto-Deposit settings
- Weekly deposit amount ($250.00)
- Schedule (Every Monday)
- Status (Active)

### Goals Grid (2 columns)

Each goal card:
- Name + percentage
- Colored progress bar
- Current amount + "of ${target}"

---

## Custom Radial Bar Chart Component

Create this as a separate component: `components/radial-bar-chart.tsx`

```tsx
'use client';

interface Props {
  size?: number;
  centerValue?: string;
  centerSubvalue?: string;
  centerCaption?: string;
}

export function RadialBarChart({
  size = 240,
  centerValue = '$8,436',
  centerSubvalue = '-$268.20',
  centerCaption = 'from last years',
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rInner = size * 0.32;
  const rOuterBase = size * 0.40;
  const rOuterMax = size * 0.48;

  const numBars = 90;

  // Pseudo-random height based on index
  const heightAt = (i: number) => {
    const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return 0.35 + (seed - Math.floor(seed)) * 0.65;
  };

  // Color based on angle (rainbow effect)
  const colorAt = (angle: number) => {
    const a = ((angle % 360) + 360) % 360;
    if (a < 50)  return '#EF4444'; // red
    if (a < 90)  return '#F97316'; // orange
    if (a < 130) return '#FBBF24'; // yellow
    if (a < 180) return '#22C55E'; // green
    if (a < 230) return '#10B981'; // teal
    if (a < 270) return '#3B82F6'; // blue
    if (a < 320) return '#8B5CF6'; // purple
    return '#EC4899'; // pink
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {Array.from({ length: numBars }).map((_, i) => {
          const angleDeg = (i / numBars) * 360 - 90;
          const rad = (angleDeg * Math.PI) / 180;
          const h = heightAt(i);
          const rOuter = rOuterBase + (rOuterMax - rOuterBase) * h;

          const x1 = cx + rInner * Math.cos(rad);
          const y1 = cy + rInner * Math.sin(rad);
          const x2 = cx + rOuter * Math.cos(rad);
          const y2 = cy + rOuter * Math.sin(rad);

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colorAt((i / numBars) * 360)}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.75 + h * 0.25}
            />
          );
        })}

        <circle
          cx={cx}
          cy={cy}
          r={rInner - 4}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={1}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-2xl font-bold tabular-nums text-gray-900">
          {centerValue}
        </div>
        <div className="text-sm text-gray-500 tabular-nums mt-1">
          {centerSubvalue}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{centerCaption}</div>
      </div>
    </div>
  );
}
```

---

## Required Imports

```javascript
// React
import { useState } from 'react';

// Lucide Icons
import { 
  Settings, 
  Bell, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown, 
  MoreHorizontal, 
  CreditCard, 
  Wallet, 
  PiggyBank, 
  BarChart3, 
  Activity 
} from 'lucide-react';

// Recharts
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine 
} from 'recharts';

// Custom Components
import { RadialBarChart } from '@/components/radial-bar-chart';
```

---

## File Structure

```
app/
  page.tsx          # Main dashboard with all tabs
  layout.tsx        # Root layout with metadata
  globals.css       # Tailwind styles

components/
  radial-bar-chart.tsx  # Custom radial SVG chart
```

---

## Key Implementation Notes

1. **Tab Switching**: Use `useState` to track active tab and conditionally render tab content.

2. **Number Formatting**: 
   - Always use `tabular-nums` class for financial numbers
   - Use `toLocaleString('en-US', { minimumFractionDigits: 2 })` for currency

3. **Responsive Design**: The current design is desktop-focused. Consider adding responsive breakpoints for mobile.

4. **Accessibility**: 
   - Add proper `aria-label` attributes to icon-only buttons
   - Ensure color contrast meets WCAG standards

5. **Escape Apostrophes**: In JSX text, use `&apos;` instead of `'` (e.g., "Here&apos;s your portfolio")

6. **Chart Responsiveness**: Wrap all Recharts in `<ResponsiveContainer width="100%" height="100%">`

7. **Background**: The outer page background is `#0B1238` (deep navy). Add this to the `<html>` tag in layout.tsx.

---

## Dependencies

```json
{
  "dependencies": {
    "recharts": "^2.x",
    "lucide-react": "^0.x"
  }
}
```

Install with:
```bash
npm install recharts lucide-react
# or
pnpm add recharts lucide-react
```
