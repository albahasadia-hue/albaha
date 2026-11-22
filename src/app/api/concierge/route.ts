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

const ALBAHA_REGIONAL_OVERVIEW = [
  'حقائق مرجعية عامة عن منطقة الباحة (للمحادثة الطبيعية والإرشاد العام):',
  '- تنقسم الباحة إلى قطاع السراة الجبلي المرتفع المعتدل والبارد صيفاً (مدينة الباحة، بلجرشي، المندق، القرى، بني حسن) وقطاع تهامة الدافئ شتاءً (المخواة، قلوة، غامد الزناد، الحجرة)، إضافة إلى محافظة العقيق في البادية حيث يقع مطار الملك سعود بن عبدالعزيز الإقليمي (ABT).',
  '- يربط السراة بتهامة طرق وعقبات جبلية أشهرها عقبة الملك فهد (الباحة – المخواة)، ويُنصح فيها بالقيادة الهادئة وفحص الفرامل خاصة عند الضباب أو المطر.',
  '- أشهر أكلات ومنتجات الباحة: الدغابيس، العصيدة، الخبزة المقناة، العريكة، عسل السدر، البن الشدوي، الرمان والعنب والفواكه الموسمية.',
  '- أبرز المعالم: غابة رغدان، قرية ذي عين التراثية (المخواة)، متنزه الأمير حسام، جبل شدا، غابة خيرة وشلالاتها، ومتنزه الخلب (المندق).',
].join('\n');

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

  const contextHints: string[] = [];
  if (turn.unconfirmedTopic) {
    contextHints.push(
      `ملاحظة مهمة: الزائر يسأل عن «${turn.unconfirmedTopic}»، وهذه المعلومة غير مؤكدة في سجل المكان بالدليل؛ اذكر بوضوح «الدليل ما فيه تأكيد عنها حالياً» ووجّهه للتواصل المباشر مع المكان.`
    );
  }
  if (turn.referenceFact) {
    contextHints.push(`ملاحظة سياقية: ${turn.referenceFact}`);
  }
  if (turn.intentKind === 'trip_modify_time') {
    contextHints.push('تم تعديل وقت بداية البرنامج مع الحفاظ على بقية أيام ومحطات الرحلة كما في برنامج الرحلة المعتمد أدناه.');
  } else if (turn.intentKind === 'trip_swap_stop') {
    contextHints.push('تم تبديل المحطة المطلوبة مع الحفاظ على بقية أيام ومواعيد الرحلة كما في برنامج الرحلة المعتمد أدناه.');
  }

  return [
    'أنت «المرشد الذكي»، مساعد محادثة حي وذكي داخل الموقع الرسمي لمنطقة الباحة.',
    'أسلوبك وتفاعلك:',
    '- تفاعل مع الزائر كمحاور طبيعي وذكي يفهم كلامه وسياق المحادثة السابقة بأي لهجة عربية (سعودية، مصرية، شامية، خليجية، فصحى) أو إنجليزية، ورد عليه دائماً بلهجة سعودية خفيفة ودودة ومتنوعة وطبيعية بعيداً عن القوالب الجامدة أو الردود المحفوظة المتكررة.',
    '- اضبط طول الرد ونبرته حسب رسالة الزائر: لو سلّم أو شكر ردّ عليه بعفوية ولطف؛ لو سأل سؤالاً مفتوحاً أو طلب رأياً أو مقارنة أو نصيحة سفر تحاور معه بذكاء ومرونة واسأله سؤال متابعة لطيف عند اللزوم؛ ولو عُرضت تحته بطاقات أماكن أو برنامج رحلة فاجعل كلامك تمهيداً طبيعياً ومختصراً لا يكرر كل ما في البطاقات حرفياً.',
    '- تجنب التنسيق الثقيل (مثل النجوم الكثيرة أو العناوين الطويلة) واكتب بنص عربي سلس ومريح للقراءة.',
    'قواعد الدقة والالتزام بالبيانات:',
    '1. فيما يخص أسماء الأماكن المحددة (فنادق، شاليهات، مطاعم، مقاهي، معالم) وأرقام الهواتف والروابط والتقييمات والأسعار: اعتمد فقط على السجلات المسترجعة أدناه ولا تخترع أي مكان أو رقم أو رابط أو سعر غير موجود فيها.',
    '2. إذا سأل الزائر عن تفصيل محدد لمكان معين غير موجود في سجله (مثل وجود مسبح أو إفطار مجاني أو ساعات عمل دقيقة أو رسوم دخول غير مذكورة)، قل بوضوح إن الدليل ما فيه تأكيد عنها حالياً ووجّهه للتأكد عبر التواصل المباشر أو رابط الحجز المتاح.',
    '3. إذا سأل عن السعر الحالي أو التوفر اللحظي للغرف، وضّح أن الأسعار والتوفر تتغير ووجّهه لرابط الحجز أو وسيلة التواصل المتاحة.',
    '4. لا تذكر وجود واتساب لأي مكان إلا إذا كان hasWhatsApp يساوي true في سجله.',
    '5. عند الترشيح حسب منطقة أو مقارنة أماكن، اذكر المحافظة بوضوح وسبب اختيارك.',
    '6. في حقل placeIds: أرجع فقط معرّفات id الموجودة فعلاً في السجلات المسترجعة أدناه (بحد أقصى 4) والتي تفيد الزائر في هذه الرسالة بالذات. إذا كانت الرسالة مجرد تحية أو شكر أو دردشة عامة أو استفسار لا يحتاج عرض بطاقات أماكن الآن، أرجع placeIds كمصفوفة فارغة [].',
    '7. إذا كان هناك برنامج رحلة معتمد (itinerary)، قدّمه بأسلوب طبيعي ومختصر واذكر التعديل الذي تم إن وجد دون سرد كل البطاقات من جديد لأنها ستظهر منظمة أسفل ردك.',
    '8. لا تذكر أبداً اسم أي مزوّد ذكاء اصطناعي أو نموذج أو مفتاح برمجي.',
    ALBAHA_REGIONAL_OVERVIEW,
    contextHints.length ? contextHints.join('\n') : '',
    `السجلات المسترجعة من دليل الباحة (أحدث بحث + الأماكن التي ذُكرت في المحادثة):\n${retrievedJson}`,
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
    .slice(-10)
    .map((h) => ({
      role: (h.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: h.text.trim().slice(0, 600) }],
    }));

  const currentQuestion = (payload.question || payload.intent || '').trim();
  if (
    currentQuestion &&
    (recent.length === 0 || recent[recent.length - 1].role !== 'user' || recent[recent.length - 1].parts[0].text !== currentQuestion)
  ) {
    recent.push({ role: 'user', parts: [{ text: currentQuestion.slice(0, 600) }] });
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
      temperature: 0.65,
      maxOutputTokens: 900,
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
        signal: AbortSignal.timeout(11000),
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

  // For conversational intents (greeting / general / discovery), respect Gemini's choice even when placeIds is []
  const mustShowCardOnFallback =
    turn.intentKind === 'place_detail' ||
    turn.intentKind === 'place_ambiguous' ||
    turn.intentKind === 'price_or_availability' ||
    turn.intentKind === 'area_recommendation' ||
    turn.intentKind === 'missing_info';

  const finalPlaceIds = scopedLlmIds.length
    ? scopedLlmIds.slice(0, 4)
    : mustShowCardOnFallback
      ? base.placeIds
      : [];

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

  const nextContext = {
    ...base.context,
    recentPlaceIds: hydratedPlaces.length
      ? hydratedPlaces.map((c) => c.id)
      : base.context.recentPlaceIds || [],
    lastGuideItemId:
      hydratedPlaces.length === 1 ? hydratedPlaces[0].id : base.context.lastGuideItemId,
  };

  const { validActions } = validateGuideActions(base.actions);

  return {
    ...base,
    replyText,
    placeIds: hydratedPlaces.map((c) => c.id),
    places: hydratedPlaces,
    actions: validActions,
    context: nextContext,
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
