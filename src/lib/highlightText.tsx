import React from "react";

/**
 * Build a regex from keyword string (handles regex mode and normal tokens).
 * Returns null if no valid pattern can be built.
 */
function buildKeywordRegex(keyword: string): RegExp | null {
  const isRegex = keyword.startsWith("/") && keyword.endsWith("/") && keyword.length > 2;

  try {
    if (isRegex) {
      const pattern = keyword.slice(1, -1);
      return new RegExp(`(${pattern})`, "gi");
    } else {
      const tokens = keyword
        .trim()
        .split(/\s+/)
        .filter((t) => !t.startsWith("-"))
        .map((t) => t.replace(/^"|"$/g, ""))
        .filter(Boolean)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (tokens.length === 0) return null;
      return new RegExp(`(${tokens.join("|")})`, "gi");
    }
  } catch {
    return null;
  }
}

/**
 * Highlight matching text with <mark> tags.
 * Supports both normal keyword and regex modes.
 */
export function highlightText(
  text: string,
  keyword: string,
  maxLength?: number
): React.ReactNode {
  if (!keyword.trim() || !text) {
    const display = maxLength && text.length > maxLength
      ? text.substring(0, maxLength) + "\u2026"
      : text;
    return display;
  }

  const regex = buildKeywordRegex(keyword);
  if (!regex) {
    const display = maxLength && text.length > maxLength
      ? text.substring(0, maxLength) + "\u2026"
      : text;
    return display;
  }

  // Truncate text first if needed
  const display = maxLength && text.length > maxLength
    ? text.substring(0, maxLength) + "\u2026"
    : text;

  const parts = display.split(regex);
  if (parts.length <= 1) return display;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-primary/20 text-foreground rounded-sm px-0.5"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

/**
 * Get a search-context-aware snippet from text.
 * Instead of always showing the beginning, finds the first match position
 * and returns surrounding context with highlighted matches.
 */
export function getSearchSnippet(
  text: string,
  keyword: string,
  maxLength = 120
): React.ReactNode {
  if (!keyword.trim() || !text) {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "\u2026"
      : text;
  }

  const regex = buildKeywordRegex(keyword);
  if (!regex) {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "\u2026"
      : text;
  }

  // Find first match position
  const match = regex.exec(text);
  if (!match) {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "\u2026"
      : text;
  }

  const matchStart = match.index;

  // If match is within the first maxLength chars, just show from the beginning
  if (matchStart < maxLength * 0.6) {
    return highlightText(text, keyword, maxLength);
  }

  // Show context around the match
  const contextBefore = Math.floor(maxLength * 0.3);
  const snippetStart = Math.max(0, matchStart - contextBefore);
  const snippetEnd = Math.min(text.length, snippetStart + maxLength);
  let snippet = text.substring(snippetStart, snippetEnd);

  const prefix = snippetStart > 0 ? "\u2026" : "";
  const suffix = snippetEnd < text.length ? "\u2026" : "";
  snippet = prefix + snippet + suffix;

  // Reset regex state
  regex.lastIndex = 0;

  const parts = snippet.split(regex);
  if (parts.length <= 1) return snippet;

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-primary/20 text-foreground rounded-sm px-0.5"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}
