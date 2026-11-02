/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { X, Search, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { ItemHeader } from '../types.ts';

interface ItemPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ItemHeader[];
  currentIndex: number;
  onSelectItem: (index: number) => void;
}

export const ItemPaletteModal: React.FC<ItemPaletteModalProps> = ({
  isOpen,
  onClose,
  items,
  currentIndex,
  onSelectItem,
}) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'unanswered'>('all');
  const [search, setSearch] = useState('');

  const completedCount = useMemo(() => items.filter((i) => i.isComplete).length, [items]);
  const unansweredCount = items.length - completedCount;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'completed' && !item.isComplete) return false;
      if (filter === 'unanswered' && item.isComplete) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        return item.id.toLowerCase().includes(query) || String(item.index).includes(query);
      }
      return true;
    });
  }, [items, filter, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
          <div>
            <h2 id="palette-title" className="text-base font-semibold text-neutral-900 dark:text-white">
              Item Navigation Palette
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {completedCount} answered · {unansweredCount} remaining of {items.length} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-3 border-b border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-1 rounded-lg bg-neutral-200/60 p-0.5 dark:bg-neutral-800">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                filter === 'all'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter('unanswered')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                filter === 'unanswered'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Unanswered ({unansweredCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                filter === 'completed'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Complete ({completedCount})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search item ID (e.g. R042)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 rounded-lg border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:border-white"
            />
          </div>
        </div>

        {/* Items Grid View */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No items match your filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {filteredItems.map((item) => {
                const isCurrent = item.index - 1 === currentIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectItem(item.index - 1);
                      onClose();
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-mono transition-all border ${
                      isCurrent
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900 shadow-md ring-2 ring-neutral-400'
                        : item.isComplete
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300 hover:border-emerald-400'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-300 hover:border-neutral-400'
                    }`}
                  >
                    <span className="font-semibold">{item.id}</span>
                    <span className="text-[10px] opacity-75 mt-0.5">#{item.index}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 px-6 py-3 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
              Pending
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
