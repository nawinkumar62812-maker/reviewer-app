/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SanitizedReviewItem } from './zipParser.ts';
import { SAMPLE_T7_ITEMS } from './seedData.ts';

export interface RubricQuestion {
  id: string; // e.g. 'q1'
  code: string; // e.g. 'Q1'
  prompt: string;
  description?: string;
  options: string[];
  autoRule?: 'na_if_no_question' | 'na_if_no_oracle' | 'none';
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
}

export interface ItemAnswer {
  answers: Record<string, string>; // e.g. { q1: "yes", q2: "no", ... }
  notes: string;
  isComplete: boolean;
  updatedAt: number;
}

export interface Dataset {
  id: string;
  name: string;
  rawFilename: string;
  itemCount: number;
  createdAt: number;
  items: SanitizedReviewItem[];
}

export interface PortalDatabase {
  dataset: Dataset;
  rubric: RubricQuestion[];
  tokens: Record<string, ReviewerToken>;
  responses: Record<string, Record<string, ItemAnswer>>; // token -> itemId -> ItemAnswer
}

export const DEFAULT_T7_RUBRIC: RubricQuestion[] = [
  {
    id: 'q1',
    code: 'Q1',
    prompt: "Is the model's clarification question relevant to the requirement?",
    description: 'Assesses whether the clarification inquiry addresses the functional hardware specification.',
    options: ['yes', 'no', 'na'],
    autoRule: 'na_if_no_question',
  },
  {
    id: 'q2',
    code: 'Q2',
    prompt: 'Does it identify the intended ambiguity?',
    description: 'Verifies if the model spotted the deliberate specification ambiguity in the prompt.',
    options: ['yes', 'no', 'na'],
    autoRule: 'na_if_no_question',
  },
  {
    id: 'q3',
    code: 'Q3',
    prompt: 'Is the oracle answer faithful to the frozen text, and does it only answer the question?',
    description: 'Checks that the benchmark reference answer conforms strictly to the frozen study rules.',
    options: ['yes', 'no', 'na'],
    autoRule: 'na_if_no_question',
  },
  {
    id: 'q4',
    code: 'Q4',
    prompt: 'Does the RTL follow the oracle answer?',
    description: 'Evaluates if the generated Verilog code implemented the behavior dictated by the oracle.',
    options: ['yes', 'no', 'partly', 'na'],
    autoRule: 'na_if_no_oracle',
  },
  {
    id: 'q5',
    code: 'Q5',
    prompt: 'Does the RTL introduce unrelated assumptions?',
    description: 'Checks for extraneous hardware assumptions not warranted by prompt or oracle.',
    options: ['yes', 'no'],
    autoRule: 'none',
  },
  {
    id: 'q6',
    code: 'Q6',
    prompt: 'What is the main failure cause?',
    description: 'Categorizes the primary root cause if the implementation fails validation.',
    options: ['ambiguity', 'implementation', 'syntax', 'interface', 'formal-tool-limit', 'none'],
    autoRule: 'none',
  },
];

class DatabaseManager {
  private dbPath: string;
  private db: PortalDatabase;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'portal_db.json');
    this.db = this.loadDatabase();
  }

  private loadDatabase(): PortalDatabase {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to load database from disk, reinitializing default:', err);
      }
    }

    const initialDb: PortalDatabase = {
      dataset: {
        id: 't7_default_set',
        name: 'T7 Blinded Hardware Review Set (Preloaded Demo)',
        rawFilename: 'T7_BLINDED_REVIEW_SET.zip',
        itemCount: SAMPLE_T7_ITEMS.length,
        createdAt: Date.now(),
        items: SAMPLE_T7_ITEMS,
      },
      rubric: DEFAULT_T7_RUBRIC,
      tokens: {},
      responses: {},
    };

    this.saveDatabase(initialDb);
    return initialDb;
  }

  private saveDatabase(dbToSave?: PortalDatabase): void {
    const data = dbToSave || this.db;
    const tempPath = `${this.dbPath}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dbPath);
    } catch (err) {
      console.error('Failed to atomically persist database:', err);
    }
  }

  public getDatasetSummary() {
    return {
      id: this.db.dataset.id,
      name: this.db.dataset.name,
      rawFilename: this.db.dataset.rawFilename,
      itemCount: this.db.dataset.itemCount,
      createdAt: this.db.dataset.createdAt,
    };
  }

  public getRubric(): RubricQuestion[] {
    return this.db.rubric;
  }

  public updateRubric(newRubric: RubricQuestion[]): void {
    this.db.rubric = newRubric;
    this.saveDatabase();
  }

  public setDataset(name: string, rawFilename: string, items: SanitizedReviewItem[]): void {
    this.db.dataset = {
      id: `dataset_${Date.now()}`,
      name,
      rawFilename,
      itemCount: items.length,
      createdAt: Date.now(),
      items,
    };
    this.saveDatabase();
  }

  public resetToSampleDataset(): void {
    this.db.dataset = {
      id: 't7_default_set',
      name: 'T7 Blinded Hardware Review Set (Preloaded Demo)',
      rawFilename: 'T7_BLINDED_REVIEW_SET.zip',
      itemCount: SAMPLE_T7_ITEMS.length,
      createdAt: Date.now(),
      items: SAMPLE_T7_ITEMS,
    };
    this.saveDatabase();
  }

  public getTokens(): ReviewerToken[] {
    return Object.values(this.db.tokens).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getToken(token: string): ReviewerToken | undefined {
    return this.db.tokens[token];
  }

  public createTokens(
    count: number,
    names?: string[],
    emails?: string[]
  ): ReviewerToken[] {
    const created: ReviewerToken[] = [];
    for (let i = 0; i < count; i++) {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const shuffleSeed = Math.floor(Math.random() * 1000000) + 1;
      const name = (names && names[i]) || '';
      const email = (emails && emails[i]) || '';

      const reviewerToken: ReviewerToken = {
        token,
        name,
        email,
        status: name && email ? 'details_submitted' : 'created',
        shuffleSeed,
        createdAt: Date.now(),
      };

      this.db.tokens[token] = reviewerToken;
      this.db.responses[token] = {};
      created.push(reviewerToken);
    }
    this.saveDatabase();
    return created;
  }

  public updateTokenRegistration(
    token: string,
    name: string,
    email: string,
    affiliation?: string
  ): ReviewerToken {
    const rec = this.db.tokens[token];
    if (!rec) throw new Error('Token not found');

    rec.name = name.trim();
    rec.email = email.trim();
    if (affiliation) rec.affiliation = affiliation.trim();
    if (rec.status === 'created') {
      rec.status = 'details_submitted';
    }
    if (!rec.firstOpenedAt) {
      rec.firstOpenedAt = Date.now();
    }
    rec.lastActiveAt = Date.now();

    this.saveDatabase();
    return rec;
  }

  public setTokenStatus(token: string, status: ReviewerToken['status']): void {
    const rec = this.db.tokens[token];
    if (rec) {
      rec.status = status;
      if (status === 'submitted') {
        rec.submittedAt = Date.now();
      }
      rec.lastActiveAt = Date.now();
      this.saveDatabase();
    }
  }

  public deleteToken(token: string): boolean {
    if (this.db.tokens[token]) {
      delete this.db.tokens[token];
      delete this.db.responses[token];
      this.saveDatabase();
      return true;
    }
    return false;
  }

  public resetTokenProgress(token: string): void {
    if (this.db.tokens[token]) {
      this.db.responses[token] = {};
      this.db.tokens[token].status = this.db.tokens[token].name ? 'details_submitted' : 'created';
      this.db.tokens[token].submittedAt = undefined;
      this.saveDatabase();
    }
  }

  /**
   * Deterministically shuffles the items using a seeded Mulberry32 PRNG.
   */
  public getShuffledItemsForToken(token: string): SanitizedReviewItem[] {
    const reviewer = this.db.tokens[token];
    const items = [...this.db.dataset.items];
    if (!reviewer) return items;

    // Seeded Mulberry32 random generator
    let s = reviewer.shuffleSeed;
    const random = () => {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Fisher-Yates shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    return items;
  }

  public getItemById(itemId: string): SanitizedReviewItem | undefined {
    return this.db.dataset.items.find((it) => it.id === itemId);
  }

  public getResponsesForToken(token: string): Record<string, ItemAnswer> {
    return this.db.responses[token] || {};
  }

  public saveResponses(
    token: string,
    answersToSave: Record<string, { answers: Record<string, string>; notes?: string }>
  ): { savedCount: number; totalCompleted: number } {
    const reviewer = this.db.tokens[token];
    if (!reviewer) throw new Error('Token not found');

    if (!this.db.responses[token]) {
      this.db.responses[token] = {};
    }

    for (const [itemId, payload] of Object.entries(answersToSave)) {
      const item = this.getItemById(itemId);
      const isComplete = this.isItemComplete(item, payload.answers);

      this.db.responses[token][itemId] = {
        answers: payload.answers,
        notes: payload.notes || '',
        isComplete,
        updatedAt: Date.now(),
      };
    }

    // Update reviewer telemetry
    reviewer.lastActiveAt = Date.now();
    const completedCount = Object.values(this.db.responses[token]).filter((ans) => ans.isComplete).length;
    if (reviewer.status !== 'submitted') {
      reviewer.status = completedCount > 0 ? 'in_progress' : reviewer.name ? 'details_submitted' : 'created';
    }

    this.saveDatabase();
    return {
      savedCount: Object.keys(answersToSave).length,
      totalCompleted: completedCount,
    };
  }

  public isItemComplete(item: SanitizedReviewItem | undefined, answers: Record<string, string>): boolean {
    if (!item) return false;
    for (const q of this.db.rubric) {
      if (q.autoRule === 'na_if_no_question' && item.model_question.length === 0) {
        // Automatically considered 'na'
        continue;
      }
      if (q.autoRule === 'na_if_no_oracle' && !item.oracle_answer) {
        // Automatically considered 'na'
        continue;
      }
      if (!answers[q.id]) {
        return false;
      }
    }
    return true;
  }

  public getReviewerProgress(token: string): { completed: number; total: number; percentage: number } {
    const total = this.db.dataset.itemCount;
    const reviewerResponses = this.db.responses[token] || {};
    let completed = 0;
    for (const item of this.db.dataset.items) {
      const resp = reviewerResponses[item.id];
      if (resp && this.isItemComplete(item, resp.answers)) {
        completed++;
      }
    }
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }

  public getAllDataForBackup() {
    return {
      exportedAt: new Date().toISOString(),
      dataset: this.db.dataset,
      rubric: this.db.rubric,
      tokens: this.db.tokens,
      responses: this.db.responses,
    };
  }
}

export const db = new DatabaseManager();
