import { GuideCharacter } from '@/components/common/GuideCharacter';
import { SMART_GUIDE_NAME } from '@/lib/smartGuideName';

/**
 * Floating launcher for the tourism assistant.
 */
export function SirajLauncher() {
  return (
    <button
      type="button"
      className="bot"
      id="sirajLauncher"
      data-open="agent"
      aria-label={`افتح ${SMART_GUIDE_NAME}`}
      title={SMART_GUIDE_NAME}
      aria-haspopup="dialog"
      aria-controls="agentPanel"
    >
      <GuideCharacter pose="idle" size={44} className="guide-launcher-avatar" />
      <span className="siraj-tooltip" aria-hidden="true">
        {SMART_GUIDE_NAME}
      </span>
    </button>
  );
}
