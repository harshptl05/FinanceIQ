'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sparkles, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, session, loading } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace('/');
  }, [loading, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error: err } = await fn(email, password);
    if (err) setError(err.message);
    else if (mode === 'signup')
      setError("Check your email to verify your account, then sign in.");
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[480px] h-[480px] rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[480px] h-[480px] rounded-full bg-purple-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-900 font-bold text-2xl">FinanceIQ</span>
          </div>
          <p className="text-gray-500 text-sm">
            Your AI portfolio advisor — built for everyday investors.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-7">
          <div className="flex items-center bg-gray-100 rounded-full p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === 'signin' ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-black text-white rounded-full py-3 text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-[11px] text-gray-400 text-center mt-5 leading-relaxed">
            By continuing you agree FinanceIQ may analyze the holdings and goals
            you enter to generate plain-English financial guidance.
          </p>
        </div>
      </div>
    </div>
  );
}
