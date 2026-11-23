import { renderGuideCharacterSvg, type GuideCharacterPose } from '@/components/common/GuideCharacter';
import type { MapLibreMapInstance } from './portalTypes';
import { byId, isMotionPaused } from './portalHelpers';
import { SMART_GUIDE_NAME } from './smartGuideName';

export interface DockMapOptions {
  stopId: string;
  stopName: string;
  message: string;
  isExploration: boolean;
  onResume: () => void;
  onVoiceAsk?: () => void;
  onDismiss: () => void;
}

export interface DockGuideOptions {
  guideId: string;
  name: string;
  message: string;
  missingCoordinates?: boolean;
  onResume: () => void;
  onRetry?: () => void;
  onDismiss: () => void;
}

let activeDockMode: 'floating' | 'dialog' | 'docked-map' | 'docked-guide' = 'floating';
let lastPose: GuideCharacterPose = 'idle';

export function getPresenceMode(): typeof activeDockMode {
  return activeDockMode;
}

export function announceToScreenReader(message: string): void {
  const region = byId('conciergeLiveRegion');
  if (!region || !message) return;
  region.textContent = '';
  window.requestAnimationFrame(() => {
    if (region) region.textContent = message;
  });
}

export function setActiveCharacterPose(pose: GuideCharacterPose): void {
  lastPose = pose;
  document.querySelectorAll<SVGElement>('.guide-character-svg').forEach((svg) => {
    svg.setAttribute('data-pose', pose);
  });
}

export function syncSingleAvatarPresence(
  mode: 'floating' | 'dialog' | 'docked-map' | 'docked-guide'
): void {
  activeDockMode = mode;
  const launcher = byId<HTMLButtonElement>('sirajLauncher');
  const mapDock = byId<HTMLElement>('conciergeMapDock');
  const guideDock = byId<HTMLElement>('conciergeGuideDock');

  document.body.classList.toggle('guide-char-docked', mode === 'docked-map' || mode === 'docked-guide');
  if (launcher) {
    launcher.hidden = mode !== 'floating';
  }
  if (mapDock && mode !== 'docked-map') {
    mapDock.hidden = true;
    mapDock.replaceChildren();
  }
  if (guideDock && mode !== 'docked-guide') {
    guideDock.remove();
  }
}

export async function waitForMapReady(opts: {
  mapPanel: HTMLElement | null;
  streetMapActive: boolean;
  liveMap: { map: MapLibreMapInstance } | null;
  signal: AbortSignal;
}): Promise<void> {
  if (opts.signal.aborted) return;
  const panel = opts.mapPanel;
  if (panel && panel.clientWidth === 0) {
    await new Promise<void>((resolve) => {
      const raf = window.requestAnimationFrame(() => resolve());
      opts.signal.addEventListener('abort', () => {
        window.cancelAnimationFrame(raf);
        resolve();
      }, { once: true });
    });
  }
  if (!opts.streetMapActive || !opts.liveMap || opts.signal.aborted) return;
  const { map } = opts.liveMap;
  if (map.areTilesLoaded() && map.queryRenderedFeatures().some((f) => Boolean(f.source))) {
    return;
  }
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      map.off('idle', finish);
      resolve();
    };
    const timer = window.setTimeout(finish, 850);
    map.on('idle', finish);
    opts.signal.addEventListener('abort', finish, { once: true });
  });
}

export function highlightResultCard(card: HTMLElement | null, durationMs = 2600): void {
  if (!card) return;
  card.classList.remove('is-concierge-highlight');
  void card.offsetWidth;
  card.classList.add('is-concierge-highlight');
  window.setTimeout(() => {
    card.classList.remove('is-concierge-highlight');
  }, durationMs);
}

export function renderMapDock(opts: DockMapOptions, signal: AbortSignal): void {
  const dock = byId<HTMLElement>('conciergeMapDock');
  if (!dock) return;
  syncSingleAvatarPresence('docked-map');
  dock.replaceChildren();
  dock.dataset.stopId = opts.stopId;
  dock.classList.toggle('is-reduced-motion', isMotionPaused());

  const avatar = document.createElement('div');
  avatar.className = 'concierge-dock-avatar';
  avatar.innerHTML = renderGuideCharacterSvg({ pose: lastPose === 'speaking' ? 'speaking' : 'pointing', size: 52 });

  const body = document.createElement('div');
  body.className = 'concierge-dock-body';

  const kicker = document.createElement('span');
  kicker.className = 'concierge-dock-kicker';
  kicker.textContent = opts.isExploration
    ? `تستكشف الآن ${opts.stopName}`
    : `${SMART_GUIDE_NAME} · ${opts.stopName}`;

  const msg = document.createElement('p');
  msg.className = 'concierge-dock-text';
  msg.textContent = opts.message;

  const actions = document.createElement('div');
  actions.className = 'concierge-dock-actions';

  const resumeBtn = document.createElement('button');
  resumeBtn.type = 'button';
  resumeBtn.id = 'dockResumeBtn';
  resumeBtn.className = 'btn btn-dark concierge-dock-btn';
  resumeBtn.textContent = 'تابع مع المرشد';
  resumeBtn.addEventListener('click', opts.onResume, { signal });

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.id = 'dockDismissBtn';
  dismissBtn.className = 'concierge-dock-dismiss';
  dismissBtn.setAttribute('aria-label', 'إخفاء المرشد الموضع');
  dismissBtn.textContent = '×';
  dismissBtn.addEventListener('click', () => {
    syncSingleAvatarPresence('floating');
    opts.onDismiss();
  }, { signal });

  actions.append(resumeBtn);
  body.append(kicker, msg, actions);
  dock.append(avatar, body, dismissBtn);
  dock.hidden = false;
  announceToScreenReader(`${kicker.textContent}. ${opts.message}`);
}

export function renderGuideDock(opts: DockGuideOptions, signal: AbortSignal): void {
  const host =
    document.querySelector<HTMLElement>('.tour-guide-detail .directory-intro-copy') ||
    document.querySelector<HTMLElement>('.place-hero-copy') ||
    byId('tourGuideView') ||
    byId('placeView');
  if (!host) return;
  byId('conciergeGuideDock')?.remove();
  syncSingleAvatarPresence('docked-guide');

  const card = document.createElement('aside');
  card.id = 'conciergeGuideDock';
  card.className = `concierge-guide-dock${opts.missingCoordinates ? ' is-missing-coords' : ''}`;
  card.setAttribute('aria-label', SMART_GUIDE_NAME);

  const avatar = document.createElement('div');
  avatar.className = 'concierge-dock-avatar';
  avatar.innerHTML = renderGuideCharacterSvg({ pose: 'pointing', size: 48 });

  const body = document.createElement('div');
  body.className = 'concierge-dock-body';

  const kicker = document.createElement('span');
  kicker.className = 'concierge-dock-kicker';
  kicker.textContent = `تستكشف الآن ${opts.name}`;

  const text = document.createElement('p');
  text.className = 'concierge-dock-text';
  text.textContent = opts.message;

  const actions = document.createElement('div');
  actions.className = 'concierge-dock-actions';

  const resumeBtn = document.createElement('button');
  resumeBtn.type = 'button';
  resumeBtn.className = 'btn btn-dark concierge-dock-btn';
  resumeBtn.textContent = 'تابع مع المرشد';
  resumeBtn.addEventListener('click', opts.onResume, { signal });
  actions.append(resumeBtn);

  if (opts.onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-soft concierge-dock-btn';
    retryBtn.textContent = 'إعادة المحاولة';
    retryBtn.addEventListener('click', opts.onRetry, { signal });
    actions.append(retryBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'concierge-dock-dismiss';
  dismissBtn.setAttribute('aria-label', 'إغلاق بطاقة المرشد');
  dismissBtn.textContent = '×';
  dismissBtn.addEventListener('click', () => {
    card.remove();
    syncSingleAvatarPresence('floating');
    opts.onDismiss();
  }, { signal });

  body.append(kicker, text, actions);
  card.append(avatar, body, dismissBtn);
  host.append(card);
  highlightResultCard(card);
  resumeBtn.focus({ preventScroll: true });
  announceToScreenReader(`${kicker.textContent}. ${opts.message}`);
}
