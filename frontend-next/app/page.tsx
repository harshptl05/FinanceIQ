'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Bell,
  HelpCircle,
  Sparkles,
  BarChart3,
  TrendingUp,
  Scale,
  Activity,
  PiggyBank,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { usePortfolioData } from '@/hooks/use-portfolio-data';
import { initials } from '@/lib/format';

import { DashboardTab } from '@/components/tabs/dashboard-tab';
import { InvestmentTab } from '@/components/tabs/investment-tab';
import { RebalanceTab } from '@/components/tabs/rebalance-tab';
import { ActivityTab } from '@/components/tabs/activity-tab';
import { GoalsTab } from '@/components/tabs/goals-tab';
import { AITab } from '@/components/ai-tab/ai-tab';
import { ProfileMenu } from '@/components/profile-menu';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'investment', label: 'Investment', icon: TrendingUp },
  { id: 'rebalance', label: 'Rebalance', icon: Scale },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'goals', label: 'Goals', icon: PiggyBank },
  { id: 'ai', label: 'AI', icon: Sparkles },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function PortfolioDashboard() {
  const router = useRouter();
  const { session, loading: authLoading, user } = useAuth();
  const data = usePortfolioData();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  useEffect(() => {
    if (!authLoading && !session) router.replace('/login');
  }, [authLoading, session, router]);

  if (authLoading || (!session && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const unreadAlerts = data.alerts.length;
  const userInitials = initials(
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
      user?.email,
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1400px] mx-auto">
        {/* Top Navigation */}
        <header className="flex items-center justify-between px-6 lg:px-10 py-4 border-b border-gray-100 sticky top-0 bg-white/85 backdrop-blur-md z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-500/30">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="font-bold text-lg">FinanceIQ</span>
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
            <button
              onClick={() => void data.syncPrices()}
              title="Pull live prices from Yahoo Finance"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-700"
            >
              Sync prices
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadAlerts > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
            <button
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <ProfileMenu initials={userInitials} email={user?.email ?? ''} />
          </div>
        </header>

        <main className="px-6 lg:px-10 py-8 space-y-8">
          {activeTab === 'dashboard' && <DashboardTab data={data} />}
          {activeTab === 'investment' && <InvestmentTab data={data} />}
          {activeTab === 'rebalance' && <RebalanceTab data={data} />}
          {activeTab === 'activity' && <ActivityTab data={data} />}
          {activeTab === 'goals' && <GoalsTab data={data} />}
          {activeTab === 'ai' && <AITab data={data} />}
        </main>

        {activeTab !== 'ai' && (
          <button
            onClick={() => setActiveTab('ai')}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 hover:scale-105 transition-transform flex items-center justify-center z-50 group"
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
