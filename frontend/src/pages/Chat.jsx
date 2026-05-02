import { useState, useRef, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import ChatMessage from '../components/ChatMessage'
import { Card } from '../components/ui/Card'
import { IconSparkle, IconArrow } from '../components/ui/Icons'
import { streamChat, api } from '../lib/api'

const SUGGESTIONS = [
  { title: 'Am I on track for retirement?', sub: 'Project your portfolio against your timeline' },
  { title: 'Should I be worried about inflation?', sub: 'See how your allocation reacts to CPI moves' },
  { title: "What's my riskiest holding?", sub: 'Identify concentration and volatility outliers' },
  { title: 'Explain my allocation in plain English', sub: 'Get a non-jargon breakdown of your mix' },
]

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    api.chat
      .history()
      .then(d => setMessages(d.history || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || streaming) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setStreaming(true)

    let assistantText = ''
    const tools = []
    setMessages(prev => [...prev, { role: 'assistant', content: '', toolCalls: [] }])

    try {
      await streamChat(
        msg,
        chunk => {
          assistantText += chunk
          setMessages(prev => {
            const m = [...prev]
            m[m.length - 1] = { role: 'assistant', content: assistantText, toolCalls: [...tools] }
            return m
          })
        },
        (toolName, status) => {
          if (status === 'start') {
            tools.push({ name: toolName, status: 'pending' })
          } else {
            const t = tools.find(t => t.name === toolName && t.status === 'pending')
            if (t) t.status = 'done'
          }
          setMessages(prev => {
            const m = [...prev]
            m[m.length - 1] = { role: 'assistant', content: assistantText, toolCalls: [...tools] }
            return m
          })
        },
        () => setStreaming(false)
      )
    } catch (e) {
      setMessages(prev => {
        const m = [...prev]
        m[m.length - 1] = { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}` }
        return m
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="px-8 py-6 border-b hairline flex items-center justify-between">
          <div>
            <p className="section-eyebrow">Conversational</p>
            <h1 className="text-white font-semibold text-2xl tracking-tight">AI Financial Advisor</h1>
            <p className="text-slate-400 text-sm mt-1">
              Ask anything about your portfolio — grounded in your real holdings.
            </p>
          </div>
          <div className="hidden md:inline-flex items-center gap-2 chip">
            <span className="live-dot" /> Powered by Claude
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center gap-7">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-ink-950 shadow-glow animate-float">
                <IconSparkle className="text-xl" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-2xl mb-2 tracking-tight">
                  How can I help today?
                </h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Ask in plain English. I'll use your real portfolio + live market tools — never invented data.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.title}
                    onClick={() => send(s.title)}
                    className="surface surface-hover text-left p-4 group"
                  >
                    <p className="text-white text-sm font-medium">{s.title}</p>
                    <p className="text-slate-500 text-xs mt-1">{s.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} toolCalls={m.toolCalls} />
              ))}
              {streaming && !messages[messages.length - 1]?.content && (
                <div className="flex justify-start mb-4">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-ink-950 mr-3 flex-shrink-0 mt-1 shadow-glow">
                    <IconSparkle />
                  </div>
                  <div className="surface rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="px-6 md:px-8 py-4 border-t hairline">
          <div className="max-w-3xl mx-auto">
            <Card className="p-2 flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about your portfolio…"
                disabled={streaming}
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 px-3 py-2.5 text-sm focus:outline-none disabled:opacity-60"
              />
              <button
                onClick={() => send()}
                disabled={streaming || !input.trim()}
                className="btn-primary"
              >
                {streaming ? '…' : (
                  <>
                    Send <IconArrow />
                  </>
                )}
              </button>
            </Card>
            <p className="text-[11px] text-slate-600 text-center mt-2">
              Educational only — not personalized financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
