/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';

export interface SanitizedReviewItem {
  id: string; // e.g., R001
  requirement_prompt: string;
  module_ports: string;
  model_question: string[];
  oracle_answer: string;
  generated_response: string;
  code_language: 'verilog' | 'systemverilog';
}

/**
 * Strips AI author watermarks and mentions from code to ensure double-blinding.
 */
export function sanitizeCode(code: string): string {
  if (!code) return '';
  return code
    .replace(/\/\/\s*Author:\s*generated\s*by\s*(ChatGPT|OpenAI|Claude|Anthropic|Gemini)[^\n]*/gi, '// Author: [Blinded]')
    .replace(/\/\*[\s\S]*?(ChatGPT|OpenAI|Claude|Anthropic|Gemini)[\s\S]*?\*\//gi, '/* [Blinded Model Comment] */')
    .replace(/(generated\s*by\s*(ChatGPT|GPT-4|Claude|Gemini))/gi, '[Blinded]');
}

/**
 * Extracts and cleans requirement prompt and separate module ports section.
 */
export function splitRequirement(rawPrompt: string): { requirement: string; ports: string } {
  if (!rawPrompt) return { requirement: '', ports: '' };
  
  let prompt = rawPrompt;
  // If the prompt starts with REQUIREMENT, isolate it
  if (prompt.includes('REQUIREMENT')) {
    const parts = prompt.split('REQUIREMENT');
    prompt = parts.slice(1).join('REQUIREMENT').trim();
  }

  // Look for MODULE PORTS marker
  if (prompt.includes('MODULE PORTS')) {
    const parts = prompt.split('MODULE PORTS');
    return {
      requirement: parts[0].trim(),
      ports: ('MODULE PORTS' + parts.slice(1).join('MODULE PORTS')).trim(),
    };
  }

  return { requirement: prompt.trim(), ports: '' };
}

/**
 * Safely parses a ZIP archive buffer and extracts sanitized review items.
 * Strictly guarantees that formal_outcome and evidence_logs are NEVER extracted or returned.
 */
export async function parseReviewZip(buffer: Buffer): Promise<{ items: SanitizedReviewItem[]; errors: string[] }> {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(buffer);
  const items: SanitizedReviewItem[] = [];
  const errors: string[] = [];

  // Filter for valid json file entries, rejecting any unsafe path traversal
  const fileNames = Object.keys(loaded.files)
    .filter((name) => {
      // Must end in .json and contain item ID pattern (e.g. R001.json, items/R001.json, or review_set/items/R001.json)
      return (
        !loaded.files[name].dir &&
        name.endsWith('.json') &&
        /R\d+\.json$/i.test(name) &&
        !name.includes('..') // Prevent path traversal
      );
    })
    .sort((a, b) => {
      const matchA = a.match(/R(\d+)\.json$/i);
      const matchB = b.match(/R(\d+)\.json$/i);
      const numA = matchA ? parseInt(matchA[1], 10) : 0;
      const numB = matchB ? parseInt(matchB[1], 10) : 0;
      return numA - numB;
    });

  if (fileNames.length === 0) {
    errors.push('No valid items (e.g. R001.json ... R320.json) found in the ZIP archive.');
    return { items, errors };
  }

  for (const fileName of fileNames) {
    try {
      const contentStr = await loaded.files[fileName].async('string');
      const rawJson = JSON.parse(contentStr);

      const reviewId =
        rawJson.review_id ||
        fileName.match(/R\d+/i)?.[0]?.toUpperCase() ||
        `R${String(items.length + 1).padStart(3, '0')}`;

      const { requirement, ports } = splitRequirement(rawJson.requirement_prompt || '');

      let modelQuestion: string[] = [];
      if (Array.isArray(rawJson.model_question)) {
        modelQuestion = rawJson.model_question.map((q: unknown) => String(q).trim()).filter(Boolean);
      } else if (rawJson.model_question && typeof rawJson.model_question === 'string') {
        const trimmed = rawJson.model_question.trim();
        if (trimmed) modelQuestion = [trimmed];
      }

      const oracleAnswer = typeof rawJson.oracle_answer === 'string' ? rawJson.oracle_answer.trim() : '';

      let rawCode = '';
      if (typeof rawJson.generated_response === 'string') {
        rawCode = rawJson.generated_response;
      }

      // Check code language
      const isSystemVerilog = /systemverilog/i.test(rawCode) || /logic\s+\[|always_comb|always_ff/i.test(rawCode);
      const codeLanguage: 'verilog' | 'systemverilog' = isSystemVerilog ? 'systemverilog' : 'verilog';

      // Sanitization: mask any author or LLM name references
      const cleanedCode = sanitizeCode(rawCode);

      // BLINDING ENFORCEMENT: Note that rawJson.formal_outcome and rawJson.evidence_logs are intentionally discarded here.
      items.push({
        id: reviewId,
        requirement_prompt: requirement,
        module_ports: ports,
        model_question: modelQuestion,
        oracle_answer: oracleAnswer,
        generated_response: cleanedCode,
        code_language: codeLanguage,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error reading item from ${fileName}: ${msg}`);
    }
  }

  return { items, errors };
}
