import ReactMarkdown from 'react-markdown'
import { IconCheck, IconSparkle } from './ui/Icons'

export default function ChatMessage({ role, content, toolCalls }) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-ink-950 mr-3 flex-shrink-0 mt-1 shadow-glow">
          <IconSparkle />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-tr-sm shadow-[0_8px_24px_-12px_rgba(16,185,129,0.5)]'
            : 'surface text-slate-100 rounded-tl-sm'
        }`}
      >
        {!isUser && toolCalls && toolCalls.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {toolCalls.map((t, i) => {
              const done = t.status !== 'pending'
              return (
                <span
                  key={i}
                  className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 border ${
                    done
                      ? 'bg-brand-500/10 border-brand-500/20 text-brand-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  {done ? (
                    <IconCheck className="text-[10px]" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {t.name.replace(/_/g, ' ')}
                </span>
              )
            })}
          </div>
        )}
        <div className="prose-chat">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
