import React from 'react';
import { SMART_GUIDE_NAME } from '@/lib/smartGuideName';

export type GuideCharacterPose = 'idle' | 'listening' | 'speaking' | 'pointing' | 'docked';

export interface GuideCharacterProps {
  pose?: GuideCharacterPose;
  size?: number;
  className?: string;
  id?: string;
  decorative?: boolean;
  label?: string;
}

let charInstanceSeq = 0;

function buildGuideCharacterInnerSvg(_uid: string): string {
  return `
  <g class="gc-listening-aura" aria-hidden="true">
    <circle cx="30" cy="30" r="28" fill="none" stroke="#6ee7b7" stroke-width="1.6" opacity="0"/>
  </g>
  <g class="gc-robot-head">
    <path d="M30 9v6" stroke="#a7f3d0" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="30" cy="6.5" r="3.2" fill="#6ee7b7" stroke="#ffffff" stroke-width="1.2"/>
    <rect x="9" y="15" width="42" height="34" rx="15" fill="#F4F9FC" stroke="#ffffff" stroke-width="1.6"/>
    <rect x="14.5" y="21" width="31" height="21" rx="10" fill="#061A33"/>
    <ellipse cx="24" cy="31" rx="3" ry="4.4" fill="#6ee7b7"/>
    <ellipse cx="36" cy="31" rx="3" ry="4.4" fill="#6ee7b7"/>
    <circle cx="25" cy="29.5" r="1.1" fill="#ecfdf5"/>
    <circle cx="37" cy="29.5" r="1.1" fill="#ecfdf5"/>
    <path d="M25.5 37.8q4.5 3 9 0" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round"/>
    <rect x="5" y="27" width="4" height="10" rx="2" fill="#6ee7b7"/>
    <rect x="51" y="27" width="4" height="10" rx="2" fill="#6ee7b7"/>
  </g>
`;
}

/**
 * Generates sanitized SVG markup for imperative DOM hosts (map dock / guide result dock).
 */
export function renderGuideCharacterSvg(options?: {
  pose?: GuideCharacterPose;
  size?: number;
  className?: string;
  decorative?: boolean;
}): string {
  const uid = `dom${++charInstanceSeq}`;
  const pose = options?.pose || 'idle';
  const size = options?.size || 48;
  const cls = options?.className ? `guide-character-svg ${options.className}` : 'guide-character-svg';
  const aria =
    options?.decorative === false
      ? `role="img" aria-label="${SMART_GUIDE_NAME}"`
      : 'aria-hidden="true" focusable="false"';
  return `<svg class="${cls}" data-pose="${pose}" viewBox="0 0 60 60" width="${size}" height="${size}" fill="none" ${aria}>${buildGuideCharacterInnerSvg(uid)}</svg>`;
}

/**
 * Reusable Al-Baha Electronic AI Tour Guide robot avatar supporting idle, listening, speaking, pointing, and docked states.
 */
export function GuideCharacter({
  pose = 'idle',
  size = 48,
  className = '',
  id,
  decorative = true,
  label = SMART_GUIDE_NAME,
}: GuideCharacterProps) {
  const reactUid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '') || 'gc';
  return (
    <svg
      id={id}
      className={className ? `guide-character-svg ${className}` : 'guide-character-svg'}
      data-pose={pose}
      viewBox="0 0 60 60"
      width={size}
      height={size}
      fill="none"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: buildGuideCharacterInnerSvg(reactUid) }}
    />
  );
}
