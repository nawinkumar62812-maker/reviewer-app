/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SanitizedReviewItem {
  id: string;
  requirement_prompt: string;
  module_ports: string;
  model_question: string[];
  oracle_answer: string;
  generated_response: string;
  code_language: 'verilog' | 'systemverilog';
}

export interface RubricQuestion {
  id: string;
  code: string;
  prompt: string;
  description?: string;
  options: string[];
  autoRule?: 'na_if_no_question' | 'na_if_no_oracle' | 'none';
}

export interface ReviewerProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface ReviewerToken {
  token: string;
  name: string;
  email: string;
  affiliation?: string;
  status: 'created' | 'details_submitted' | 'in_progress' | 'submitted' | 'revoked';
  shuffleSeed: number;
  createdAt: number;
  firstOpenedAt?: number;
  lastActiveAt?: number;
  submittedAt?: number;
  progress?: ReviewerProgress;
}

export interface ItemAnswer {
  answers: Record<string, string>;
  notes: string;
  isComplete: boolean;
  updatedAt: number;
}

export interface DatasetSummary {
  id: string;
  name: string;
  rawFilename: string;
  itemCount: number;
  createdAt: number;
}

export interface ItemHeader {
  id: string;
  index: number;
  isComplete: boolean;
  hasNotes?: boolean;
}
