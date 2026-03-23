import { useTranslation } from "react-i18next";
import type { SpotlightFooterHint } from "@/spotlight/types";

export function SpotlightFooter({ modeHints }: { modeHints?: SpotlightFooterHint[] }) {
  const { t } = useTranslation();

  return (
    <div className="spotlight-footer">
      <div className="spotlight-footer-hint">
        <kbd>↵</kbd>
        <span>{t("spotlight.footer.execute")}</span>
      </div>
      {modeHints && modeHints.map((hint) => (
        <div key={hint.kbd} className="spotlight-footer-hint">
          <kbd>{hint.kbd}</kbd>
          <span>{hint.label}</span>
        </div>
      ))}
      <div className="spotlight-footer-hint">
        <kbd>Tab</kbd>
        <span>{t("spotlight.footer.switchMode")}</span>
      </div>
      <div className="spotlight-footer-hint">
        <kbd>Esc</kbd>
        <span>{t("spotlight.footer.close")}</span>
      </div>
    </div>
  );
}
