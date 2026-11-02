/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, Download, ArrowLeft, ShieldCheck } from 'lucide-react';
import { ReviewerProgress, ReviewerToken } from '../../types.ts';

interface ReviewCompletedProps {
  reviewer: ReviewerToken;
  progress: ReviewerProgress;
  token: string;
  onBackToAnswers: () => void;
}

export const ReviewCompleted: React.FC<ReviewCompletedProps> = ({
  reviewer,
  progress,
  token,
  onBackToAnswers,
}) => {
  const downloadUrl = `/api/review/${token}/export-csv`;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 sm:p-6 bg-neutral-50/50 dark:bg-neutral-950/50">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-10 text-center shadow-sm border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 mb-6">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Responses Submitted Successfully
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Thank you, <strong className="font-semibold text-neutral-900 dark:text-white">{reviewer.name}</strong>. Your evaluation data has been synchronized and safely recorded with the study lead.
        </p>

        {/* Telemetry Summary Card */}
        <div className="mt-6 rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40 text-left space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <span>Reviewer Identity:</span>
            <span className="font-medium text-neutral-900 dark:text-white">{reviewer.name} ({reviewer.email})</span>
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <span>Evaluated Items:</span>
            <span className="font-medium text-neutral-900 dark:text-white tabular-nums">
              {progress.completed} of {progress.total} items (100% complete)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <span>Submission Time:</span>
            <span className="font-medium text-neutral-900 dark:text-white">
              {reviewer.submittedAt ? new Date(reviewer.submittedAt).toLocaleString() : new Date().toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={downloadUrl}
            download={`review_form_${(reviewer.name || 'reviewer').toLowerCase().replace(/\s+/g, '_')}.csv`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Download My File (CSV)</span>
          </a>

          <button
            onClick={onBackToAnswers}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Review My Answers</span>
          </button>
        </div>

        <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-500">
          You may keep a copy of your downloaded CSV for your personal evaluation records.
        </p>
      </div>
    </div>
  );
};
