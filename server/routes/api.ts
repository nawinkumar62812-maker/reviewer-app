/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db, RubricQuestion } from '../db.ts';
import { parseReviewZip } from '../zipParser.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max zip
});

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// -----------------------------------------------------------------------------
// Admin: Dataset & Rubric Endpoints
// -----------------------------------------------------------------------------

router.get('/dataset', (_req: Request, res: Response) => {
  const summary = db.getDatasetSummary();
  res.json({ success: true, dataset: summary });
});

router.post('/dataset/upload', upload.single('zipFile'), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No ZIP file uploaded.' });
    }

    const { items, errors } = await parseReviewZip(req.file.buffer);
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: errors[0] || 'No review items found in the uploaded archive.',
        errors,
      });
    }

    const datasetName = req.body.name || req.file.originalname.replace(/\.zip$/i, '');
    db.setDataset(datasetName, req.file.originalname, items);

    res.json({
      success: true,
      message: `Successfully extracted and published ${items.length} blinded review items.`,
      dataset: db.getDatasetSummary(),
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: `Failed to process ZIP: ${msg}` });
  }
});

router.post('/dataset/reset-sample', (_req: Request, res: Response) => {
  db.resetToSampleDataset();
  res.json({
    success: true,
    message: 'Reset to sample T7 Hardware benchmark dataset.',
    dataset: db.getDatasetSummary(),
  });
});

router.get('/rubric', (_req: Request, res: Response) => {
  res.json({ success: true, rubric: db.getRubric() });
});

router.put('/rubric', (req: Request, res: Response) => {
  const newRubric = req.body.rubric;
  if (!Array.isArray(newRubric) || newRubric.length === 0) {
    return res.status(400).json({ success: false, error: 'Invalid rubric array provided.' });
  }
  db.updateRubric(newRubric as RubricQuestion[]);
  res.json({ success: true, rubric: db.getRubric() });
});

// -----------------------------------------------------------------------------
// Admin: Token Management Endpoints
// -----------------------------------------------------------------------------

router.get('/tokens', (_req: Request, res: Response) => {
  const rawTokens = db.getTokens();
  const tokensWithMetrics = rawTokens.map((t) => {
    const progress = db.getReviewerProgress(t.token);
    return {
      ...t,
      progress,
    };
  });
  res.json({ success: true, tokens: tokensWithMetrics });
});

router.post('/tokens/generate', (req: Request, res: Response) => {
  const count = Math.max(1, Math.min(100, parseInt(req.body.count, 10) || 1));
  const names = Array.isArray(req.body.names) ? req.body.names : undefined;
  const emails = Array.isArray(req.body.emails) ? req.body.emails : undefined;

  const generated = db.createTokens(count, names, emails);
  res.json({
    success: true,
    message: `Generated ${generated.length} review link(s).`,
    tokens: generated.map((t) => ({ ...t, progress: db.getReviewerProgress(t.token) })),
  });
});

router.post('/tokens/:token/revoke', (req: Request, res: Response) => {
  const { token } = req.params;
  const existing = db.getToken(token);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Token not found.' });
  }
  db.setTokenStatus(token, 'revoked');
  res.json({ success: true, token: db.getToken(token) });
});

router.post('/tokens/:token/resume', (req: Request, res: Response) => {
  const { token } = req.params;
  const existing = db.getToken(token);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Token not found.' });
  }
  const progress = db.getReviewerProgress(token);
  const status = progress.completed > 0 ? 'in_progress' : existing.name ? 'details_submitted' : 'created';
  db.setTokenStatus(token, status);
  res.json({ success: true, token: db.getToken(token) });
});

router.post('/tokens/:token/reset-progress', (req: Request, res: Response) => {
  const { token } = req.params;
  const existing = db.getToken(token);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Token not found.' });
  }
  db.resetTokenProgress(token);
  res.json({
    success: true,
    message: 'Reset reviewer progress.',
    token: db.getToken(token),
    progress: db.getReviewerProgress(token),
  });
});

router.delete('/tokens/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const deleted = db.deleteToken(token);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Token not found.' });
  }
  res.json({ success: true, message: 'Reviewer entry deleted.' });
});

// -----------------------------------------------------------------------------
// Reviewer: Public Session & Workspace Endpoints
// -----------------------------------------------------------------------------

router.get('/review/:token/session', (req: Request, res: Response) => {
  const { token } = req.params;
  const reviewer = db.getToken(token);

  if (!reviewer) {
    return res.status(404).json({
      success: false,
      error: 'Invalid review link. Please check your URL or contact the study lead.',
    });
  }

  if (reviewer.status === 'revoked') {
    return res.status(403).json({
      success: false,
      error: 'Access to this review link has been revoked by the study lead.',
    });
  }

  const dataset = db.getDatasetSummary();
  const rubric = db.getRubric();
  const progress = db.getReviewerProgress(token);

  res.json({
    success: true,
    reviewer,
    dataset,
    rubric,
    progress,
  });
});

router.post('/review/:token/register', (req: Request, res: Response) => {
  const { token } = req.params;
  const { name, email, affiliation } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  try {
    const updated = db.updateTokenRegistration(token, name, email, affiliation);
    res.json({
      success: true,
      reviewer: updated,
      progress: db.getReviewerProgress(token),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ success: false, error: msg });
  }
});

router.get('/review/:token/items', (req: Request, res: Response) => {
  const { token } = req.params;
  const reviewer = db.getToken(token);
  if (!reviewer || reviewer.status === 'revoked') {
    return res.status(403).json({ success: false, error: 'Unauthorized.' });
  }

  const shuffledItems = db.getShuffledItemsForToken(token);
  const responses = db.getResponsesForToken(token);

  const itemHeaders = shuffledItems.map((item, index) => {
    const resp = responses[item.id];
    const isComplete = db.isItemComplete(item, resp ? resp.answers : {});
    return {
      id: item.id,
      index: index + 1,
      isComplete,
      hasNotes: Boolean(resp?.notes),
    };
  });

  res.json({
    success: true,
    totalItems: itemHeaders.length,
    items: itemHeaders,
    progress: db.getReviewerProgress(token),
  });
});

router.get('/review/:token/item/:itemId', (req: Request, res: Response) => {
  const { token, itemId } = req.params;
  const reviewer = db.getToken(token);
  if (!reviewer || reviewer.status === 'revoked') {
    return res.status(403).json({ success: false, error: 'Unauthorized.' });
  }

  const item = db.getItemById(itemId);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Review item not found.' });
  }

  const responses = db.getResponsesForToken(token);
  const currentSaved = responses[itemId] || {
    answers: {},
    notes: '',
    isComplete: false,
    updatedAt: 0,
  };

  res.json({
    success: true,
    item,
    savedAnswer: currentSaved,
    isComplete: db.isItemComplete(item, currentSaved.answers),
  });
});

router.post('/review/:token/save', (req: Request, res: Response) => {
  const { token } = req.params;
  const answersPayload = req.body.answers;

  if (!answersPayload || typeof answersPayload !== 'object') {
    return res.status(400).json({ success: false, error: 'Invalid answers payload.' });
  }

  try {
    const saveResult = db.saveResponses(token, answersPayload);
    const progress = db.getReviewerProgress(token);
    res.json({
      success: true,
      message: 'Progress saved successfully.',
      ...saveResult,
      progress,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: `Autosave failed: ${msg}` });
  }
});

router.post('/review/:token/submit', (req: Request, res: Response) => {
  const { token } = req.params;
  const reviewer = db.getToken(token);
  if (!reviewer) {
    return res.status(404).json({ success: false, error: 'Reviewer token not found.' });
  }

  const progress = db.getReviewerProgress(token);
  if (progress.completed < progress.total) {
    return res.status(400).json({
      success: false,
      error: `Incomplete review: ${progress.completed} of ${progress.total} items completed. Please complete all items before final submission.`,
    });
  }

  db.setTokenStatus(token, 'submitted');
  res.json({
    success: true,
    message: 'Your review has been successfully submitted to the study lead.',
    reviewer: db.getToken(token),
  });
});

// -----------------------------------------------------------------------------
// Exports: CSV and JSON
// -----------------------------------------------------------------------------

function generateReviewerCsv(token: string): string {
  const reviewer = db.getToken(token);
  if (!reviewer) throw new Error('Token not found');

  const rubric = db.getRubric();
  const responses = db.getResponsesForToken(token);
  const dataset = db.getDatasetSummary();

  const headers = ['review_id', 'reviewer', ...rubric.map((q) => q.code), 'Notes', 'reviewer_email'];
  const rows: string[] = [headers.map(escapeCsv).join(',')];

  // Output sorted by natural item ID (R001 ... R320)
  const items = [...db.getShuffledItemsForToken(token)].sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  for (const it of items) {
    const resp = responses[it.id];
    const rowValues = [
      it.id,
      reviewer.name || 'Anonymous Reviewer',
      ...rubric.map((q) => (resp?.answers ? resp.answers[q.id] || '' : '')),
      resp?.notes || '',
      reviewer.email || '',
    ];
    rows.push(rowValues.map(escapeCsv).join(','));
  }

  return rows.join('\r\n') + '\r\n';
}

router.get('/review/:token/export-csv', (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    const csvContent = generateReviewerCsv(token);
    const reviewer = db.getToken(token);
    const safeName = (reviewer?.name || 'reviewer').toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    const filename = `review_form_${safeName}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Error generating CSV: ${msg}`);
  }
});

router.get('/admin/export/reviewer/:token/csv', (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    const csvContent = generateReviewerCsv(token);
    const reviewer = db.getToken(token);
    const safeName = (reviewer?.name || 'reviewer').toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    const filename = `review_form_${safeName}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Error generating CSV: ${msg}`);
  }
});

router.get('/admin/export/all/csv', (_req: Request, res: Response) => {
  try {
    const rubric = db.getRubric();
    const tokens = db.getTokens();

    const headers = [
      'review_id',
      'reviewer',
      'reviewer_email',
      'reviewer_status',
      ...rubric.map((q) => q.code),
      'Notes',
    ];
    const rows: string[] = [headers.map(escapeCsv).join(',')];

    for (const t of tokens) {
      const responses = db.getResponsesForToken(t.token);
      const items = [...db.getShuffledItemsForToken(t.token)].sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      for (const it of items) {
        const resp = responses[it.id];
        // Only output rows if reviewer has interacted or if we want full matrix
        const rowValues = [
          it.id,
          t.name || 'Unregistered',
          t.email || '',
          t.status,
          ...rubric.map((q) => (resp?.answers ? resp.answers[q.id] || '' : '')),
          resp?.notes || '',
        ];
        rows.push(rowValues.map(escapeCsv).join(','));
      }
    }

    const filename = `all_reviewer_responses_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(rows.join('\r\n') + '\r\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Error generating combined CSV: ${msg}`);
  }
});

router.get('/admin/export/all/json', (_req: Request, res: Response) => {
  try {
    const backup = db.getAllDataForBackup();
    const filename = `blinded_portal_backup_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Error generating JSON backup: ${msg}`);
  }
});

export default router;
