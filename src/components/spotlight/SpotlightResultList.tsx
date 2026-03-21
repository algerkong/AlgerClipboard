import { useTranslation } from "react-i18next";
import { useSpotlightStore } from "@/stores/spotlightStore";
import { SpotlightResultItem } from "./SpotlightResultItem";

export function SpotlightResultList() {
  const { t } = useTranslation();
  const results = useSpotlightStore((s) => s.results);
  const selectedIndex = useSpotlightStore((s) => s.selectedIndex);
  const loading = useSpotlightStore((s) => s.loading);
  const mode = useSpotlightStore((s) => s.mode);
  const query = useSpotlightStore((s) => s.query);
  const executeSelected = useSpotlightStore((s) => s.executeSelected);

  if (results.length === 0 && !loading) {
    if (!query.trim()) return null;
    const emptyKey = `spotlight.empty.${mode}`;
    return (
      <div className="spotlight-empty">
        {t(emptyKey, t("spotlight.empty.noResults"))}
      </div>
    );
  }

  return (
    <div className="spotlight-results">
      {results.map((result, index) => (
        <SpotlightResultItem
          key={result.id}
          result={result}
          index={index}
          selected={index === selectedIndex}
          onClick={async () => {
            useSpotlightStore.setState({ selectedIndex: index });
            await executeSelected();
          }}
        />
      ))}
    </div>
  );
}
