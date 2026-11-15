import { NextRequest, NextResponse } from 'next/server';
import {
  CONCIERGE_FAILURE_NOTICE,
  runGroundedPlannerTurn,
  type ServerConciergeRequestPayload,
} from '@/lib/plannerTools';
import type { ConciergeReply } from '@/lib/portalTypes';

export const runtime = 'nodejs';

function buildSystemPrompt(reply: ConciergeReply): string {
  return [
    'أنت «المرشد السياحي الذكي» في البوابة الرسمية لمنطقة الباحة.',
    'التزم الصرامة بالحقائق والأوقات والمسافات التالية دون أي اختراع لأرقام أو مواعيد غير موجودة:',
    `النص المرجعي المعتمد: ${reply.text}`,
    reply.plan
      ? `المحطات المجدولة: ${reply.items?.map((i) => `${i.title} (${i.time || ''} - ${i.transfer || ''})`).join(' | ')}`
      : '',
    'أعد صياغة الرد بالعربية الفصيحة الواضحة والمختصرة بحد أقصى 4 أسطر، مع ذكر الملاحظات والتحذيرات إن وُجدت كما هي.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function refineWithGemini(
  apiKey: string,
  question: string,
  grounded: ConciergeReply
): Promise<string | null> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(6500),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(grounded) }] },
      contents: [{ role: 'user', parts: [{ text: question || 'لخص الاقتراح المعتمد' }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 320 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini status ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return text || null;
}

async function refineWithOpenAI(
  apiKey: string,
  question: string,
  grounded: ConciergeReply
): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(6500),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        { role: 'system', content: buildSystemPrompt(grounded) },
        { role: 'user', content: question || 'لخص الاقتراح المعتمد' },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI status ${res.status}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || null;
}

export async function POST(req: NextRequest) {
  let body: ServerConciergeRequestPayload;
  try {
    body = (await req.json()) as ServerConciergeRequestPayload;
  } catch {
    return NextResponse.json({ error: CONCIERGE_FAILURE_NOTICE }, { status: 400 });
  }

  const grounded = runGroundedPlannerTurn(body);
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';

  if (geminiKey || openaiKey) {
    try {
      const question = (body.question || body.intent || '').trim();
      const refined = geminiKey
        ? await refineWithGemini(geminiKey, question, grounded)
        : await refineWithOpenAI(openaiKey, question, grounded);

      const liveReply: ConciergeReply = {
        ...grounded,
        text: refined || grounded.text,
        sourceMode: 'live',
      };
      return NextResponse.json({
        ok: true,
        mode: 'live',
        reply: liveReply,
      });
    } catch {
      return NextResponse.json(
        {
          ok: false,
          mode: 'live',
          error: CONCIERGE_FAILURE_NOTICE,
        },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    mode: 'demo',
    reply: {
      ...grounded,
      sourceMode: 'demo',
    },
  });
}
