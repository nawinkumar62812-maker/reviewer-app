/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Check, RotateCcw } from 'lucide-react';
import { RubricQuestion } from '../../types.ts';

interface RubricEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rubric: RubricQuestion[];
  onSaveRubric: (updated: RubricQuestion[]) => Promise<void>;
  onResetDefault: () => void;
}

export const RubricEditorModal: React.FC<RubricEditorModalProps> = ({
  isOpen,
  onClose,
  rubric,
  onSaveRubric,
  onResetDefault,
}) => {
  const [questions, setQuestions] = useState<RubricQuestion[]>(() => [...rubric]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUpdateField = (index: number, field: keyof RubricQuestion, value: unknown) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateOptions = (index: number, commaSeparated: string) => {
    const opts = commaSeparated.split(',').map((s) => s.trim()).filter(Boolean);
    handleUpdateField(index, 'options', opts);
  };

  const handleAddQuestion = () => {
    const newIdx = questions.length + 1;
    const newQ: RubricQuestion = {
      id: `q${newIdx}`,
      code: `Q${newIdx}`,
      prompt: 'New evaluation question prompt',
      options: ['yes', 'no', 'na'],
      autoRule: 'none',
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      setError('A minimum of one review question is required.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError('');
    setIsSaving(true);
    try {
      await onSaveRubric(questions);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rubric-editor-title"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
          <div>
            <h2 id="rubric-editor-title" className="text-base font-semibold text-neutral-900 dark:text-white">
              Evaluation Rubric & Question Schema
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Configure the questions and allowable choice answers presented to reviewers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                    {q.code}
                  </span>
                  <input
                    type="text"
                    value={q.code}
                    onChange={(e) => handleUpdateField(idx, 'code', e.target.value)}
                    className="w-16 rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(idx)}
                  className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                  title="Delete question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                  Question Prompt Text
                </label>
                <input
                  type="text"
                  value={q.prompt}
                  onChange={(e) => handleUpdateField(idx, 'prompt', e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Allowed Choices (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={q.options.join(', ')}
                    onChange={(e) => handleUpdateOptions(idx, e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                    Auto-Fill Logic
                  </label>
                  <select
                    value={q.autoRule || 'none'}
                    onChange={(e) => handleUpdateField(idx, 'autoRule', e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="none">None (Always required)</option>
                    <option value="na_if_no_question">Auto 'na' if item has no model question</option>
                    <option value="na_if_no_oracle">Auto 'na' if item has no oracle answer</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-3 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Custom Question</span>
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 bg-neutral-50 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => {
              onResetDefault();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Standard T7 (Q1–Q6)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
