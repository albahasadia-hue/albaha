import { APPROVED_GUIDE_GREETING } from './plannerTools';
import type { GuideCharacterPose } from '@/components/common/GuideCharacter';

export type VoiceUiState = 'idle' | 'speaking' | 'listening' | 'muted' | 'mic-denied';

export interface GuideVoiceControllerOptions {
  signal: AbortSignal;
  onPoseChange: (pose: GuideCharacterPose) => void;
  onTranscript: (text: string) => void;
  onStateChange?: (state: VoiceUiState, subtitle: string) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface GuideVoiceController {
  handlePanelOpened: () => void;
  speak: (text: string, onComplete?: () => void) => void;
  stopSpeaking: () => void;
  startListening: (opts?: { autoAfterSpeech?: boolean }) => void;
  stopListening: () => void;
  toggleMute: () => boolean;
  isMuted: () => boolean;
  isListening: () => boolean;
  getState: () => VoiceUiState;
  getLastSpoken: () => string;
  destroy: () => void;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function pickArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith('ar-sa')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('ar')) ||
      null
    );
  } catch {
    return null;
  }
}

export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .replace(/[•|←→]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createGuideVoiceController(
  opts: GuideVoiceControllerOptions
): GuideVoiceController {
  let muted = false;
  let speaking = false;
  let listening = false;
  let micDenied = false;
  let greetedOnce = false;
  let currentState: VoiceUiState = 'idle';
  let lastSpoken = '';
  let recognition: SpeechRecognitionLike | null = null;
  let speakFallbackTimer = 0;
  let speakGen = 0;

  const bannerEl = () => document.getElementById('conciergeVoiceBanner');
  const subtitleEl = () => document.getElementById('conciergeVoiceSubtitle');
  const stateEl = () => document.getElementById('conciergeVoiceState');
  const stopBtnEl = () => document.getElementById('conciergeVoiceStop') as HTMLButtonElement | null;
  const micBtnEl = () => document.getElementById('conciergeMicBtn') as HTMLButtonElement | null;
  const muteBtnEl = () => document.getElementById('conciergeMuteBtn') as HTMLButtonElement | null;
  const muteIconUseEl = () => document.getElementById('conciergeMuteIcon');
  const agentPanelEl = () => document.getElementById('agentPanel');

  function syncDom(subtitleText?: string): void {
    const banner = bannerEl();
    const sub = subtitleEl();
    const pill = stateEl();
    const stopBtn = stopBtnEl();
    const micBtn = micBtnEl();
    const muteBtn = muteBtnEl();
    const muteIcon = muteIconUseEl();
    const panel = agentPanelEl();

    if (panel) {
      panel.setAttribute('data-voice-state', currentState);
      if (lastSpoken) panel.setAttribute('data-last-spoken', lastSpoken);
    }

    if (sub && typeof subtitleText === 'string') {
      sub.textContent = subtitleText;
    }

    const showBanner = Boolean(
      (sub?.textContent?.trim()) ||
        currentState !== 'idle' ||
        muted ||
        micDenied
    );
    if (banner) banner.hidden = !showBanner;

    if (pill) {
      pill.textContent =
        currentState === 'listening'
          ? 'يستمع لك الآن'
          : currentState === 'speaking'
            ? 'يتحدث الآن'
            : currentState === 'muted'
              ? 'الصوت مكتوم'
              : currentState === 'mic-denied'
                ? 'كتابة متاحة'
                : 'جاهز بالصوت';
    }

    if (stopBtn) {
      stopBtn.hidden = !listening;
    }
    if (micBtn) {
      micBtn.setAttribute('aria-pressed', String(listening));
      micBtn.classList.toggle('is-listening', listening);
    }
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.setAttribute('aria-label', muted ? 'تفعيل الصوت' : 'كتم الصوت');
      muteBtn.setAttribute('title', muted ? 'تفعيل الصوت' : 'كتم الصوت');
    }
    if (muteIcon) {
      muteIcon.setAttribute('href', muted ? '#i-volume-off' : '#i-volume');
    }

    if (currentState === 'listening') opts.onPoseChange('listening');
    else if (currentState === 'speaking') opts.onPoseChange('speaking');
    else opts.onPoseChange('idle');

    opts.onStateChange?.(currentState, sub?.textContent || '');
  }

  function clearSpeakTimer(): void {
    if (speakFallbackTimer) {
      window.clearTimeout(speakFallbackTimer);
      speakFallbackTimer = 0;
    }
  }

  function stopSpeaking(): void {
    speakGen += 1;
    clearSpeakTimer();
    speaking = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore TTS cancel errors on locked contexts
      }
    }
    if (!listening) {
      currentState = muted ? 'muted' : micDenied ? 'mic-denied' : 'idle';
      syncDom();
    }
  }

  function stopListening(): void {
    listening = false;
    if (recognition) {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // Ignore recognition cleanup errors
        }
      }
      recognition = null;
    }
    if (!speaking) {
      currentState = muted ? 'muted' : micDenied ? 'mic-denied' : 'idle';
      syncDom();
    }
  }

  function speak(rawText: string, onComplete?: () => void): void {
    const clean = cleanTextForSpeech(rawText);
    if (!clean) {
      onComplete?.();
      return;
    }
    stopListening();
    stopSpeaking();

    const myGen = ++speakGen;
    lastSpoken = clean;
    speaking = true;
    currentState = muted ? 'muted' : 'speaking';
    syncDom(clean);

    const finish = () => {
      if (myGen !== speakGen || opts.signal.aborted) return;
      clearSpeakTimer();
      speaking = false;
      currentState = muted ? 'muted' : micDenied ? 'mic-denied' : 'idle';
      syncDom();
      onComplete?.();
    };

    if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      speakFallbackTimer = window.setTimeout(finish, muted ? 120 : 650);
      return;
    }

    try {
      const voices = window.speechSynthesis.getVoices();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'ar-SA';
      const arVoice = pickArabicVoice();
      if (arVoice) utterance.voice = arVoice;
      utterance.rate = 1.02;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);

      // Headless browsers often report 0 voices and never emit SpeechSynthesis onend
      const fallbackMs = voices.length === 0 ? 750 : Math.min(9000, Math.max(2400, clean.length * 65));
      speakFallbackTimer = window.setTimeout(finish, fallbackMs);
    } catch {
      speakFallbackTimer = window.setTimeout(finish, 450);
    }
  }

  function startListening(listenOpts?: { autoAfterSpeech?: boolean }): void {
    if (opts.signal.aborted) return;
    if (muted && listenOpts?.autoAfterSpeech) return;
    stopSpeaking();

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      micDenied = true;
      listening = false;
      currentState = 'mic-denied';
      syncDom('تعذّر استخدام الميكروفون على هذا المتصفح؛ يمكنك متابعة المحادثة بالكتابة أدناه.');
      if (!listenOpts?.autoAfterSpeech) {
        (document.getElementById('conciergeInput') as HTMLInputElement | null)?.focus();
      }
      return;
    }

    stopListening();
    try {
      const rec = new Ctor();
      rec.lang = 'ar-SA';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      recognition = rec;
      listening = true;
      currentState = 'listening';
      syncDom('مستمع لك الآن… تكلّم بطلبك');

      let finalCaptured = '';

      rec.onresult = (event) => {
        if (opts.signal.aborted || recognition !== rec) return;
        let interim = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          const text = item?.[0]?.transcript || '';
          if (item?.isFinal) finalCaptured = text.trim();
          else interim += text;
        }
        syncDom(finalCaptured || interim || 'مستمع لك الآن…');
        if (finalCaptured) {
          const captured = finalCaptured;
          stopListening();
          opts.onTranscript(captured);
        }
      };

      rec.onerror = (err) => {
        if (opts.signal.aborted || recognition !== rec) return;
        const code = err?.error || '';
        listening = false;
        recognition = null;
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          micDenied = true;
          currentState = 'mic-denied';
          syncDom('تعذّر الوصول إلى الميكروفون؛ يمكنك متابعة المحادثة بالكتابة أدناه.');
          (document.getElementById('conciergeInput') as HTMLInputElement | null)?.focus();
        } else {
          currentState = muted ? 'muted' : 'idle';
          syncDom('لم يتم التقاط صوت واضح؛ يمكنك المحاولة مجددًا أو الكتابة أدناه.');
        }
      };

      rec.onend = () => {
        if (recognition === rec) {
          listening = false;
          recognition = null;
          if (!speaking) {
            currentState = muted ? 'muted' : micDenied ? 'mic-denied' : 'idle';
            syncDom();
          }
        }
      };

      rec.start();
    } catch {
      micDenied = true;
      listening = false;
      recognition = null;
      currentState = 'mic-denied';
      syncDom('تعذّر تشغيل الميكروفون؛ يمكنك متابعة المحادثة بالكتابة أدناه.');
      (document.getElementById('conciergeInput') as HTMLInputElement | null)?.focus();
    }
  }

  function toggleMute(): boolean {
    muted = !muted;
    if (muted) {
      stopSpeaking();
      stopListening();
      currentState = 'muted';
      syncDom('تم كتم الصوت مؤقتًا؛ الردود النصية مستمرة.');
    } else {
      currentState = micDenied ? 'mic-denied' : 'idle';
      syncDom('تم تفعيل الصوت.');
    }
    return muted;
  }

  function handlePanelOpened(): void {
    if (greetedOnce) {
      syncDom();
      return;
    }
    greetedOnce = true;
    speak(APPROVED_GUIDE_GREETING, () => {
      if (!muted && !opts.signal.aborted) {
        const panel = agentPanelEl() as HTMLDialogElement | null;
        if (panel?.open && !micDenied) {
          startListening({ autoAfterSpeech: true });
        }
      }
    });
  }

  opts.signal.addEventListener(
    'abort',
    () => {
      stopSpeaking();
      stopListening();
    },
    { once: true }
  );

  return {
    handlePanelOpened,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    toggleMute,
    isMuted: () => muted,
    isListening: () => listening,
    getState: () => currentState,
    getLastSpoken: () => lastSpoken,
    destroy: () => {
      stopSpeaking();
      stopListening();
    },
  };
}
