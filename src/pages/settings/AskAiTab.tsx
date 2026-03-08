import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAskAiStore } from "@/stores/askAiStore";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import { Toggle } from "./shared";

/* ─── Ask AI Tab ─── */
export function AskAiTab() {
  const { t } = useTranslation();
  const { enabledServiceIds, loadEnabledServices, toggleService } =
    useAskAiStore();

  useEffect(() => {
    loadEnabledServices();
  }, [loadEnabledServices]);

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
          return (
            <div
              key={service.id}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Placeholder icon: first letter */}
                <div className="w-4 h-4 rounded-md bg-muted inline-flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium leading-none text-muted-foreground">
                    {service.name.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-sm2 block truncate">
                    {service.name}
                  </span>
                  <span className="text-xs2 text-muted-foreground block truncate">
                    {service.url}
                  </span>
                </div>
              </div>
              <Toggle
                value={enabled}
                onChange={() => toggleService(service.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
