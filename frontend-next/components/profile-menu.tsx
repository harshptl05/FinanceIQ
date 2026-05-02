'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LogOut } from 'lucide-react';

export function ProfileMenu({
  initials,
  email,
}: {
  initials: string;
  email: string;
}) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full text-white text-xs font-semibold flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Account"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-60 bg-white rounded-2xl border border-gray-100 shadow-xl p-2 z-50">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400">Signed in as</p>
            <p className="text-sm font-semibold truncate" title={email}>
              {email || 'Investor'}
            </p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
