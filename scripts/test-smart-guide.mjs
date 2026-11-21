#!/usr/bin/env node
/**
 * Independent end-to-end test suite for "المرشد الذكي" (Smart Guide PRD).
 *
 * Tests:
 *  1. Data import & validation (144 records, duplicate detection, rollback on corrupt input)
 *  2. Live Next.js /api/concierge integration WITH GEMINI_API_KEY from .env.local
 *  3. Hotel lookup & strict Phone / Booking / Official / WhatsApp rules
 *  4. Stay in Al-Aqiq recommendations (area specificity, images, internal links)
 *  5. Multi-turn 2-day family trip planning + time modification + first-stop swap
 *  6. Explicit in-site navigation commands vs non-auto recommendations
 *  7. Ambiguous place name clarification & unconfirmed-attribute honesty
 *  8. Missing GEMINI_API_KEY fallback & upstream connection failure + retryable state
 *  9. Zero leakage of "Gemini" or API key anywhere in responses
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGuideFile } from './import-guide-data.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function waitForServer(url, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

function startNextServer(port, extraEnv) {
  const nextBin = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (d) => { logs += d.toString(); });
  child.stderr.on('data', (d) => { logs += d.toString(); });
  return {
    child,
    getLogs: () => logs,
    stop: async () => {
      if (!child.killed) {
        child.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 400));
        if (!child.killed) child.kill('SIGKILL');
      }
    },
  };
}

async function askApi(port, payload) {
  const res = await fetch(`http://127.0.0.1:${port}/api/concierge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  assert.ok(!/gemini/i.test(text), `Response leaked provider name "Gemini": ${text.slice(0, 240)}`);
  assert.ok(!/AQ\.[A-Za-z0-9_-]{10,}/.test(text), 'Response leaked API key!');
  return { status: res.status, json: JSON.parse(text) };
}

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runTests() {
  // -------------------------------------------------------------------------
  // 1) Data validation & safe rollback test
  // -------------------------------------------------------------------------
  const activePath = path.join(ROOT, 'src', 'data', 'albaha_guide_144.json');
  const checkRes = importGuideFile(activePath, { checkOnly: true });
  assert.equal(checkRes.ok, true);
  assert.equal(checkRes.report.totalItems, 144);
  assert.ok(checkRes.report.warnings.some((w) => w.code === 'POTENTIAL_DUPLICATE'));
  record('Data validation on albaha_guide_144.json', true, `144 items valid, ${checkRes.report.warnings.length} duplicate warnings flagged`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'albaha-guide-test-'));
  try {
    const mockActive = path.join(tmpDir, 'active.json');
    const mockBackup = path.join(tmpDir, 'backup.json');
    fs.copyFileSync(activePath, mockActive);
    const badFile = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(badFile, '{ bad json', 'utf8');
    const badRes = importGuideFile(badFile, { activePath: mockActive, backupPath: mockBackup });
    assert.equal(badRes.ok, false);
    assert.equal(badRes.activated, false);
    assert.equal(JSON.parse(fs.readFileSync(mockActive, 'utf8')).items.length, 144);

    const dupIdFile = path.join(tmpDir, 'dupid.json');
    fs.writeFileSync(
      dupIdFile,
      JSON.stringify({
        metadata: { title: 'bad' },
        items: [
          { id: 1, category_key: 'hotels_resorts', category_ar: 'فنادق', name: 'أ', governorate: 'العقيق' },
          { id: 1, category_key: 'hotels_resorts', category_ar: 'فنادق', name: 'ب', governorate: 'العقيق' },
        ],
      }),
      'utf8'
    );
    const dupRes = importGuideFile(dupIdFile, { activePath: mockActive, backupPath: mockBackup });
    assert.equal(dupRes.ok, false);
    assert.equal(JSON.parse(fs.readFileSync(mockActive, 'utf8')).items.length, 144);
    record('Corrupt & duplicate-ID import rollback protection', true, 'Last valid dataset preserved');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const envLocal = loadEnvLocal();
  const baseCtx = {
    days: null,
    style: null,
    region: 'all',
    pace: 'balanced',
    mode: null,
    place: null,
    activeStopId: null,
    activeGuideId: null,
    season: 'autumn',
    month: null,
    visitDay: null,
    visitDateLabel: null,
    startPoint: null,
    start: null,
    budget: null,
    returnByEnd: null,
    focus: null,
    locked: null,
    lockedIds: [],
    completedIds: [],
    excludedIds: [],
    lastGuideItemId: null,
    interests: [],
    withChildren: false,
    lessWalking: false,
    hasUnsavedPreview: false,
    pendingClarification: null,
    pendingTopic: null,
    lastPlan: null,
    previousPlan: null,
  };

  // -------------------------------------------------------------------------
  // 2) Live server WITH GEMINI_API_KEY from .env.local
  // -------------------------------------------------------------------------
  const portLive = 3091;
  const liveSrv = startNextServer(portLive, {
    GEMINI_API_KEY: envLocal.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
    GEMINI_MODEL: envLocal.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  });
  try {
    await waitForServer(`http://127.0.0.1:${portLive}/`);

    // T1: Cloud City Hotel lookup (live Gemini!)
    const t1 = await askApi(portLive, {
      question: 'وش عندك عن فندق مدينة السحاب؟',
      context: baseCtx,
    });
    assert.equal(t1.status, 200);
    assert.equal(t1.json.ok, true);
    const cloudCard = t1.json.reply.places.find((p) => p.id === 1);
    assert.ok(cloudCard, 'Expected Cloud City Hotel id=1');
    assert.equal(cloudCard.phones[0]?.telHref, 'tel:+966177230330');
    assert.equal(cloudCard.whatsappUrl, null, 'Cloud City Hotel must NOT have WhatsApp link');
    assert.ok(cloudCard.officialWebsite?.url?.includes('cloudcityhotels.com'));
    assert.ok(cloudCard.bookingLink?.url?.includes('almosafer.com'));
    assert.equal(cloudCard.internalHref, '#guide/place/hotels-02');
    assert.equal(t1.json.reply.retryable, false, 'Live Gemini call should succeed cleanly');
    record('T1: Hotel by name + live Gemini + strict phone/booking/no-WhatsApp', true, t1.json.reply.replyText.slice(0, 72));

    // T2: Explicit WhatsApp vs No-phone WhatsApp text
    const t2a = await askApi(portLive, { question: 'وش عندك عن أكواخ سار الريفية؟', context: baseCtx, skipLlm: true });
    const sarCard = t2a.json.reply.places.find((p) => p.id === 35);
    assert.ok(sarCard?.whatsappUrl?.includes('whatsapp.com'), 'Sar Cottages should have explicit WhatsApp URL');
    assert.equal(sarCard.officialWebsite, null, 'WhatsApp URL should not be mislabeled as officialWebsite');

    const t2b = await askApi(portLive, { question: 'وش عندك عن مطعم مكبوس زمان؟', context: baseCtx, skipLlm: true });
    const makbousCard = t2b.json.reply.places.find((p) => p.id === 55);
    assert.equal(makbousCard?.whatsappUrl, null, 'Makbous Zaman has no phone/URL so must NOT fabricate WhatsApp link');
    record('T2: Strict WhatsApp extraction rules (id=35 vs id=55)', true, 'WhatsApp shown ONLY when phone/URL explicitly provided');

    // T3: Price/availability follow-up
    const t3 = await askApi(portLive, {
      question: 'بكم الليلة وهل فيه غرف متاحة بكرة؟',
      context: t1.json.reply.context,
      history: [
        { role: 'user', text: 'وش عندك عن فندق مدينة السحاب؟' },
        { role: 'assistant', text: t1.json.reply.replyText },
      ],
    });
    assert.equal(t3.status, 200);
    assert.ok(t3.json.reply.places.some((p) => p.id === 1 && p.bookingLink));
    record('T3: Live price/availability redirects to booking/contact', true, t3.json.reply.replyText.slice(0, 72));

    // T4: Stay in Al-Aqiq (explicitly after previous place lookup context!)
    const t4 = await askApi(portLive, {
      question: 'أنا في العقيق، وين أقدر أبيت؟',
      context: t1.json.reply.context,
    });
    assert.equal(t4.status, 200);
    assert.ok(t4.json.reply.places.length >= 2, 'Expected multiple stays in Al-Aqiq');
    assert.ok(t4.json.reply.places.every((p) => p.governorate === 'العقيق'), 'Every recommendation must be in العقيق');
    assert.ok(
      t4.json.reply.places.every((p) => p.id !== 140 && /فنادق|منتجعات|إيواء|شاليه|فندق|فلل/.test(`${p.categoryLabel} ${p.type}`)),
      `Every stay recommendation must be accommodation (not airport): ${JSON.stringify(t4.json.reply.places.map((p) => ({ id: p.id, name: p.name, type: p.type })))}`
    );
    assert.ok(
      !/أي واحد فيهم تقصد/.test(t4.json.reply.replyText),
      `Area stay query must NOT trigger name disambiguation: ${t4.json.reply.replyText}`
    );
    assert.ok(t4.json.reply.places.every((p) => Boolean(p.image) && p.internalHref.startsWith('#guide/place/')));
    assert.ok(!t4.json.reply.actions.some((a) => a.autoExecute), 'Normal recommendations must NOT auto-navigate');
    record('T4: Stay in Al-Aqiq recommendations', true, `${t4.json.reply.places.length} العقيق stays (pure accommodation, images & internal links)`);

    // T5: 2-day family trip -> modify time -> swap first stop
    const t5a = await askApi(portLive, {
      question: 'رتّب لي يومين مع العيال',
      context: baseCtx,
    });
    assert.equal(t5a.status, 200);
    const it1 = t5a.json.reply.itinerary;
    assert.ok(it1, 'Expected structured itinerary');
    assert.equal(it1.days, 2);
    assert.equal(it1.groupedDays.length, 2, 'Both Day 1 and Day 2 must have stops');
    assert.equal(t5a.json.reply.context.withChildren, true);
    const firstStopIdBefore = it1.groupedDays[0].stops[0].stopId;
    const totalStopsBefore = it1.plan.ids.length;

    const t5b = await askApi(portLive, {
      question: 'خلّها من 8 الصبح',
      context: t5a.json.reply.context,
      history: [
        { role: 'user', text: 'رتّب لي يومين مع العيال' },
        { role: 'assistant', text: t5a.json.reply.replyText },
      ],
    });
    const it2 = t5b.json.reply.itinerary;
    assert.ok(it2, 'Expected modified itinerary');
    assert.equal(it2.days, 2, 'Days must stay 2 after time edit');
    assert.equal(it2.groupedDays.length, 2, 'Day grouping must stay 2 days');
    assert.equal(it2.startTime, '08:00', 'Start time must shift to 08:00');
    assert.equal(it2.plan.ids.length, totalStopsBefore, 'Stops must be preserved on time change');
    assert.equal(t5b.json.reply.context.withChildren, true, 'Family preference must be preserved');

    const t5c = await askApi(portLive, {
      question: 'بدّل أول محطة',
      context: t5b.json.reply.context,
      history: [
        { role: 'user', text: 'رتّب لي يومين مع العيال' },
        { role: 'assistant', text: t5a.json.reply.replyText },
        { role: 'user', text: 'خلّها من 8 الصبح' },
        { role: 'assistant', text: t5b.json.reply.replyText },
      ],
    });
    const it3 = t5c.json.reply.itinerary;
    assert.ok(it3, 'Expected swapped itinerary');
    assert.equal(it3.days, 2, 'Days must stay 2 after swap');
    assert.equal(it3.startTime, '08:00', 'Start time 08:00 must stay after swap');
    assert.notEqual(it3.groupedDays[0].stops[0].stopId, firstStopIdBefore, 'First stop must actually be swapped');
    record(
      'T5: 2-day family trip + time shift (08:00) + first-stop swap',
      true,
      `Swapped ${firstStopIdBefore} -> ${it3.groupedDays[0].stops[0].stopId}, kept 2 days & 08:00`
    );

    // T6: Explicit in-site navigation commands
    const t6a = await askApi(portLive, { question: 'ودّني للخريطة', context: baseCtx });
    assert.ok(t6a.json.reply.actions.some((a) => a.type === 'navigate_map' && a.autoExecute === true));

    const t6b = await askApi(portLive, { question: 'افتح قرية ذي عين', context: baseCtx });
    assert.ok(t6b.json.reply.actions.some((a) => a.type === 'navigate_place' && a.stopId === 'ain' && a.autoExecute === true));
    record('T6: Explicit navigation commands (map + Dhee Ain)', true, 'Validated autoExecute internal actions returned');

    // T7: Ambiguous similar names
    const t7 = await askApi(portLive, { question: 'وش عندك عن هيلز؟', context: baseCtx, skipLlm: true });
    assert.ok(t7.json.reply.places.length >= 2, 'Expected multiple matches for ambiguous "هيلز"');
    const govs = new Set(t7.json.reply.places.map((p) => p.governorate));
    assert.ok(govs.size >= 2, 'Ambiguous matches should clarify distinct governorates');
    record('T7: Ambiguous name clarification ("هيلز")', true, `Clarified across: ${[...govs].join(' / ')}`);

    // T8: Unconfirmed attribute honesty
    const t8 = await askApi(portLive, {
      question: 'هل فندق مدينة السحاب فيه مسبح؟',
      context: baseCtx,
      skipLlm: true,
    });
    assert.ok(/ما فيه تأكيد/.test(t8.json.reply.replyText), 'Must clearly state guide lacks confirmation for pool');
    record('T8: Missing-info honesty', true, 'Clearly disclosed unconfirmed attribute');

    // T8b: Weather-aware trip planning with forecast limits
    const t8b = await askApi(portLive, {
      question: 'رتّب لي يوم حسب الجو في الباحة',
      context: baseCtx,
      weather: {
        city: 'baha',
        cityName: 'مدينة الباحة',
        tempC: 21,
        conditionLabel: 'غائم جزئياً',
        isWet: false,
        forecastDaysAvailable: 3,
      },
      skipLlm: true,
    });
    assert.ok(t8b.json.reply.itinerary, 'Expected weather-aware itinerary');
    assert.ok(t8b.json.reply.itinerary.weatherNote, 'Expected weatherNote explaining forecast & its limits');
    assert.ok(/توقع|تتغير/.test(t8b.json.reply.itinerary.weatherNote), 'Weather note should state forecast limits');
    record('T8b: Weather-aware plan with forecast limits', true, t8b.json.reply.itinerary.weatherNote.slice(0, 72));

    // T8c: Conditional distance sorting (only when userLocation & coordinates exist)
    const t8cNoLoc = await askApi(portLive, {
      question: 'أقرب المنتزهات والغابات في الباحة',
      context: baseCtx,
      skipLlm: true,
    });
    assert.ok(
      t8cNoLoc.json.reply.places.every((p) => p.distanceKm === null),
      'Without userLocation, distanceKm must be null'
    );
    const t8cWithLoc = await askApi(portLive, {
      question: 'أقرب المنتزهات والغابات في الباحة',
      context: baseCtx,
      userLocation: { lat: 20.0129, lng: 41.4677 },
      skipLlm: true,
    });
    const dists = t8cWithLoc.json.reply.places.map((p) => p.distanceKm).filter((d) => typeof d === 'number');
    assert.ok(dists.length >= 1, 'With userLocation, coordinated places should compute distanceKm');
    for (let i = 1; i < dists.length; i += 1) {
      assert.ok(dists[i] >= dists[i - 1], 'Places with coordinates must be sorted ascending by distance');
    }
    record('T8c: Conditional distance sorting (only with userLocation + coords)', true, `Distances: ${dists.join(', ')} km`);
  } finally {
    await liveSrv.stop();
  }

  // -------------------------------------------------------------------------
  // 3) Server WITH MISSING GEMINI_API_KEY
  // -------------------------------------------------------------------------
  const portNoKey = 3092;
  const noKeySrv = startNextServer(portNoKey, { GEMINI_API_KEY: '' });
  try {
    await waitForServer(`http://127.0.0.1:${portNoKey}/`);
    const r = await askApi(portNoKey, {
      question: 'وش عندك عن فندق مدينة السحاب؟',
      context: baseCtx,
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(r.json.reply.places.some((p) => p.id === 1));
    assert.equal(r.json.reply.retryable, false);
    record('T9: Missing GEMINI_API_KEY graceful local reply (no provider leak)', true, 'Returned valid Cloud City Hotel card locally');
  } finally {
    await noKeySrv.stop();
  }

  // -------------------------------------------------------------------------
  // 4) Server WITH SIMULATED GEMINI CONNECTION FAILURE (retryable fallback)
  // -------------------------------------------------------------------------
  const portFail = 3093;
  const failSrv = startNextServer(portFail, {
    GEMINI_API_KEY: 'TEST_FAKE_KEY_FOR_FAILURE_SIMULATION',
    GEMINI_API_BASE_URL: 'http://127.0.0.1:1/unreachable',
  });
  try {
    await waitForServer(`http://127.0.0.1:${portFail}/`);
    const r1 = await askApi(portFail, {
      question: 'أنا في العقيق، وين أقدر أبيت؟',
      context: baseCtx,
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.ok, true);
    assert.equal(r1.json.reply.retryable, true, 'Upstream failure should mark retryable=true');
    assert.ok(r1.json.reply.places.length >= 2, 'Local grounded stays should still be shown on upstream failure');
    assert.ok(r1.json.reply.actions.some((a) => a.type === 'retry'), 'Retry action must be offered');

    const r2 = await askApi(portFail, {
      question: 'هل يوجد قطار مباشر من الرياض إلى الباحة؟',
      context: baseCtx,
    });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.reply.retryable, true);
    assert.ok(r2.json.reply.actions.some((a) => a.type === 'retry'));
    record('T10: Upstream connection failure -> local fallback + retryable + zero provider leak', true);
  } finally {
    await failSrv.stop();
  }

  // -------------------------------------------------------------------------
  // 5) Server WITH MOCK HALLUCINATING UPSTREAM (unauthorized IDs & provider leak)
  // -------------------------------------------------------------------------
  const mockLlmServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    replyText: 'توصية من Gemini 3.5 Flash: فندق مدينة السحاب خيار ممتاز في الباحة.',
                    placeIds: [99999, -5, 145, 77, 1],
                    placeReasons: [
                      { id: 99999, reason: 'مكان وهمي' },
                      { id: 1, reason: 'موقع مركزي في الباحة' },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      })
    );
  });
  await new Promise((resolve) => mockLlmServer.listen(0, '127.0.0.1', resolve));
  const mockAddr = mockLlmServer.address();
  const portGuard = 3094;
  const guardSrv = startNextServer(portGuard, {
    GEMINI_API_KEY: 'TEST_FAKE_KEY_FOR_GUARD_VERIFICATION',
    GEMINI_API_BASE_URL: `http://127.0.0.1:${mockAddr.port}/v1beta/models`,
  });
  try {
    await waitForServer(`http://127.0.0.1:${portGuard}/`);
    const rg = await askApi(portGuard, {
      question: 'وش عندك عن فندق مدينة السحاب؟',
      context: { ...baseCtx, activeStopId: 'unauthorized-stop-999' },
    });
    assert.equal(rg.status, 200);
    assert.deepEqual(rg.json.reply.placeIds, [1], 'Unauthorized/out-of-scope placeIds (99999, -5, 145, 77) MUST be rejected');
    assert.equal(rg.json.reply.places.length, 1);
    assert.equal(rg.json.reply.places[0].id, 1);
    assert.ok(!/gemini/i.test(rg.json.reply.replyText), 'Provider name leaked from upstream MUST be stripped');
    assert.ok(
      rg.json.reply.actions.every((a) => a.stopId !== 'unauthorized-stop-999'),
      'Unauthorized stopId MUST never appear in actions'
    );
    record('T11: Hallucinated/unauthorized placeIds & provider leak rejected strictly', true, `Kept only validated placeIds=${JSON.stringify(rg.json.reply.placeIds)}`);
  } finally {
    await guardSrv.stop();
    await new Promise((resolve) => mockLlmServer.close(resolve));
  }

  console.log('\n========================================');
  console.log(`ALL ${results.length}/${results.length} SMART GUIDE TESTS PASSED!`);
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
