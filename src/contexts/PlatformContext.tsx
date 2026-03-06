import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { platform as getPlatform } from "@tauri-apps/plugin-os";

export type Platform = "windows" | "macos" | "linux";

const PlatformContext = createContext<Platform>("windows");

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<Platform>("windows");

  useEffect(() => {
    const p = getPlatform();
    if (p === "macos" || p === "linux" || p === "windows") {
      setPlatform(p);
    }
  }, []);

  return (
    <PlatformContext.Provider value={platform}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): Platform {
  return useContext(PlatformContext);
}
