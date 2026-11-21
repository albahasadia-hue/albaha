#!/usr/bin/env node
/**
 * Safe JSON import & validation pipeline for `albaha_guide_144.json`.
 *
 * Google Sheets is the editorial source of truth; exporting/converting to JSON
 * and running this script validates fields, URLs, and potential duplicates
 * BEFORE activating the updated version.
 *
 * If validation fails, the script exits non-zero and preserves the last valid
 * active dataset untouched.
 *
 * Usage:
 *   node scripts/import-guide-data.mjs --check
 *   node scripts/import-guide-data.mjs path/to/new_albaha_guide.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ACTIVE_DATA_PATH = path.join(ROOT, 'src', 'data', 'albaha_guide_144.json');
const BACKUP_DATA_PATH = path.join(ROOT, 'src', 'data', 'albaha_guide_144.last-valid.json');

const VALID_CATEGORIES = new Set([
  'hotels_resorts',
  'restaurants_cafes',
  'forests_parks_waterfalls',
  'heritage_villages_museums',
  'souqs_shopping_entertainment',
  'farms_local_products',
  'travel_car_rentals',
]);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[\u0640\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSafeHttpUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function extractPhoneDigits(text) {
  const matches = String(text || '').match(/(?:\+?966[-\s]?(?:5\d|1\d|9200|800)[-\s\d]{5,12})/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\D/g, '')).filter((d) => d.length >= 10))];
}

export function validateGuideDataset(raw) {
  const errors = [];
  const warnings = [];
  const duplicatePairs = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ code: 'INVALID_ROOT', message: 'Root JSON must be an object with { metadata, items }.' });
    return { valid: false, totalItems: 0, errors, warnings, duplicatePairs };
  }

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    errors.push({ code: 'EMPTY_ITEMS', message: 'Dataset must include a non-empty items array.' });
    return { valid: false, totalItems: 0, errors, warnings, duplicatePairs };
  }

  const seenIds = new Set();
  const seenNameGov = new Map();
  const seenPhones = new Map();

  for (const item of raw.items) {
    if (!item || typeof item !== 'object') {
      errors.push({ code: 'INVALID_ITEM', message: 'Encountered non-object item.' });
      continue;
    }
    if (!Number.isInteger(item.id) || item.id <= 0) {
      errors.push({ code: 'INVALID_ID', message: `Invalid numeric id for "${item.name || 'unknown'}".` });
      continue;
    }
    if (seenIds.has(item.id)) {
      errors.push({ code: 'DUPLICATE_ID', itemId: item.id, message: `Duplicate id=${item.id}.` });
      continue;
    }
    seenIds.add(item.id);

    if (!item.name || !String(item.name).trim()) {
      errors.push({ code: 'MISSING_NAME', itemId: item.id, message: `Missing name for id=${item.id}.` });
    }
    if (!VALID_CATEGORIES.has(item.category_key)) {
      errors.push({
        code: 'INVALID_CATEGORY',
        itemId: item.id,
        message: `Unsupported category_key="${item.category_key}" for id=${item.id}.`,
      });
    }
    if (!item.governorate || !String(item.governorate).trim()) {
      errors.push({ code: 'MISSING_GOVERNORATE', itemId: item.id, message: `Missing governorate for id=${item.id}.` });
    }
    if (!item.description || !String(item.description).trim()) {
      warnings.push({ code: 'MISSING_DESCRIPTION', itemId: item.id, message: `Missing description for id=${item.id}.` });
    }
    if (!item.address || !String(item.address).trim()) {
      warnings.push({ code: 'MISSING_ADDRESS', itemId: item.id, message: `Missing address for id=${item.id}.` });
    }

    for (const [linkKey, linkObj] of Object.entries(item.links || {})) {
      if (linkObj && linkObj.url !== null && linkObj.url !== undefined && linkObj.url !== '') {
        if (!isSafeHttpUrl(linkObj.url)) {
          warnings.push({
            code: 'INVALID_URL',
            itemId: item.id,
            message: `Invalid URL in links.${linkKey} for id=${item.id}: ${linkObj.url}`,
          });
        }
      }
    }

    const baseName = normalizeText(String(item.name || '').replace(/\([^)]*\)/g, ''));
    const govNorm = normalizeText(item.governorate || '');
    const key = `${baseName}::${govNorm}`;
    if (baseName.length >= 4 && seenNameGov.has(key)) {
      const primaryId = seenNameGov.get(key);
      duplicatePairs.push({ primaryId, duplicateId: item.id, reason: `Same name & governorate (${item.name})` });
      warnings.push({
        code: 'POTENTIAL_DUPLICATE',
        itemId: item.id,
        message: `Potential duplicate of id=${primaryId}: ${item.name} (${item.governorate})`,
      });
    } else if (baseName.length >= 4) {
      seenNameGov.set(key, item.id);
    }

    for (const digits of extractPhoneDigits(item.contact_and_booking)) {
      if (seenPhones.has(digits)) {
        const primaryId = seenPhones.get(digits);
        duplicatePairs.push({ primaryId, duplicateId: item.id, reason: `Shared phone (${digits})` });
        warnings.push({
          code: 'SHARED_PHONE',
          itemId: item.id,
          message: `Shared phone (${digits}) between id=${primaryId} and id=${item.id}`,
        });
      } else {
        seenPhones.set(digits, item.id);
      }
    }
  }

  return {
    valid: errors.length === 0,
    totalItems: raw.items.length,
    errors,
    warnings,
    duplicatePairs,
  };
}

export function importGuideFile(candidatePath, { activePath = ACTIVE_DATA_PATH, backupPath = BACKUP_DATA_PATH, checkOnly = false } = {}) {
  let rawText;
  try {
    rawText = fs.readFileSync(candidatePath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      activated: false,
      error: `Failed to read candidate file: ${err.message}`,
      report: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return {
      ok: false,
      activated: false,
      error: `Invalid JSON syntax: ${err.message}`,
      report: null,
    };
  }

  const report = validateGuideDataset(parsed);
  if (!report.valid) {
    return {
      ok: false,
      activated: false,
      error: `Validation failed with ${report.errors.length} error(s). Last valid dataset preserved.`,
      report,
    };
  }

  if (checkOnly) {
    return { ok: true, activated: false, report };
  }

  // Backup current active valid file before atomic replace
  if (fs.existsSync(activePath)) {
    fs.copyFileSync(activePath, backupPath);
  }
  const tmpPath = `${activePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, activePath);

  return { ok: true, activated: true, report };
}

// Run CLI when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const target = fileArg ? path.resolve(process.cwd(), fileArg) : ACTIVE_DATA_PATH;

  const result = importGuideFile(target, { checkOnly });
  if (!result.ok) {
    console.error(`[Guide Import] REJECTED: ${result.error}`);
    if (result.report?.errors?.length) {
      for (const e of result.report.errors) console.error(`  - [${e.code}] ${e.message}`);
    }
    process.exit(1);
  }

  const { report } = result;
  console.log(`[Guide Import] VALID: ${report.totalItems} items checked.`);
  console.log(`  Warnings: ${report.warnings.length}`);
  for (const w of report.warnings) {
    console.log(`  - [${w.code}] ${w.message}`);
  }
  if (result.activated) {
    console.log(`[Guide Import] Activated new dataset -> ${ACTIVE_DATA_PATH}`);
    console.log(`[Guide Import] Previous valid backup saved -> ${BACKUP_DATA_PATH}`);
  }
}
