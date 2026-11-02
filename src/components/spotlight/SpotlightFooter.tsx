import { useTranslation } from "react-i18next";
import type { SpotlightFooterHint } from "@/spotlight/types";
import { resolveI18n } from "@/services/pluginService";

export function SpotlightFooter({ modeHints }: { modeHints?: SpotlightFooterHint[] }) {
  const { t, i18n } = useTranslation();
  const hints = modeHints ?? [];

  return (
    <div className="spotlight-footer">
      <div className="spotlight-footer-hint">
        <kbd>↵</kbd>
        <span>{t("spotlight.footer.execute")}</span>
      </div>
      {hints.map((hint, index) => {
        // Plugins may use `key` instead of `kbd`, and `label` may be an
        // i18n key, plain text, or a locale map like {en, "zh-CN"}.
        const kbd = hint.kbd ?? hint.key ?? "";
        // Plugins already localize their labels before registering the
        // mode, so treat strings as final text (passing them through t()
        // would let i18next reinterpret "ns:key" style content).
        const label =
          typeof hint.label === "string"
            ? hint.label
            : resolveI18n(hint.label, i18n.language);
        return (
          <div key={`${kbd}-${index}`} className="spotlight-footer-hint">
            {kbd && <kbd>{kbd}</kbd>}
            <span>{label}</span>
          </div>
        );
      })}
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
