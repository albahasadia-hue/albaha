const homeSections = new Set([
  'app', 'attractions', 'camping', 'destination-directory', 'destinations', 'dining',
  'experiences', 'guideDaySection', 'mapPanel', 'official-portal', 'planner', 'summary',
  'tripDraft', 'visit-guide', 'visit-season',
]);

const detailPath = /^\/(?:place\/[\w-]+|city\/(?:[\w-]+|baha\/stories(?:\/[\w-]+)?)|route\/[\w-]+|guide(?:\/place\/[\w-]+)?|faq(?:\/[\w-]+)?|invest(?:\/[\w-]+)?)$/;

export function portalSectionId(path: string): string | undefined {
  const section = path.slice(1);
  return homeSections.has(section) ? section : undefined;
}

export function isPortalPath(path: string): boolean {
  return path === '/' || Boolean(portalSectionId(path)) || detailPath.test(path);
}

export const portalNavigationEvent = 'albaha:navigate';

export function navigatePortal(path: string): void {
  const target = new URL(path, window.location.origin);
  if (target.origin !== window.location.origin || !isPortalPath(target.pathname)) return;
  if (target.href !== window.location.href) window.history.pushState(null, '', target);
  window.dispatchEvent(new Event(portalNavigationEvent));
}

export function canonicalizeLegacyPortalLink(): boolean {
  if (!window.location.hash) return false;
  const fragment = window.location.hash.slice(1);
  if (!fragment) return false;
  const path = fragment === 'home' ? '/' : `/${fragment}`;
  if (!isPortalPath(path)) return false;
  window.history.replaceState(null, '', `${path}${window.location.search}`);
  return true;
}
