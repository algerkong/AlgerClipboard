import { IconContext } from "@phosphor-icons/react";
import type { ReactNode } from "react";

const DEFAULT_WEIGHT = "bold";

export function IconProvider({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: DEFAULT_WEIGHT }}>
      {children}
    </IconContext.Provider>
  );
}
