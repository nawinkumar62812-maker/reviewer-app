/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Moon, Sun, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  currentView: 'admin' | 'reviewer' | 'welcome';
  onSwitchView: (view: 'admin' | 'reviewer') => void;
  reviewerName?: string;
  reviewerEmail?: string;
  itemProgressText?: string;
  saveStatus?: string;
  isSaving?: boolean;
  onExitReview?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSwitchView,
  reviewerName,
  itemProgressText,
  saveStatus,
  isSaving,
  onExitReview,
}) => {
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 transition-colors">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-base tracking-tight text-neutral-900 dark:text-white whitespace-nowrap">
              Blinded Review Portal
            </span>
            <span className="hidden sm:inline-block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Protocol T7
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links & Active Reviewer Context */}
        <nav className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm font-medium">
          {currentView === 'reviewer' && (
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
              {reviewerName && (
                <span className="hidden md:inline-block font-medium text-neutral-900 dark:text-white">
                  {reviewerName}
                </span>
              )}
              {itemProgressText && (
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 tabular-nums">
                  {itemProgressText}
                </span>
              )}
            </div>
          )}

          {/* Mode Switcher for Evaluation Lead */}
          <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
            <button
              onClick={() => onSwitchView('admin')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                currentView === 'admin'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Admin Hub
            </button>
            <button
              onClick={() => onSwitchView('reviewer')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                currentView === 'reviewer' || currentView === 'welcome'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Review Workspace
            </button>
          </div>
        </nav>

        {/* Zone 3: Live Autosave Indicator & Actions */}
        <div className="flex items-center gap-3">
          {currentView === 'reviewer' && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 min-w-[120px] justify-end" role="status" aria-live="polite">
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-neutral-400" />
                  <span className="hidden sm:inline">Saving…</span>
                </>
              ) : saveStatus ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline truncate max-w-[140px]">{saveStatus}</span>
                </>
              ) : null}
            </div>
          )}

          {currentView === 'reviewer' && onExitReview && (
            <button
              onClick={onExitReview}
              className="hidden lg:flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              title="Return to welcome screen"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Details</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
