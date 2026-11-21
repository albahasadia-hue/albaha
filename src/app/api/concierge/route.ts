import { NextRequest, NextResponse } from 'next/server';
import {
  runSmartGuideTurn,
  serializeRetrievedRecordsForLlm,
  type SmartGuideTurnComputation,
} from '@/lib/smartGuideEngine';
import {
  hydratePlaceCard,
  sanitizeVisitorFacingText,
  validateGuideActions,
  validatePlaceIds,
  type SmartGuidePlaceCard,
  type SmartGuideRequestPayload,
  type SmartGuideResponseContract,
} from '@/lib/smartGuideContract';
import { getGuide144ById } from '@/lib/guideCatalog144';

export const runtime = 'nodejs';

interface GeminiStructuredOutput {
  replyText?: string;
  placeIds?: number[];
  placeReasons?: Array<{ id?: number; reason?: string }>;
}

function buildSystemInstruction(turn: SmartGuideTurnComputation, payload: SmartGuideRequestPayload): string {
  const retrievedJson = serializeRetrievedRecordsForLlm(turn.retrievedItems);
  const itinerarySummary = turn.response.itinerary
    ? JSON.stringify({
        title: turn.response.itinerary.title,
        days: turn.response.itinerary.days,
        startTime: turn.response.itinerary.startTime,
        weatherNote: turn.response.itinerary.weatherNote || null,
        groupedDays: turn.response.itinerary.groupedDays.map((d) => ({
          day: d.day,
          label: d.label,
          stops: d.stops.map((s) => `${s.name} (${s.startTime}-${s.endTime})`),
        })),
      })
    : null;

  const weatherSummary = payload.weather
    ? JSON.stringify({
        city: payload.weather.cityName || payload.weather.city,
        tempC: payload.weather.tempC,
        condition: payload.weather.conditionLabel,
        isWet: payload.weather.isWet,
      })
    : null;

  return [
    'أنت «المرشد الذكي» داخل الموقع الرسمي لمنطقة الباحة.',
    'افهم سؤال الزائر بأي لهجة عربية أو إنجليزية، ورد عليه دائماً باللهجة السعودية الخفيفة واللطيفة والواضحة (بحد أقصى 3 إلى 4 جمل قصيرة ومفيدة، بدون حشو أو تنسيق ماركداون ثقيل).',
    'قواعد صارمة لا يجوز مخالفتها:',
    '1. اعتمد فقط على السجلات المسترجعة والبيانات المرجعية أدناه. لا تخترع أي مكان أو رقم هاتف أو رابط أو ساعات عمل أو سعر غير موجود.',
    '2. إذا نقصت معلومة في السجلات (مثل وجود مسبح أو رسوم أو مواعيد غير مذكورة)، قل بوضوح: «الدليل ما فيه تأكيد عنها حالياً» ووجّه الزائر للتواصل المباشر أو رابط الحجز إن وُجد.',
    '3. إذا سأل الزائر عن السعر الحالي أو التوفر اللحظي، وضّح أن الأسعار والتوفر تتغير ووجّهه لرابط الحجز أو وسيلة التواصل المتاحة.',
    '4. لا تذكر وجود واتساب لأي مكان إلا إذا كان hasWhatsApp يساوي true في السجل.',
    '5. عند الترشيح حسب منطقة، اذكر المحافظة بوضوح وسبب مختصر لكل ترشيح.',
    '6. في placeIds، أرجع فقط معرّفات id الصحيحة من السجلات المسترجعة أدناه (بحد أقصى 4)، ولا تخترع أي id غير موجود. إذا كان هناك برنامج رحلة itinerary، أبقِ الرد مختصراً يقدّم البرنامج ويشرح التعديل الذي تم دون تكرار كل التفاصيل الطويلة.',
    '7. لا تذكر أبداً اسم أي مزوّد ذكاء اصطناعي أو نموذج أو مفتاح برمجي.',
    `نوع الطلب المحلي: ${turn.intentKind}`,
    `المسودة المرجعية للرد: ${turn.response.replyText}`,
    `السجلات المسترجعة من الدليل:\n${retrievedJson}`,
    itinerarySummary ? `برنامج الرحلة المعتمد:\n${itinerarySummary}` : '',
    weatherSummary ? `بيانات الطقس المتاحة:\n${weatherSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildGeminiContents(payload: SmartGuideRequestPayload): Array<{
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}> {
  const recent = (payload.history || [])
    .filter((h) => h && typeof h.text === 'string' && h.text.trim())
    .slice(-6)
    .map((h) => ({
      role: (h.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: h.text.trim().slice(0, 420) }],
    }));

  const currentQuestion = (payload.question || payload.intent || '').trim();
  if (
    currentQuestion &&
    (recent.length === 0 || recent[recent.length - 1].role !== 'user' || recent[recent.length - 1].parts[0].text !== currentQuestion)
  ) {
    recent.push({ role: 'user', parts: [{ text: currentQuestion.slice(0, 420) }] });
  }
  return recent.length ? recent : [{ role: 'user', parts: [{ text: 'ساعدني في استكشاف الباحة' }] }];
}

function getCandidateModels(): string[] {
  const primary = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  const fallbacks = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
  return [...new Set([primary, ...fallbacks].filter(Boolean))];
}

async function callGeminiStructured(
  apiKey: string,
  turn: SmartGuideTurnComputation,
  payload: SmartGuideRequestPayload
): Promise<{ ok: true; data: GeminiStructuredOutput } | { ok: false; status: number; reason: string }> {
  const models = getCandidateModels();
  const baseUrl = (
    process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models'
  ).replace(/\/+$/, '');

  const systemInstruction = buildSystemInstruction(turn, payload);
  const contents = buildGeminiContents(payload);

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 420,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          replyText: { type: 'STRING' },
          placeIds: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
          },
          placeReasons: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'INTEGER' },
                reason: { type: 'STRING' },
              },
              required: ['id', 'reason'],
            },
          },
        },
        required: ['replyText', 'placeIds'],
      },
    },
  });

  let lastStatus = 503;
  let lastReason = 'upstream_unavailable';

  for (const model of models) {
    const endpoint = `${baseUrl}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(7500),
        body: requestBody,
      });

      if (!res.ok) {
        lastStatus = res.status;
        lastReason = `status_${res.status}`;
        // Retry next model only on 404 (deprecated/unavailable model) or 503 (high demand)
        if (res.status === 404 || res.status === 503) {
          continue;
        }
        // On 400/401/403/429 stop immediately and fall back gracefully
        return { ok: false, status: res.status, reason: lastReason };
      }

      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!rawText) {
        lastStatus = 502;
        lastReason = 'empty_candidate';
        continue;
      }

      const parsed = JSON.parse(rawText) as GeminiStructuredOutput;
      if (parsed && typeof parsed.replyText === 'string' && parsed.replyText.trim()) {
        return { ok: true, data: parsed };
      }
      lastStatus = 502;
      lastReason = 'invalid_schema';
    } catch {
      lastStatus = 504;
      lastReason = 'network_or_timeout';
      continue;
    }
  }

  return { ok: false, status: lastStatus, reason: lastReason };
}

function mergeValidatedLlmResult(
  turn: SmartGuideTurnComputation,
  llm: GeminiStructuredOutput
): SmartGuideResponseContract {
  const base = turn.response;
  const replyText = sanitizeVisitorFacingText(llm.replyText || base.replyText) || base.replyText;

  // Validate placeIds strictly against active albaha_guide_144 catalog AND retrieved scope
  const retrievedSet = new Set(turn.retrievedItems.map((it) => it.id));
  const { validIds: llmValidIds } = validatePlaceIds(llm.placeIds);
  const scopedLlmIds = llmValidIds.filter((id) => retrievedSet.has(id));

  // If itinerary response, keep places empty (stops live inside itinerary.groupedDays)
  if (base.itinerary) {
    const { validActions } = validateGuideActions(base.actions);
    return {
      ...base,
      replyText,
      actions: validActions,
    };
  }

  const finalPlaceIds = scopedLlmIds.length ? scopedLlmIds.slice(0, 4) : base.placeIds;
  const reasonById = new Map<number, string>();
  if (Array.isArray(llm.placeReasons)) {
    for (const entry of llm.placeReasons) {
      if (entry && Number.isInteger(entry.id) && typeof entry.reason === 'string' && entry.reason.trim()) {
        reasonById.set(entry.id!, sanitizeVisitorFacingText(entry.reason).slice(0, 110));
      }
    }
  }

  const baseCardById = new Map<number, SmartGuidePlaceCard>(base.places.map((c) => [c.id, c]));
  const hydratedPlaces: SmartGuidePlaceCard[] = finalPlaceIds
    .map((id) => {
      const existing = baseCardById.get(id);
      const llmReason = reasonById.get(id);
      if (existing) {
        return llmReason ? { ...existing, reason: llmReason } : existing;
      }
      const catalogItem = getGuide144ById(id);
      return catalogItem ? hydratePlaceCard(catalogItem, { reason: llmReason }) : null;
    })
    .filter((c): c is SmartGuidePlaceCard => Boolean(c));

  const { validActions } = validateGuideActions(base.actions);

  return {
    ...base,
    replyText,
    placeIds: hydratedPlaces.map((c) => c.id),
    places: hydratedPlaces,
    actions: validActions,
  };
}

export async function POST(req: NextRequest) {
  let body: SmartGuideRequestPayload;
  try {
    body = (await req.json()) as SmartGuideRequestPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'تعذّر قراءة الطلب. جرّب تكتب سؤالك من جديد.',
      },
      { status: 400 }
    );
  }

  const turn = runSmartGuideTurn(body);
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  // Fast deterministic path for greetings and explicit navigation commands (no LLM latency needed)
  if (turn.usePreauthoredOnly || body.skipLlm || !apiKey) {
    const { validActions } = validateGuideActions(turn.response.actions);
    const { validIds } = validatePlaceIds(turn.response.placeIds);
    const cleanReply: SmartGuideResponseContract = {
      ...turn.response,
      replyText: sanitizeVisitorFacingText(turn.response.replyText),
      placeIds: validIds,
      actions: validActions,
      retryable: false,
    };
    return NextResponse.json({
      ok: true,
      reply: cleanReply,
    });
  }

  const llmResult = await callGeminiStructured(apiKey, turn, body);
  if (llmResult.ok) {
    const merged = mergeValidatedLlmResult(turn, llmResult.data);
    return NextResponse.json({
      ok: true,
      reply: {
        ...merged,
        retryable: false,
      },
    });
  }

  // Graceful fallback when Gemini connection fails or quota is exhausted:
  // - Never expose provider/key details to visitor
  // - Serve grounded local answer if available, and mark retryable so visitor can retry if needed
  const hasUsefulLocalData =
    turn.response.places.length > 0 ||
    Boolean(turn.response.itinerary) ||
    turn.intentKind === 'discovery_or_prep';

  const fallbackText = hasUsefulLocalData
    ? sanitizeVisitorFacingText(turn.response.replyText)
    : 'تعذّر تجهيز الرد الآن. تقدر تعيد المحاولة أو تسألني عن أي مكان أو رحلة في الباحة.';

  const fallbackActions = hasUsefulLocalData
    ? [...turn.response.actions, { type: 'retry' as const, label: 'إعادة المحاولة' }]
    : [{ type: 'retry' as const, label: 'إعادة المحاولة', primary: true }];

  const { validActions } = validateGuideActions(fallbackActions);
  const { validIds } = validatePlaceIds(turn.response.placeIds);

  const fallbackReply: SmartGuideResponseContract = {
    ...turn.response,
    replyText: fallbackText,
    placeIds: validIds,
    actions: validActions,
    retryable: true,
  };

  return NextResponse.json({
    ok: true,
    reply: fallbackReply,
  });
}
