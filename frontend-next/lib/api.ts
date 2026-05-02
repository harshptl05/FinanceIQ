'use client';

import { supabase } from './supabase';

const BASE = '/api';

export type Holding = {
  id: string;
  ticker: string;
  name?: string | null;
  asset_class?: string | null;
  shares: number;
  avg_cost_basis?: number | null;
  current_price?: number | null;
  current_value?: number | null;
};

export type Goal = {
  id: string;
  goal_type: string;
  goal_name: string;
  target_date: string;
  target_amount?: number | null;
  current_amount?: number | null;
  target_allocation?: Record<string, number> | null;
  rebalancing_strategy?: string | null;
  rebalancing_threshold?: number | null;
  rebalancing_frequency?: string | null;
  account_type?: string | null;
};

export type Alert = {
  id: string;
  news_event_id?: string | null;
  impact_classification?: 'positive' | 'negative' | 'neutral' | null;
  affected_holdings?: string[] | null;
  estimated_dollar_impact?: number | null;
  plain_english_explanation?: string | null;
  urgency?: 'act_now' | 'act_soon' | 'monitor' | 'info_only' | null;
  read?: boolean;
  created_at: string;
};

export type NewsEvent = {
  headline: string;
  source?: string | null;
  url?: string | null;
  published_at?: string | null;
  processed_at?: string | null;
};

export type Recommendation = {
  id: string;
  goal_id?: string | null;
  trigger_type?: string | null;
  trigger_description?: string | null;
  current_allocation?: Record<string, number> | null;
  target_allocation?: Record<string, number> | null;
  recommended_trades?: Array<{
    ticker?: string;
    asset_class?: string;
    action: 'buy' | 'sell';
    amount: number;
    reason?: string;
  }> | null;
  urgency?: string | null;
  plain_english_explanation?: string | null;
  tax_loss_harvesting_opportunity?: boolean | null;
  tax_notes?: string | null;
  status?: string | null;
  created_at: string;
};

export type PortfolioSummary = {
  total_value: number;
  current_allocation: Record<string, number>;
  target_allocation: Record<string, number>;
  drift: Record<string, number>;
  expected_annual_return: number;
  portfolio_volatility: number;
  sharpe_ratio: number;
  holdings_count: number;
};

export type PortfolioSnapshot = {
  total_value: number;
  allocation?: Record<string, number> | null;
  snapshot_date: string;
};

export type ScenarioResult = {
  scenario: string;
  description: string;
  duration_months: number;
  total_portfolio_before: number;
  total_portfolio_after: number;
  total_dollar_impact: number;
  total_pct_impact: number;
  holdings_breakdown: Array<{
    name: string;
    ticker: string;
    current_value: number;
    scenario_value: number;
    dollar_change: number;
    pct_change: number;
  }>;
  plain_english: string;
};

export type CalibrationStats = {
  total_evaluated: number;
  correct: number;
  accuracy_pct: number | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    return {};
  }
}

async function get<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(BASE + path, { headers, cache: 'no-store' });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  };
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return (await res.json()) as T;
}

async function put<T>(path: string, body: unknown = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  };
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return (await res.json()) as T;
}

async function fetchDelete<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(BASE + path, { method: 'DELETE', headers });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return (await res.json()) as T;
}

export const api = {
  portfolio: {
    summary: () => get<PortfolioSummary>('/portfolio/summary'),
    history: () =>
      get<{ history: PortfolioSnapshot[] }>('/portfolio/history'),
    allocation: () =>
      get<{ current: Record<string, number>; target: Record<string, number> }>(
        '/portfolio/allocation',
      ),
  },
  goals: {
    list: () => get<{ goals: Goal[] }>('/goals'),
  },
  holdings: {
    list: () => get<{ holdings: Holding[] }>('/holdings'),
    syncPrices: () => post<{ status: string }>('/holdings/sync-prices', {}),
  },
  alerts: {
    list: () => get<{ alerts: Alert[] }>('/alerts'),
    markRead: (id: string) => put<{ updated: string }>(`/alerts/${id}/read`, {}),
  },
  rebalancing: {
    recommendations: () =>
      get<{ recommendations: Recommendation[] }>('/rebalancing/recommendations'),
    trigger: () =>
      post<{ recommendations: Recommendation[] }>('/rebalancing/trigger', {}),
    updateStatus: (id: string, status: string) =>
      put<unknown>(`/rebalancing/${id}/status`, { status }),
    calibrationStats: () =>
      get<CalibrationStats>('/rebalancing/calibration/stats'),
  },
  scenarios: {
    list: () =>
      get<{
        scenarios: Array<{
          key: string;
          name: string;
          description: string;
          duration_months: number;
        }>;
      }>('/scenarios'),
    run: (scenario_key: string, goal_id?: string) =>
      post<ScenarioResult>('/scenarios/run', { scenario_key, goal_id }),
  },
  chat: {
    history: () =>
      get<{
        history: Array<{ role: 'user' | 'assistant'; content: string }>;
      }>('/chat/history'),
    conversations: () =>
      get<{
        conversations: Array<{
          id: string;
          title: string | null;
          first_at: string | null;
          last_at: string | null;
          message_count: number;
          is_legacy?: boolean;
        }>;
        migrated: boolean;
      }>('/chat/conversations'),
    conversation: (id: string) =>
      get<{
        messages: Array<{
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        }>;
      }>(`/chat/conversations/${id}`),
    deleteConversation: (id: string) =>
      fetchDelete<{ deleted: string }>(`/chat/conversations/${id}`),
  },
  news: {
    refresh: () => post<unknown>('/news/refresh', {}),
    recent: (limit = 20) =>
      get<{ news: NewsEvent[] }>(`/news/recent?limit=${limit}`),
    status: () =>
      get<{
        last_event_time: string | null;
        news_ingestion: Record<string, unknown>;
        classification: Record<string, unknown>;
      }>('/news/status'),
  },
  health: () => fetch('/health').then((r) => r.json()),
};

export type StreamChatHandlers = {
  onChunk: (s: string) => void;
  onToolCall: (tool: string, phase: 'start' | 'end') => void;
  onDone: () => void;
  /** Called once the backend tells us which conversation_id this turn
   *  belongs to (always the first SSE event for new conversations). */
  onConversation?: (id: string) => void;
};

export async function streamChat(
  message: string,
  conversationId: string | null,
  handlers: StreamChatHandlers,
  options?: { ephemeral?: boolean },
): Promise<void> {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  };
  const res = await fetch(BASE + '/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      ephemeral: options?.ephemeral ?? false,
    }),
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  if (!res.body) throw new Error('No response stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value);
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'text') handlers.onChunk(data.content);
        else if (data.type === 'tool_start')
          handlers.onToolCall(data.tool, 'start');
        else if (data.type === 'tool_end')
          handlers.onToolCall(data.tool, 'end');
        else if (data.type === 'conversation' && data.id)
          handlers.onConversation?.(data.id);
        else if (data.type === 'done') handlers.onDone();
      } catch {
        /* keep going */
      }
    }
  }
}
