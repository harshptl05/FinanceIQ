'use client';

/**
 * app-bridge — tiny event bus the voice agent (and any other "remote
 * controller") uses to drive the dashboard.
 *
 * Why an event bus instead of context: the voice agent panel lives deep
 * inside the AI tab, but the things it wants to control (active tab,
 * settings dialog, theme) live up at the page root. Lifting state isn't
 * worth it for a single hop, and Context would force every consumer to
 * re-render on every command. A typed CustomEvent on `window` keeps the
 * surface tiny and decouples sender from receiver.
 *
 * The events are intentionally fire-and-forget — the page subscribes to
 * what it cares about and ignores the rest.
 */

import { useEffect } from 'react';

const NAV_EVENT = 'financeiq:navigate';
const SETTINGS_EVENT = 'financeiq:open-settings';
const REFRESH_EVENT = 'financeiq:refresh';

export type AppNavTab =
  | 'dashboard'
  | 'investment'
  | 'rebalance'
  | 'activity'
  | 'goals'
  | 'ai';

export function emitNavigate(tab: AppNavTab) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AppNavTab>(NAV_EVENT, { detail: tab }));
}

export function emitOpenSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function emitRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useNavigateListener(handler: (tab: AppNavTab) => void) {
  useEffect(() => {
    const fn = (e: Event) => {
      const detail = (e as CustomEvent<AppNavTab>).detail;
      if (detail) handler(detail);
    };
    window.addEventListener(NAV_EVENT, fn);
    return () => window.removeEventListener(NAV_EVENT, fn);
  }, [handler]);
}

export function useOpenSettingsListener(handler: () => void) {
  useEffect(() => {
    window.addEventListener(SETTINGS_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_EVENT, handler);
  }, [handler]);
}

export function useRefreshListener(handler: () => void) {
  useEffect(() => {
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, [handler]);
}
