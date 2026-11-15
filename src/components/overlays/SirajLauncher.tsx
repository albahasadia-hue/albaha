import { GuideCharacter } from '@/components/common/GuideCharacter';

/**
 * Floating AI Tour Guide launcher ("المرشد السياحي الذكي") with approved human character & R15 visual balance.
 */
export function SirajLauncher() {
  return (
    <button
      type="button"
      className="bot"
      id="sirajLauncher"
      data-open="agent"
      aria-label="اسأل المرشد"
      title="اسأل المرشد"
      aria-haspopup="dialog"
      aria-controls="agentPanel"
    >
      <GuideCharacter pose="idle" size={44} className="guide-launcher-avatar" />
      <span className="siraj-tooltip" aria-hidden="true">
        اسأل المرشد
      </span>
    </button>
  );
}
