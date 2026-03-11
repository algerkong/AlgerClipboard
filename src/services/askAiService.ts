import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import type { AiWebService } from "@/constants/aiServices";
import { AI_WEB_SERVICES } from "@/constants/aiServices";
import type { AskAiPreset } from "@/constants/askAiPresets";
import { getInjectionScript } from "@/services/injectionScripts";
import { useAskAiStore } from "@/stores/askAiStore";
import { getSavedWindowSize } from "@/lib/windowSize";
import { ASK_AI_SIZE_KEY } from "@/pages/AskAiPanel";

const TAB_BAR_HEIGHT = 40;

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
 * Open (or focus) the ask-ai-panel window.
 * Creates a bare window from Rust with the React tab bar as a child webview,
 * so it stays at the same z-level as service webviews (no overlap).
 */
export async function openAskAiPanel() {
  const enabledIds = useAskAiStore.getState().enabledServiceIds;
  const singleService = enabledIds.length <= 1;
  const saved = await getSavedWindowSize(ASK_AI_SIZE_KEY, { width: 1000, height: 700 });

  await invoke("create_ask_ai_panel", {
    tabBarHeight: TAB_BAR_HEIGHT,
    singleService,
    width: saved.width,
    height: saved.height,
  });
}

/**
 * Open (or focus) a WebView window for the given AI service.
 * @deprecated Use openAskAiPanel() instead. Kept for backward compat (settings page open button).
 */
export async function openAiWebView(_service: AiWebService) {
  void _service;
  // Redirect to the new ask-ai-panel
  await openAskAiPanel();
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

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWebview(label: string, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const exists = await invoke<boolean>("webview_exists", { label });
    if (exists) {
      return;
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for WebView '${label}'`);
}

/**
 * Orchestrate the Ask AI flow: build prompt, open panel, inject fill+submit script.
 *
 * Best-effort auto-send -- errors are logged but not rethrown so the WebView
 * remains open for manual interaction even if injection fails.
 */
export async function askAi(
  serviceId: string,
  clipboardText: string,
  preset: AskAiPreset,
  customPrompt?: string,
): Promise<void> {
  try {
    // 1. Build the full prompt from template
    const fullPrompt = preset.promptTemplate
      .replace("{content}", clipboardText)
      .replace("{customPrompt}", customPrompt || "");

    // 2. Find the service definition
    const service = AI_WEB_SERVICES.find((s) => s.id === serviceId);
    if (!service) {
      throw new Error(`Unknown AI service: ${serviceId}`);
    }

    // 3. Open or focus the ask-ai-panel window
    await openAskAiPanel();

    // 4. Ask the panel to switch to the requested service tab.
    // Emit twice to cover the first-open race where the tab-bar listener is still mounting.
    await delay(250);
    await emit("ask-ai:open-service", { serviceId });
    await delay(600);
    await emit("ask-ai:open-service", { serviceId });

    // 5. Wait for the target child webview to exist before injecting.
    const label = `ask-ai-svc-${serviceId}`;
    await waitForWebview(label);

    // 6. Build and inject the fill+submit script into the requested service.
    const script = getInjectionScript(serviceId, fullPrompt);
    await invoke("eval_webview_js", { label, js: script });
  } catch (e) {
    console.error(`askAi failed for service ${serviceId}:`, e);
  }
}
