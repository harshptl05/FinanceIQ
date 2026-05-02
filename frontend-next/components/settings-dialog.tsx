'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle2,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Shield,
  Sparkles,
  Sun,
  User,
  Wand2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { useTheme, type ThemePreference } from '@/lib/theme-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Settings dialog — the per-user control center.
 *
 * Sections:
 *   • Profile      → name, risk tolerance, risk capacity (PUT /api/user/profile)
 *   • Appearance   → light / dark / system (uses ThemeProvider)
 *   • Notifications → in-app toast preferences (localStorage only)
 *   • Account      → email (read-only) + sign out
 *
 * Designed to feel like a native settings panel — left-rail sections, right
 * content area on desktop; stacked on mobile. Uses the existing Dialog
 * primitive so it picks up dark mode via the global overlay layer.
 */

type Section = 'profile' | 'appearance' | 'notifications' | 'account';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  /** Optional: which section to highlight on open (deep-link). */
  initialSection?: Section;
}

interface ProfileForm {
  full_name: string;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  risk_capacity: 'low' | 'medium' | 'high';
}

const RISK_TOL_OPTIONS = [
  {
    value: 'conservative',
    label: 'Conservative',
    blurb: 'I get nervous when markets dip. Stability over upside.',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    blurb: 'I can stomach normal volatility for long-term growth.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    blurb: 'I welcome big swings if it means bigger long-term returns.',
  },
] as const;

const RISK_CAP_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
    blurb: 'Tight timeline, no emergency fund, dependents — losses would hurt.',
  },
  {
    value: 'medium',
    label: 'Medium',
    blurb: 'Moderate timeline and a basic safety net.',
  },
  {
    value: 'high',
    label: 'High',
    blurb: 'Long timeline, stable income, well-funded emergency cushion.',
  },
] as const;

const NOTIFICATION_KEY = 'financeiq-notify-toasts';

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection = 'profile',
}: SettingsDialogProps) {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { preference, resolved, setPreference } = useTheme();

  const [section, setSection] = useState<Section>(initialSection);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<ProfileForm>({
    full_name: '',
    risk_tolerance: 'moderate',
    risk_capacity: 'medium',
  });
  const [profileBaseline, setProfileBaseline] = useState<ProfileForm | null>(null);

  const [toastsEnabled, setToastsEnabled] = useState(true);

  // Load profile when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    let cancelled = false;
    setLoadingProfile(true);
    api.user
      .profile()
      .then((p) => {
        if (cancelled) return;
        const next: ProfileForm = {
          full_name: p.full_name ?? '',
          risk_tolerance:
            (p.risk_tolerance as ProfileForm['risk_tolerance']) ?? 'moderate',
          risk_capacity:
            (p.risk_capacity as ProfileForm['risk_capacity']) ?? 'medium',
        };
        setProfile(next);
        setProfileBaseline(next);
      })
      .catch((e) => {
        toast.error(
          e instanceof Error ? e.message : 'Could not load your profile.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialSection]);

  // Hydrate notification preference.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(NOTIFICATION_KEY);
    setToastsEnabled(stored === null ? true : stored === '1');
  }, []);

  const profileDirty = useMemo(() => {
    if (!profileBaseline) return false;
    return (
      profile.full_name.trim() !== (profileBaseline.full_name ?? '').trim() ||
      profile.risk_tolerance !== profileBaseline.risk_tolerance ||
      profile.risk_capacity !== profileBaseline.risk_capacity
    );
  }, [profile, profileBaseline]);

  const handleSaveProfile = async () => {
    if (!profileDirty || savingProfile) return;
    setSavingProfile(true);
    try {
      await api.user.updateProfile({
        full_name: profile.full_name.trim() || undefined,
        risk_tolerance: profile.risk_tolerance,
        risk_capacity: profile.risk_capacity,
      });
      setProfileBaseline(profile);
      toast.success('Profile saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      onOpenChange(false);
      router.push('/login');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sign out failed.');
      setSigningOut(false);
    }
  };

  const handleToastToggle = (enabled: boolean) => {
    setToastsEnabled(enabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(NOTIFICATION_KEY, enabled ? '1' : '0');
    }
  };

  const sections: Array<{
    id: Section;
    label: string;
    icon: typeof User;
    desc: string;
  }> = [
    { id: 'profile', label: 'Profile', icon: User, desc: 'Name & risk profile' },
    { id: 'appearance', label: 'Appearance', icon: Wand2, desc: 'Light, dark, or system' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'In-app alerts' },
    { id: 'account', label: 'Account', icon: Shield, desc: 'Sign in & sign out' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Settings</DialogTitle>
              <p className="text-sm text-gray-500">
                Personalize FinanceIQ to match how you invest.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row min-h-[480px]">
          {/* Left rail */}
          <nav className="w-full sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100 bg-gray-50/60 p-3">
            <div className="space-y-1">
              {sections.map((s) => {
                const active = section === s.id;
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={`w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                      active
                        ? 'bg-white shadow-sm border border-gray-100'
                        : 'hover:bg-white/70'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 ${
                        active ? 'text-indigo-600' : 'text-gray-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          active ? 'text-gray-900' : 'text-gray-700'
                        }`}
                      >
                        {s.label}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {s.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right content */}
          <div className="flex-1 px-6 py-5 overflow-y-auto max-h-[70vh]">
            {section === 'profile' && (
              <ProfileSection
                loading={loadingProfile}
                saving={savingProfile}
                dirty={profileDirty}
                profile={profile}
                onChange={setProfile}
                onSave={handleSaveProfile}
                email={user?.email ?? ''}
              />
            )}
            {section === 'appearance' && (
              <AppearanceSection
                preference={preference}
                resolved={resolved}
                onChange={setPreference}
              />
            )}
            {section === 'notifications' && (
              <NotificationsSection
                enabled={toastsEnabled}
                onToggle={handleToastToggle}
              />
            )}
            {section === 'account' && (
              <AccountSection
                email={user?.email ?? ''}
                onSignOut={handleSignOut}
                signingOut={signingOut}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Profile section
// ---------------------------------------------------------------------------

function ProfileSection({
  loading,
  saving,
  dirty,
  profile,
  onChange,
  onSave,
  email,
}: {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  profile: ProfileForm;
  onChange: (next: ProfileForm) => void;
  onSave: () => void;
  email: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading your profile…
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Your profile"
        subtitle="The advisor uses these to shape every recommendation it makes for you."
      />

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Full name
        </label>
        <input
          type="text"
          value={profile.full_name}
          onChange={(e) =>
            onChange({ ...profile, full_name: e.target.value })
          }
          placeholder="What should we call you?"
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
        />
        <p className="text-[11px] text-gray-500">
          Signed in as <span className="font-medium">{email || 'unknown'}</span>
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Risk tolerance
        </label>
        <p className="text-xs text-gray-500 -mt-1">
          How <em>emotionally</em> you handle losses.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {RISK_TOL_OPTIONS.map((opt) => (
            <RadioCard
              key={opt.value}
              label={opt.label}
              blurb={opt.blurb}
              selected={profile.risk_tolerance === opt.value}
              onClick={() =>
                onChange({ ...profile, risk_tolerance: opt.value })
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Risk capacity
        </label>
        <p className="text-xs text-gray-500 -mt-1">
          How <em>financially</em> you can absorb losses (separate from how it
          feels).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {RISK_CAP_OPTIONS.map((opt) => (
            <RadioCard
              key={opt.value}
              label={opt.label}
              blurb={opt.blurb}
              selected={profile.risk_capacity === opt.value}
              onClick={() =>
                onChange({ ...profile, risk_capacity: opt.value })
              }
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white pb-1">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
            !dirty || saving
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800'
          }`}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Save changes
        </button>
      </div>
    </div>
  );
}

function RadioCard({
  label,
  blurb,
  selected,
  onClick,
}: {
  label: string;
  blurb: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl p-3 border transition ${
        selected
          ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {selected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">{blurb}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Appearance section
// ---------------------------------------------------------------------------

function AppearanceSection({
  preference,
  resolved,
  onChange,
}: {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  onChange: (next: ThemePreference) => void;
}) {
  const options: Array<{
    value: ThemePreference;
    label: string;
    icon: typeof Sun;
    blurb: string;
  }> = [
    {
      value: 'light',
      label: 'Light',
      icon: Sun,
      blurb: 'Crisp neutrals, vibrant accents — the original look.',
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: Moon,
      blurb: 'Easy on the eyes for evening sessions or OLED screens.',
    },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      blurb: `Follows your OS preference (currently ${resolved}).`,
    },
  ];
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Appearance"
        subtitle="Switch between light, dark, or follow your system. Everything else — the layout, accents, charts — stays exactly the same."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = preference === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-2xl p-4 border transition group ${
                selected
                  ? 'border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    selected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {selected && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                {opt.label}
              </p>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                {opt.blurb}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-[12px] text-gray-600">
        Pro tip: you can also say <span className="italic">&quot;turn on dark mode&quot;</span>{' '}
        to your voice advisor on the AI tab.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications section
// ---------------------------------------------------------------------------

function NotificationsSection({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (b: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Notifications"
        subtitle="Control which in-app notices we show you."
      />

      <ToggleRow
        title="Toast notifications"
        description="Quick confirmations when prices sync, trades clear, or the AI takes action."
        enabled={enabled}
        onChange={onToggle}
      />

      <ToggleRow
        title="Browser push"
        description="Coming soon — get pinged when a market-moving alert arrives, even if FinanceIQ is in another tab."
        enabled={false}
        disabled
        onChange={() => {}}
      />

      <ToggleRow
        title="Weekly recap email"
        description="Coming soon — a Sunday digest of what happened to your portfolio that week."
        enabled={false}
        disabled
        onChange={() => {}}
      />
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-indigo-600' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-pressed={enabled}
        aria-label={title}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account section
// ---------------------------------------------------------------------------

function AccountSection({
  email,
  onSignOut,
  signingOut,
}: {
  email: string;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Account"
        subtitle="Manage your sign-in."
      />

      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
          Signed in as
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5 break-all">
          {email || 'Unknown'}
        </p>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Sign out</p>
          <p className="text-xs text-gray-600 mt-0.5">
            You&apos;ll need to sign back in to access your portfolio again.
          </p>
        </div>
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition disabled:opacity-60"
        >
          {signingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          Sign out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
    </div>
  );
}
