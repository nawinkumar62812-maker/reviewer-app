/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Grid,
  Send,
  Copy,
  Check,
  Code2,
  HelpCircle,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Layers,
} from 'lucide-react';
import {
  ItemHeader,
  ReviewerProgress,
  ReviewerToken,
  RubricQuestion,
  SanitizedReviewItem,
} from '../../types.ts';
import {
  fetchItemDetails,
  saveReviewAnswers,
  submitFinalReview,
  saveLocalBackup,
  getLocalBackup,
} from '../../services/api.ts';
import { ItemPaletteModal } from '../ItemPaletteModal.tsx';

interface ReviewWorkspaceProps {
  token: string;
  reviewer: ReviewerToken;
  rubric: RubricQuestion[];
  initialItems: ItemHeader[];
  initialProgress: ReviewerProgress;
  onSubmitted: () => void;
  onProgressUpdated: (progress: ReviewerProgress) => void;
  onSaveStateChange: (status: string, isSaving: boolean) => void;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({
  token,
  reviewer,
  rubric,
  initialItems,
  initialProgress,
  onSubmitted,
  onProgressUpdated,
  onSaveStateChange,
}) => {
  const [itemsList, setItemsList] = useState<ItemHeader[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentItem, setCurrentItem] = useState<SanitizedReviewItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>('');
  const [isLoadingItem, setIsLoadingItem] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showPorts, setShowPorts] = useState<boolean>(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [wrapCode, setWrapCode] = useState<boolean>(false);

  // In-memory cache of answers to avoid refetching on back/next
  const answerCache = useRef<Record<string, { answers: Record<string, string>; notes: string }>>({});
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const activeHeader = itemsList[currentIndex];
  const activeItemId = activeHeader?.id;

  // Determine if all items in the set are complete
  const allCompleted = useMemo(() => {
    return itemsList.length > 0 && itemsList.every((it) => it.isComplete);
  }, [itemsList]);

  // Find index of next unanswered item
  const nextUnansweredIndex = useMemo(() => {
    // Look forward from current index
    for (let i = currentIndex + 1; i < itemsList.length; i++) {
      if (!itemsList[i].isComplete) return i;
    }
    // Loop back from start
    for (let i = 0; i < currentIndex; i++) {
      if (!itemsList[i].isComplete) return i;
    }
    return -1;
  }, [itemsList, currentIndex]);

  // Load item details whenever currentIndex changes
  const loadItem = useCallback(
    async (idx: number) => {
      const targetHeader = itemsList[idx];
      if (!targetHeader) return;

      setIsLoadingItem(true);
      setErrorMessage('');

      try {
        const { item, savedAnswer } = await fetchItemDetails(token, targetHeader.id);
        setCurrentItem(item);

        // Check local memory cache or fallback to server savedAnswer
        const cached = answerCache.current[item.id] || savedAnswer;
        const currentAnswers = { ...cached.answers };

        // Apply auto-fill defaults for the item
        const hasQuestions = item.model_question.length > 0;
        const hasOracle = Boolean(item.oracle_answer);

        if (!hasQuestions) {
          currentAnswers.q1 = 'na';
          currentAnswers.q2 = 'na';
          currentAnswers.q3 = 'na';
        }
        if (!hasOracle) {
          currentAnswers.q4 = 'na';
        }

        setAnswers(currentAnswers);
        setNotes(cached.notes || '');
        answerCache.current[item.id] = { answers: currentAnswers, notes: cached.notes || '' };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        setIsLoadingItem(false);
      }
    },
    [itemsList, token]
  );

  // Initial load
  useEffect(() => {
    // Find first unanswered item or start at 0
    const firstUnanswered = itemsList.findIndex((it) => !it.isComplete);
    const startIdx = firstUnanswered >= 0 ? firstUnanswered : 0;
    setCurrentIndex(startIdx);
    loadItem(startIdx);
  }, [loadItem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave handler (debounced)
  const triggerAutosave = useCallback(
    (newAnswers: Record<string, string>, newNotes: string) => {
      if (!activeItemId) return;

      // Update cache and localStorage immediately
      answerCache.current[activeItemId] = { answers: newAnswers, notes: newNotes };
      saveLocalBackup(token, answerCache.current);

      onSaveStateChange('Saving…', true);

      if (saveTimeout.current) clearTimeout(saveTimeout.current);

      saveTimeout.current = setTimeout(async () => {
        try {
          const res = await saveReviewAnswers(token, {
            [activeItemId]: { answers: newAnswers, notes: newNotes },
          });

          // Update item header completion status
          setItemsList((prev) =>
            prev.map((it) => {
              if (it.id === activeItemId) {
                return { ...it, isComplete: true, hasNotes: Boolean(newNotes) };
              }
              return it;
            })
          );

          onProgressUpdated(res.progress);
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          onSaveStateChange(`Saved ✓ ${timeStr}`, false);
        } catch {
          onSaveStateChange('Saved locally', false);
        }
      }, 400);
    },
    [activeItemId, token, onProgressUpdated, onSaveStateChange]
  );

  // Set answer value for question
  const handleSelectAnswer = (qId: string, val: string) => {
    const updated = { ...answers, [qId]: val };
    setAnswers(updated);
    triggerAutosave(updated, notes);
  };

  // Set note text
  const handleNotesChange = (val: string) => {
    setNotes(val);
    triggerAutosave(answers, val);
  };

  // Navigate to index
  const goToIndex = (newIdx: number) => {
    if (newIdx < 0 || newIdx >= itemsList.length) return;
    setCurrentIndex(newIdx);
    loadItem(newIdx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Final Submit
  const handleSubmit = async () => {
    if (!allCompleted) {
      alert('Please answer all required questions before final submission.');
      return;
    }

    if (!confirm('Are you ready to submit your finalized responses to the study lead?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFinalReview(token);
      onSubmitted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Submission failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!currentItem?.generated_response) return;
    navigator.clipboard.writeText(currentItem.generated_response);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Keyboard navigation shortcuts (when not focused on textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        goToIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        goToIndex(currentIndex + 1);
      } else if (e.key === 'u' || e.key === 'U') {
        if (nextUnansweredIndex >= 0) goToIndex(nextUnansweredIndex);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, nextUnansweredIndex]);

  const hasModelQuestion = currentItem && currentItem.model_question.length > 0;
  const hasOracle = currentItem && Boolean(currentItem.oracle_answer);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-24 lg:pb-12 bg-neutral-50/50 dark:bg-neutral-950/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Top Control Bar: Item Progress & Palette Launcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 p-4 rounded-2xl bg-white border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
              title="Open full item grid"
            >
              <Grid className="h-4 w-4" />
              <span>Palette</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
                  {activeItemId}
                </span>
                <span className="text-xs text-neutral-400">·</span>
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
                  Item {currentIndex + 1} of {itemsList.length}
                </span>
                {activeHeader?.isComplete && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Answered
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Progress Bar */}
          <div className="flex items-center gap-4">
            <div className="w-full sm:w-48">
              <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                <span>Total Progress</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                  {Math.round((itemsList.filter((i) => i.isComplete).length / Math.max(1, itemsList.length)) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.round(
                      (itemsList.filter((i) => i.isComplete).length / Math.max(1, itemsList.length)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <a
              href={`/api/review/${token}/export-csv`}
              download
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              title="Download CSV backup of your responses"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </a>
          </div>
        </div>

        {/* Main Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (60%): Stimulus Material (Requirement + Clarification + Verilog Code) */}
          <div className="lg:col-span-7 space-y-5">
            {isLoadingItem ? (
              <div className="p-12 text-center rounded-2xl bg-white border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white"></div>
                <p className="mt-3 text-xs text-neutral-500">Loading item {activeItemId}…</p>
              </div>
            ) : currentItem ? (
              <>
                {/* 1. Requirement Specification Card */}
                <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Requirement Specification
                    </span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {currentItem.id}
                    </span>
                  </div>

                  <p className="text-sm sm:text-base leading-relaxed text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap font-sans">
                    {currentItem.requirement_prompt}
                  </p>

                  {/* Collapsible Module Ports */}
                  {currentItem.module_ports && (
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setShowPorts(!showPorts)}
                        className="flex items-center justify-between w-full text-xs font-semibold text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-neutral-400" />
                          Module Interface & Port Rules
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showPorts ? 'rotate-180' : ''}`} />
                      </button>

                      {showPorts && (
                        <div className="mt-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60">
                          <pre className="text-xs font-mono text-neutral-800 dark:text-neutral-200 overflow-x-auto whitespace-pre">
                            {currentItem.module_ports}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Clarification Question & Oracle Answer Card */}
                <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block mb-3">
                    Clarification Exchange & Oracle
                  </span>

                  {hasModelQuestion ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 dark:border-sky-900/30 dark:bg-sky-950/20">
                        <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 mb-1">
                          Model's Clarification Question:
                        </p>
                        <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">
                          {currentItem.model_question.join('\n\n')}
                        </p>
                      </div>

                      <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
                        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                          Benchmark Oracle Reference Answer:
                        </p>
                        <p className="text-sm text-neutral-900 dark:text-neutral-100 font-medium">
                          {currentItem.oracle_answer || '(No oracle answer provided)'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                      No model clarification question was asked for this item.
                      <br />
                      <span className="text-[11px] opacity-80">(Q1–Q3 are automatically marked as "na")</span>
                    </div>
                  )}
                </div>

                {/* 3. Generated RTL Code Viewer */}
                <div className="rounded-2xl bg-white shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-5 py-3 bg-neutral-50 dark:bg-neutral-800/50">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-neutral-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Generated RTL Response
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-200/80 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                        {currentItem.code_language.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWrapCode(!wrapCode)}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                          wrapCode
                            ? 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-white'
                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                      >
                        Wrap
                      </button>

                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                        title="Copy code"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="relative p-4 overflow-x-auto bg-neutral-900 text-neutral-100 font-mono text-xs sm:text-[13px] leading-relaxed">
                    <pre
                      tabIndex={0}
                      className={`${wrapCode ? 'whitespace-pre-wrap' : 'whitespace-pre'} focus:outline-none`}
                    >
                      <code>{currentItem.generated_response || '// (Empty code response)'}</code>
                    </pre>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Right Column (40%): Question Form & Rubric */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
            <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-xs border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-100 dark:border-neutral-800">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Evaluation Rubric ({rubric.length} Questions)
                </h2>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Auto-saved continuously
                </span>
              </div>

              {/* Rubric Questions (Q1 to Q6) */}
              <div className="space-y-5">
                {rubric.map((q) => {
                  const isAutoNaQuestion = q.autoRule === 'na_if_no_question' && !hasModelQuestion;
                  const isAutoNaOracle = q.autoRule === 'na_if_no_oracle' && !hasOracle;
                  const isAutoDisabled = isAutoNaQuestion || isAutoNaOracle;
                  const currentVal = isAutoDisabled ? 'na' : answers[q.id] || '';

                  return (
                    <fieldset key={q.id} className="border-0 m-0 p-0">
                      <legend className="text-xs font-semibold text-neutral-900 dark:text-white mb-1.5 flex items-start gap-1.5">
                        <span className="font-mono text-neutral-500 font-normal">{q.code}.</span>
                        <span>{q.prompt}</span>
                      </legend>

                      {isAutoDisabled ? (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 italic bg-neutral-50 dark:bg-neutral-800/40 p-2 rounded-lg">
                          Automatically recorded as <strong className="font-mono">"na"</strong> (
                          {isAutoNaQuestion ? 'no model question' : 'no oracle answer'}).
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mt-2" role="radiogroup" aria-label={q.prompt}>
                          {q.options.map((opt) => {
                            const isChecked = currentVal === opt;
                            return (
                              <button
                                type="button"
                                key={opt}
                                role="radio"
                                aria-checked={isChecked}
                                onClick={() => handleSelectAnswer(q.id, opt)}
                                className={`relative flex items-center justify-center min-h-[44px] px-3.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none ${
                                  isChecked
                                    ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-xs font-semibold'
                                    : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:border-neutral-700 dark:text-neutral-300'
                                }`}
                              >
                                {isChecked && <span className="mr-1.5 font-bold">✓</span>}
                                <span className="capitalize">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </fieldset>
                  );
                })}

                {/* Notes Input */}
                <div className="pt-2">
                  <label
                    htmlFor="item-notes"
                    className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1"
                  >
                    Notes or Reviewer Comments <span className="text-neutral-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    id="item-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Add any technical observations, ambiguity caveats, or rationale..."
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-white dark:focus:border-white transition-colors"
                  />
                </div>
              </div>

              {/* Status footer for right pane */}
              <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                <span>Shortcuts: ← / → items · U: next unanswered</span>
                {allCompleted && (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    All items complete!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation Bar (Responsive on Mobile and Desktop) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 py-2.5 px-4 shadow-lg transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          {/* Previous Button */}
          <button
            onClick={() => goToIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Center Position Tracker */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-xs sm:text-sm font-bold text-neutral-900 dark:text-white"
            >
              <span>{activeItemId}</span>
              <span className="font-normal text-neutral-400">({currentIndex + 1}/{itemsList.length})</span>
            </button>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2">
            {nextUnansweredIndex >= 0 && (
              <button
                onClick={() => goToIndex(nextUnansweredIndex)}
                className="hidden md:flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 min-h-[44px]"
                title="Jump directly to next incomplete item"
              >
                <span>Next Unanswered</span>
              </button>
            )}

            {allCompleted ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm transition-all min-h-[44px] cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Submit Final Answers</span>
              </button>
            ) : (
              <button
                onClick={() => goToIndex(currentIndex + 1)}
                disabled={currentIndex === itemsList.length - 1}
                className="flex items-center gap-1 rounded-xl bg-neutral-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors min-h-[44px] cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Item Palette Modal */}
      <ItemPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        items={itemsList}
        currentIndex={currentIndex}
        onSelectItem={(idx) => goToIndex(idx)}
      />
    </div>
  );
};
