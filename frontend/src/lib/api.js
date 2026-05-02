import { supabase } from './supabase'

const BASE = '/api'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function get(path) {
  const headers = await authHeaders()
  const res = await fetch(BASE + path, { headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post(path, body) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function put(path, body) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch(BASE + path, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del(path) {
  const headers = await authHeaders()
  const res = await fetch(BASE + path, { method: 'DELETE', headers })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  portfolio: {
    summary: () => get('/portfolio/summary'),
    history: () => get('/portfolio/history'),
    allocation: () => get('/portfolio/allocation'),
  },
  goals: {
    list: () => get('/goals'),
    create: (data) => post('/goals', data),
    update: (id, data) => put(`/goals/${id}`, data),
    delete: (id) => del(`/goals/${id}`),
  },
  holdings: {
    list: () => get('/holdings'),
    create: (data) => post('/holdings', data),
    update: (id, data) => put(`/holdings/${id}`, data),
    delete: (id) => del(`/holdings/${id}`),
    syncPrices: () => post('/holdings/sync-prices', {}),
  },
  alerts: {
    list: () => get('/alerts'),
    markRead: (id) => put(`/alerts/${id}/read`, {}),
  },
  rebalancing: {
    recommendations: () => get('/rebalancing/recommendations'),
    trigger: () => post('/rebalancing/trigger', {}),
    updateStatus: (id, status) => put(`/rebalancing/${id}/status`, { status }),
    calibrationStats: () => get('/rebalancing/calibration/stats'),
  },
  scenarios: {
    list: () => get('/scenarios'),
    run: (data) => post('/scenarios/run', data),
  },
  chat: {
    history: () => get('/chat/history'),
  },
  news: {
    refresh: () => post('/news/refresh', {}),
    recent: (limit = 20) => get(`/news/recent?limit=${limit}`),
    status: () => get('/news/status'),
  },
  health: () => fetch('/health').then(r => r.json()),
}

export async function streamChat(message, onChunk, onToolCall, onDone) {
  const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) }
  const res = await fetch(BASE + '/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error(await res.text())

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    const lines = text.split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'text') onChunk(data.content)
        else if (data.type === 'tool_start') onToolCall(data.tool, 'start')
        else if (data.type === 'tool_end') onToolCall(data.tool, 'end')
        else if (data.type === 'done') onDone()
      } catch {}
    }
  }
}
