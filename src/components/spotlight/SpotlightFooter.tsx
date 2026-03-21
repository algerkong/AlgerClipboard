import { useTranslation } from "react-i18next";

export function SpotlightFooter() {
  const { t } = useTranslation();

  return (
    <div className="spotlight-footer">
      <div className="spotlight-footer-hint">
        <kbd>↵</kbd>
        <span>{t("spotlight.footer.execute")}</span>
      </div>
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
