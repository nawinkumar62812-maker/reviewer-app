/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Clock, CheckCircle2, Lock, ArrowRight, BookOpen } from 'lucide-react';
import { DatasetSummary, ReviewerProgress, ReviewerToken } from '../../types.ts';

interface ReviewerWelcomeProps {
  reviewer: ReviewerToken;
  dataset: DatasetSummary;
  progress: ReviewerProgress;
  onStartReview: (name: string, email: string, affiliation?: string) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string;
}

export const ReviewerWelcome: React.FC<ReviewerWelcomeProps> = ({
  reviewer,
  dataset,
  progress,
  onStartReview,
  isLoading,
  errorMessage,
}) => {
  const [name, setName] = useState(reviewer.name || '');
  const [email, setEmail] = useState(reviewer.email || '');
  const [affiliation, setAffiliation] = useState(reviewer.affiliation || '');
  const [consent, setConsent] = useState(Boolean(reviewer.name));
  const [validationError, setValidationError] = useState('');

  const isResuming = Boolean(reviewer.name && reviewer.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setValidationError('Please enter your full name.');
      return;
    }

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setValidationError('Please enter a valid Gmail or work email address.');
      return;
    }

    if (!consent) {
      setValidationError('Please confirm the study data handling agreement.');
      return;
    }

    try {
      await onStartReview(cleanName, cleanEmail, affiliation.trim() || undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationError(msg);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 sm:p-6 bg-neutral-50/50 dark:bg-neutral-950/50">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
        {/* Header Badge & Title */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {isResuming ? 'Welcome Back to Your Review' : 'Blinded Peer Review Portal'}
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {isResuming
              ? 'Your progress has been continuously saved. You can pick up right where you left off.'
              : 'You have been invited to participate in a double-blinded hardware specification and RTL evaluation study.'}
          </p>
        </div>

        {/* Study Overview Metrics Box */}
        <div className="mt-6 grid grid-cols-2 gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-100 dark:bg-neutral-800/50 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-neutral-700 shadow-xs text-neutral-700 dark:text-neutral-200">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Review Set Size</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
                {dataset.itemCount} blinded items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-neutral-700 shadow-xs text-neutral-700 dark:text-neutral-200">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Progress Status</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
                {progress.completed} of {progress.total} answered
              </p>
            </div>
          </div>
        </div>

        {/* Blinding & Protocol Assurance */}
        <div className="mt-4 p-3.5 rounded-xl border border-neutral-100 bg-neutral-50/60 dark:border-neutral-800/80 dark:bg-neutral-800/30 text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
            <Lock className="h-3.5 w-3.5 text-neutral-500" />
            <span>Protocol Blinding Guarantee</span>
          </div>
          <p>
            All formal benchmark verification outcomes and model identifications have been removed to ensure an impartial evaluation. Your responses autosave automatically.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="fullname" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="fullname"
              type="text"
              autoComplete="name"
              required
              placeholder="e.g. Dr. Alex Mercer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Gmail / Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="e.g. alex.mercer@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
            />
          </div>

          <div>
            <label htmlFor="affiliation" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Affiliation or Reviewer Role <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <input
              id="affiliation"
              type="text"
              placeholder="e.g. ASIC Design Engineer / Verification Lead"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800"
              />
              <span className="text-xs text-neutral-600 dark:text-neutral-400 select-none">
                I understand that my responses and reviewer credentials will be recorded and shared with the study lead for benchmark analysis.
              </span>
            </label>
          </div>

          {(validationError || errorMessage) && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {validationError || errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 px-4 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-all cursor-pointer"
          >
            {isLoading ? (
              <span>Initializing workspace…</span>
            ) : isResuming ? (
              <>
                <span>Continue Review Session</span>
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Begin Blinded Review</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
