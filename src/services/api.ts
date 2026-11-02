/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatasetSummary, ItemAnswer, ItemHeader, ReviewerProgress, ReviewerToken, RubricQuestion, SanitizedReviewItem } from '../types.ts';

const API_BASE = '/api';

export async function fetchDatasetSummary(): Promise<DatasetSummary> {
  const res = await fetch(`${API_BASE}/dataset`);
  if (!res.ok) throw new Error('Failed to load dataset information');
  const data = await res.json();
  return data.dataset;
}

export async function uploadDatasetZip(file: File, name?: string): Promise<{ dataset: DatasetSummary; warnings?: string[] }> {
  const formData = new FormData();
  formData.append('zipFile', file);
  if (name) formData.append('name', name);

  const res = await fetch(`${API_BASE}/dataset/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload and extract ZIP review set');
  }
  return { dataset: data.dataset, warnings: data.warnings };
}

export async function resetSampleDataset(): Promise<DatasetSummary> {
  const res = await fetch(`${API_BASE}/dataset/reset-sample`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reset dataset');
  return data.dataset;
}

export async function fetchRubric(): Promise<RubricQuestion[]> {
  const res = await fetch(`${API_BASE}/rubric`);
  if (!res.ok) throw new Error('Failed to load rubric questions');
  const data = await res.json();
  return data.rubric;
}

export async function updateRubric(rubric: RubricQuestion[]): Promise<RubricQuestion[]> {
  const res = await fetch(`${API_BASE}/rubric`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rubric }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update rubric');
  return data.rubric;
}

export async function fetchTokens(): Promise<ReviewerToken[]> {
  const res = await fetch(`${API_BASE}/tokens`);
  if (!res.ok) throw new Error('Failed to load reviewer tokens');
  const data = await res.json();
  return data.tokens;
}

export async function generateTokens(count: number, names?: string[], emails?: string[]): Promise<ReviewerToken[]> {
  const res = await fetch(`${API_BASE}/tokens/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, names, emails }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate tokens');
  return data.tokens;
}

export async function revokeToken(token: string): Promise<ReviewerToken> {
  const res = await fetch(`${API_BASE}/tokens/${token}/revoke`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to revoke link');
  return data.token;
}

export async function resumeToken(token: string): Promise<ReviewerToken> {
  const res = await fetch(`${API_BASE}/tokens/${token}/resume`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to restore link');
  return data.token;
}

export async function resetTokenProgress(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tokens/${token}/reset-progress`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reset progress');
}

export async function deleteToken(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tokens/${token}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete token');
}

// Reviewer session calls
export interface ReviewSessionData {
  reviewer: ReviewerToken;
  dataset: DatasetSummary;
  rubric: RubricQuestion[];
  progress: ReviewerProgress;
}

export async function fetchReviewSession(token: string): Promise<ReviewSessionData> {
  const res = await fetch(`${API_BASE}/review/${token}/session`);
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Invalid or revoked review link.');
  }
  return data;
}

export async function registerReviewer(token: string, name: string, email: string, affiliation?: string): Promise<ReviewerToken> {
  const res = await fetch(`${API_BASE}/review/${token}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, affiliation }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to register reviewer');
  return data.reviewer;
}

export async function fetchReviewItemsList(token: string): Promise<{ items: ItemHeader[]; totalItems: number; progress: ReviewerProgress }> {
  const res = await fetch(`${API_BASE}/review/${token}/items`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch review items');
  return data;
}

export async function fetchItemDetails(token: string, itemId: string): Promise<{ item: SanitizedReviewItem; savedAnswer: ItemAnswer; isComplete: boolean }> {
  const res = await fetch(`${API_BASE}/review/${token}/item/${itemId}`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load item');
  return data;
}

export async function saveReviewAnswers(
  token: string,
  answers: Record<string, { answers: Record<string, string>; notes?: string }>
): Promise<{ progress: ReviewerProgress }> {
  const res = await fetch(`${API_BASE}/review/${token}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save responses');
  return { progress: data.progress };
}

export async function submitFinalReview(token: string): Promise<ReviewerToken> {
  const res = await fetch(`${API_BASE}/review/${token}/submit`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to submit review');
  return data.reviewer;
}

// Local storage backup helper
export function getLocalBackup(token: string): Record<string, { answers: Record<string, string>; notes: string }> {
  try {
    const raw = localStorage.getItem(`brp_answers_${token}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalBackup(token: string, answers: Record<string, { answers: Record<string, string>; notes: string }>): void {
  try {
    localStorage.setItem(`brp_answers_${token}`, JSON.stringify(answers));
  } catch (e) {
    console.warn('LocalStorage quota or access error:', e);
  }
}
