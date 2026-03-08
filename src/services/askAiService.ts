import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { isMacOS, getManagedWindowDecorations } from "@/services/windowOptions";
import type { AiWebService } from "@/constants/aiServices";

/**
 * Create a deterministic 16-byte identifier from a service ID.
 * Used as `dataStoreIdentifier` on macOS for per-service WebView session isolation.
 */
export function serviceIdToDataStoreId(serviceId: string): number[] {
  const bytes = new Array(16).fill(0);
  for (let i = 0; i < serviceId.length && i < 16; i++) {
    bytes[i] = serviceId.charCodeAt(i);
  }
  return bytes;
}

/**
 * Open (or focus) a WebView window for the given AI service.
 * Each service gets its own persistent, isolated session via:
 * - macOS: `dataStoreIdentifier` (WKWebsiteDataStore)
 * - Windows/Linux: `dataDirectory` (per-service profile folder)
 */
export async function openAiWebView(service: AiWebService) {
  const label = `ai-webview-${service.id}`;

  // If the window already exists, just show and focus it
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }

  // Build platform-specific session isolation options
  const sessionOptions = isMacOS()
    ? { dataStoreIdentifier: serviceIdToDataStoreId(service.id) }
    : { dataDirectory: service.id };

  const win = new WebviewWindow(label, {
    url: service.url,
    title: service.name,
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    ...getManagedWindowDecorations(),
    center: true,
    shadow: true,
    resizable: true,
    ...sessionOptions,
  });

  win.once("tauri://error", (e) => {
    console.error(`Failed to create WebView window for ${service.name}:`, e);
  });
}

/**
 * Fetch and cache a favicon for the given service.
 * Returns an asset URL suitable for `<img src>`, or null on failure.
 */
export async function fetchServiceFavicon(
  serviceId: string,
  domain: string,
): Promise<string | null> {
  try {
    const path = await invoke<string>("fetch_favicon", { serviceId, domain });
    return convertFileSrc(path);
  } catch (e) {
    console.error(`Failed to fetch favicon for ${serviceId}:`, e);
    return null;
  }
}
