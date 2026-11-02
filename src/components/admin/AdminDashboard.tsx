/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Link as LinkIcon,
  Copy,
  Check,
  Download,
  Share2,
  Trash2,
  Ban,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Mail,
  FileSpreadsheet,
  FileCode,
  ShieldAlert,
  Edit3,
  RefreshCw,
  FolderArchive,
  Eye,
} from 'lucide-react';
import { DatasetSummary, ReviewerToken, RubricQuestion } from '../../types.ts';
import {
  fetchDatasetSummary,
  uploadDatasetZip,
  resetSampleDataset,
  fetchRubric,
  updateRubric,
  fetchTokens,
  generateTokens,
  revokeToken,
  resumeToken,
  deleteToken,
  resetTokenProgress,
} from '../../services/api.ts';
import { RubricEditorModal } from './RubricEditorModal.tsx';

interface AdminDashboardProps {
  onOpenReviewerWorkspace: (token: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenReviewerWorkspace }) => {
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [rubric, setRubric] = useState<RubricQuestion[]>([]);
  const [tokens, setTokens] = useState<ReviewerToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState<number>(3);
  const [generateNames, setGenerateNames] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ds, rb, tks] = await Promise.all([fetchDatasetSummary(), fetchRubric(), fetchTokens()]);
      setDataset(ds);
      setRubric(rb);
      setTokens(tks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: `Failed to load dashboard data: ${msg}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setActionMessage({ type: 'err', text: 'Please select a valid .zip archive.' });
      return;
    }

    setIsUploading(true);
    setUploadWarning('');
    setActionMessage(null);

    try {
      const result = await uploadDatasetZip(file);
      setDataset(result.dataset);
      if (result.warnings && result.warnings.length > 0) {
        setUploadWarning(result.warnings.join(' '));
      }
      setActionMessage({
        type: 'ok',
        text: `Successfully uploaded ${file.name} and published ${result.dataset.itemCount} blinded review items!`,
      });
      // Refresh tokens to recalculate progress bars against new total
      const updatedTokens = await fetchTokens();
      setTokens(updatedTokens);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: `ZIP Extraction failed: ${msg}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetSample = async () => {
    if (!confirm('Reset back to the default pre-loaded T7 hardware review set?')) return;
    try {
      const res = await resetSampleDataset();
      setDataset(res);
      setActionMessage({ type: 'ok', text: 'Reset to sample T7 hardware benchmark set.' });
      const updatedTokens = await fetchTokens();
      setTokens(updatedTokens);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: msg });
    }
  };

  const handleGenerateLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setActionMessage(null);

    const namesList = generateNames
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const count = namesList.length > 0 ? namesList.length : generateCount;

    try {
      const newTokens = await generateTokens(count, namesList.length > 0 ? namesList : undefined);
      setTokens(newTokens);
      setGenerateNames('');
      setActionMessage({
        type: 'ok',
        text: `Generated ${count} unique, secure reviewer link(s).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRevoke = async (token: string) => {
    if (!confirm('Revoke access for this reviewer link? The reviewer will not be able to view or edit answers.')) return;
    try {
      await revokeToken(token);
      setTokens(await fetchTokens());
      setActionMessage({ type: 'ok', text: 'Reviewer link revoked.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: msg });
    }
  };

  const handleResume = async (token: string) => {
    try {
      await resumeToken(token);
      setTokens(await fetchTokens());
      setActionMessage({ type: 'ok', text: 'Reviewer link restored.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: msg });
    }
  };

  const handleDelete = async (token: string) => {
    if (!confirm('Permanently delete this reviewer entry and all their recorded answers?')) return;
    try {
      await deleteToken(token);
      setTokens(await fetchTokens());
      setActionMessage({ type: 'ok', text: 'Reviewer entry deleted.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: msg });
    }
  };

  const handleResetProgress = async (token: string) => {
    if (!confirm('Clear all recorded answers for this reviewer and reset their status to Incomplete?')) return;
    try {
      await resetTokenProgress(token);
      setTokens(await fetchTokens());
      setActionMessage({ type: 'ok', text: 'Reviewer progress cleared.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ type: 'err', text: msg });
    }
  };

  const getShareLinks = (token: string, name?: string) => {
    const origin = window.location.origin;
    const link = `${origin}/?token=${token}`;
    const subject = encodeURIComponent(`Blinded Review Invitation - ${dataset?.name || 'Benchmark Evaluation'}`);
    const body = encodeURIComponent(
      `Hello ${name || 'Reviewer'},\n\nYou have been invited to review blinded evaluation items. Please open your secure review link below to get started:\n\n${link}\n\nYour progress will be saved continuously so you can stop and resume anytime.`
    );
    const waText = encodeURIComponent(
      `Hi ${name || 'Reviewer'}, here is your secure link for the blinded review study: ${link}`
    );

    return {
      mailto: `mailto:${name ? '' : ''}?subject=${subject}&body=${body}`,
      whatsapp: `https://wa.me/?text=${waText}`,
      url: link,
    };
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-neutral-50/50 dark:bg-neutral-950/50 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Study Administration & Link Control Hub
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Upload review sets, generate secure token links, track live completion progress, and export answers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <a
              href="/api/admin/export/all/csv"
              download
              className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Download All (CSV)</span>
            </a>
          </div>
        </div>

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between animate-in fade-in duration-200 ${
              actionMessage.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="font-bold ml-2 text-neutral-400 hover:text-neutral-600"
            >
              ×
            </button>
          </div>
        )}

        {/* Top 2-Column Grid: Dataset Ingestion & Rubric */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card 1: Review Set ZIP Management (lg:col-span-7) */}
          <div className="lg:col-span-7 rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                  <FolderArchive className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                    1. Active Review Set
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ZIP archive containing items/R###.json files
                  </p>
                </div>
              </div>

              {dataset && (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {dataset.itemCount} Items Live
                </span>
              )}
            </div>

            {/* Current Dataset Details Box */}
            {dataset && (
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Dataset Name:</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">{dataset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Source File:</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">{dataset.rawFilename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Protocol Blinding:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Strict (formal_outcome stripped)
                  </span>
                </div>
              </div>
            )}

            {/* Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
              }}
              className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 rounded-xl p-6 text-center cursor-pointer transition-colors group bg-neutral-50/50 dark:bg-neutral-800/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <Upload className="mx-auto h-7 w-7 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
              <p className="mt-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {isUploading ? 'Extracting & Sanitizing ZIP…' : 'Drop your review set ZIP archive here, or click to browse'}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Supports T7_BLINDED_REVIEW_SET.zip (up to 100MB). Formal outcomes & evidence logs are discarded automatically.
              </p>
            </div>

            {uploadWarning && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                {uploadWarning}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleResetSample}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
              >
                Reset to demo benchmark (T7 Hardware items)
              </button>
            </div>
          </div>

          {/* Card 2: Question Rubric & Exports (lg:col-span-5) */}
          <div className="lg:col-span-5 rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                      2. Review Rubric
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Standard T7 Protocol (Q1–Q6)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRubricModalOpen(true)}
                  className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Edit Rubric
                </button>
              </div>

              {/* Rubric List Preview */}
              <div className="space-y-2 text-xs">
                {rubric.slice(0, 4).map((q) => (
                  <div key={q.id} className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 flex items-center justify-between">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                      {q.code}: {q.prompt.length > 40 ? `${q.prompt.slice(0, 40)}…` : q.prompt}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500">[{q.options.join('/')}]</span>
                  </div>
                ))}
                {rubric.length > 4 && (
                  <p className="text-[11px] text-neutral-400 text-center">
                    +{rubric.length - 4} more questions configured
                  </p>
                )}
              </div>
            </div>

            {/* Quick Export Downloads Box */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                Study Exports & Audit Backups
              </span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/api/admin/export/all/csv"
                  download
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750 transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Master CSV</span>
                </a>

                <a
                  href="/api/admin/export/all/json"
                  download
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750 transition-colors"
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>JSON Backup</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Link Generator Card */}
        <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
              <LinkIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                3. Generate Secure Reviewer Links
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Each reviewer gets a unique, revocable token with personal deterministic item shuffling.
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateLinks} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Number of Links to Generate
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Optional: Pre-assign Reviewer Names <span className="font-normal text-neutral-400">(One per line)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g.&#10;Dr. Alice Chen&#10;Bob Martinez&#10;Carol Zhao"
                  value={generateNames}
                  onChange={(e) => setGenerateNames(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 disabled:opacity-50 cursor-pointer"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>{isGenerating ? 'Generating…' : 'Generate Review Links'}</span>
            </button>
          </form>
        </div>

        {/* Reviewer Monitoring Table */}
        <div className="rounded-2xl bg-white shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                4. Reviewer Progress & Telemetry Monitor
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {tokens.length} total review links generated · Tracks link opens, responses, and completion
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {tokens.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No review links generated yet. Use the form above to generate links for your reviewers.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-500 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Reviewer</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Progress</th>
                    <th className="py-3 px-4 font-semibold">Last Active</th>
                    <th className="py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                  {tokens.map((t) => {
                    const completed = t.progress?.completed || 0;
                    const total = t.progress?.total || dataset?.itemCount || 320;
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    const share = getShareLinks(t.token, t.name);

                    return (
                      <tr key={t.token} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                        {/* Reviewer Details */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900 dark:text-white">
                            {t.name || <span className="text-neutral-400 italic">Unregistered link</span>}
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                            <span>{t.email || 'Email pending'}</span>
                            <span className="font-mono text-[10px] text-neutral-400">({t.token.slice(0, 8)}…)</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">
                          {t.status === 'revoked' ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                              <Ban className="h-3 w-3" /> Revoked
                            </span>
                          ) : t.status === 'submitted' ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Submitted
                            </span>
                          ) : t.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400">
                              In Progress
                            </span>
                          ) : t.status === 'details_submitted' ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                              Details Entered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              Link Created
                            </span>
                          )}
                        </td>

                        {/* Progress Bar */}
                        <td className="py-3 px-4 min-w-[150px]">
                          <div className="flex justify-between text-[11px] text-neutral-500 mb-1">
                            <span className="tabular-nums font-medium text-neutral-800 dark:text-neutral-200">
                              {completed} / {total}
                            </span>
                            <span className="font-semibold tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                pct === 100 ? 'bg-emerald-600' : 'bg-neutral-800 dark:bg-neutral-200'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>

                        {/* Last Active Timestamp */}
                        <td className="py-3 px-4 text-[11px] text-neutral-500 whitespace-nowrap">
                          {t.lastActiveAt ? new Date(t.lastActiveAt).toLocaleTimeString() : 'Never'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Copy Link Button */}
                            <button
                              type="button"
                              onClick={() => handleCopyLink(t.token)}
                              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                              title="Copy personal review link"
                            >
                              {copiedToken === t.token ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Open / Test workspace */}
                            <button
                              type="button"
                              onClick={() => onOpenReviewerWorkspace(t.token)}
                              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                              title="Open workspace as this reviewer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Share WhatsApp */}
                            <a
                              href={share.whatsapp}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-neutral-200 text-emerald-700 hover:bg-emerald-50 dark:border-neutral-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40 transition-colors"
                              title="Share via WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>

                            {/* Share Email */}
                            <a
                              href={share.mailto}
                              className="p-1.5 rounded-lg border border-neutral-200 text-sky-700 hover:bg-sky-50 dark:border-neutral-700 dark:text-sky-400 dark:hover:bg-sky-950/40 transition-colors"
                              title="Share via Email"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>

                            {/* Download CSV */}
                            <a
                              href={`/api/admin/export/reviewer/${t.token}/csv`}
                              download
                              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                              title="Download reviewer's answered CSV"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>

                            {/* Revoke / Restore */}
                            {t.status === 'revoked' ? (
                              <button
                                type="button"
                                onClick={() => handleResume(t.token)}
                                className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                                title="Restore reviewer access"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevoke(t.token)}
                                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-200 dark:border-neutral-700 transition-colors"
                                title="Revoke reviewer link"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Reset Progress */}
                            <button
                              type="button"
                              onClick={() => handleResetProgress(t.token)}
                              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-amber-600 hover:border-amber-200 dark:border-neutral-700 transition-colors"
                              title="Reset answers to zero"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDelete(t.token)}
                              className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-600 hover:border-red-200 dark:border-neutral-700 transition-colors"
                              title="Delete reviewer entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Rubric Editor Modal */}
      <RubricEditorModal
        isOpen={isRubricModalOpen}
        onClose={() => setIsRubricModalOpen(false)}
        rubric={rubric}
        onSaveRubric={async (updated) => {
          const res = await updateRubric(updated);
          setRubric(res);
          setActionMessage({ type: 'ok', text: 'Rubric questions updated.' });
        }}
        onResetDefault={async () => {
          const res = await fetchRubric();
          setRubric(res);
        }}
      />
    </div>
  );
};
