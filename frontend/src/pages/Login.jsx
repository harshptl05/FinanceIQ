import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/ui/Logo'
import { Card } from '../components/ui/Card'
import { IconArrow } from '../components/ui/Icons'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        navigate('/onboarding')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-3xl bg-brand-500/10 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] rounded-full blur-3xl bg-violet-500/10 pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <Link to="/" className="block mx-auto w-fit mb-8">
          <Logo size="lg" />
        </Link>

        <Card className="p-8">
          <h2 className="text-white text-2xl font-bold tracking-tight text-center">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-slate-400 text-sm text-center mt-1.5 mb-7">
            {mode === 'login' ? 'Log in to your portfolio' : 'Start managing your wealth with AI'}
          </p>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="field"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="field"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 py-3">
              {loading ? 'Please wait…' : mode === 'login' ? (
                <>Log in <IconArrow /></>
              ) : (
                <>Create account <IconArrow /></>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t hairline text-center">
            <p className="text-slate-500 text-[11px] uppercase tracking-wide mb-2">Demo account</p>
            <button
              onClick={() => {
                setEmail('demo@financeiq.app')
                setPassword('demo1234')
                setMode('login')
              }}
              className="text-brand-300 hover:text-brand-200 text-xs transition-colors"
            >
              Use demo credentials
            </button>
          </div>
        </Card>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          Educational only — not personalized financial advice.
        </p>
      </div>
    </div>
  )
}
