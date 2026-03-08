import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { useAskAiStore } from "@/stores/askAiStore";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { openAiWebView } from "@/services/askAiService";
import { Toggle } from "./shared";

/* --- Ask AI Tab --- */
export function AskAiTab() {
  const { t } = useTranslation();
  const {
    enabledServiceIds,
    loadEnabledServices,
    toggleService,
    loadFavicons,
    getFavicon,
  } = useAskAiStore();

  useEffect(() => {
    loadEnabledServices();
    loadFavicons();
  }, [loadEnabledServices, loadFavicons]);

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-xs2 text-muted-foreground">
        {t("settings.askAi.description")}
      </p>

      {/* Service list */}
      <div className="space-y-2">
        {AI_WEB_SERVICES.map((service) => {
          const enabled = enabledServiceIds.includes(service.id);
          const faviconUrl = getFavicon(service.id);
          return (
            <div
              key={service.id}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Favicon or letter fallback */}
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt={service.name}
                    className="w-4 h-4 rounded-sm shrink-0"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-md bg-muted inline-flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-medium leading-none text-muted-foreground">
                      {service.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-sm2 block truncate">
                    {service.name}
                  </span>
                  <span className="text-xs2 text-muted-foreground block truncate">
                    {service.url}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Open button (only for enabled services) */}
                {enabled && (
                  <button
                    type="button"
                    className="text-xs2 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => openAiWebView(service)}
                    title={t("settings.askAi.open")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <Toggle
                  value={enabled}
                  onChange={() => toggleService(service.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
