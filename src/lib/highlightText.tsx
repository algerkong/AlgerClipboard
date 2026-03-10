import React from "react";

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

  const isRegex = keyword.startsWith("/") && keyword.endsWith("/") && keyword.length > 2;

  let regex: RegExp;
  try {
    if (isRegex) {
      const pattern = keyword.slice(1, -1);
      regex = new RegExp(`(${pattern})`, "gi");
    } else {
      // Split by spaces, escape each token (skip negation tokens starting with -), join with |
      const tokens = keyword
        .trim()
        .split(/\s+/)
        .filter((t) => !t.startsWith("-"))
        .map((t) => t.replace(/^"|"$/g, "")) // remove surrounding quotes
        .filter(Boolean)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (tokens.length === 0) {
        const display = maxLength && text.length > maxLength
          ? text.substring(0, maxLength) + "\u2026"
          : text;
        return display;
      }
      regex = new RegExp(`(${tokens.join("|")})`, "gi");
    }
  } catch {
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
