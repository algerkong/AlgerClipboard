import DOMPurify from "dompurify";

export type RichTextDetailMode = "clean" | "full";

export interface RichTextPreviewOptions {
  enabled: boolean;
  preserveBold: boolean;
  preserveItalic: boolean;
  preserveDecoration: boolean;
  preserveLinks: boolean;
  preserveLists: boolean;
  preserveCode: boolean;
  preserveBlockquotes: boolean;
  preserveFontSize: boolean;
  preserveTextColor: boolean;
  preserveBackground: boolean;
  preserveFontFamily: boolean;
  preserveTables: boolean;
  preserveImages: boolean;
  preserveLayout: boolean;
}

export const DEFAULT_RICH_TEXT_PREVIEW_OPTIONS: RichTextPreviewOptions = {
  enabled: false,
  preserveBold: false,
  preserveItalic: false,
  preserveDecoration: false,
  preserveLinks: false,
  preserveLists: false,
  preserveCode: false,
  preserveBlockquotes: false,
  preserveFontSize: false,
  preserveTextColor: false,
  preserveBackground: false,
  preserveFontFamily: false,
  preserveTables: false,
  preserveImages: false,
  preserveLayout: false,
};

export const DEFAULT_RICH_TEXT_DETAIL_MODE: RichTextDetailMode = "clean";

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "style", "colspan", "rowspan"];

const CLEAN_STYLE_PROPS = new Set([
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "line-height",
  "white-space",
]);

const FULL_STYLE_PROPS = new Set([
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "border-color",
  "border-left",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-radius",
  "border-right",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-style",
  "border-top",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "border-width",
  "clear",
  "color",
  "display",
  "float",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "letter-spacing",
  "line-height",
  "list-style",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "text-decoration-line",
  "vertical-align",
  "white-space",
  "width",
  "word-spacing",
]);

const PREVIEW_STYLE_GROUPS: Record<Exclude<keyof RichTextPreviewOptions, "enabled">, string[]> = {
  preserveBold: ["font-weight"],
  preserveItalic: ["font-style"],
  preserveDecoration: ["text-decoration", "text-decoration-line"],
  preserveLinks: [],
  preserveLists: ["list-style", "list-style-type"],
  preserveCode: ["white-space"],
  preserveBlockquotes: [],
  preserveFontSize: ["font-size", "line-height"],
  preserveTextColor: ["color"],
  preserveBackground: ["background", "background-color"],
  preserveFontFamily: ["font-family"],
  preserveTables: [],
  preserveImages: [],
  preserveLayout: [
    "display",
    "float",
    "height",
    "margin",
    "margin-bottom",
    "margin-left",
    "margin-right",
    "margin-top",
    "max-height",
    "max-width",
    "min-height",
    "min-width",
    "padding",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "padding-top",
    "text-align",
    "vertical-align",
    "white-space",
    "width",
  ],
};

function buildPreviewStyleProps(options: RichTextPreviewOptions) {
  const props = new Set<string>();
  for (const [key, cssProps] of Object.entries(PREVIEW_STYLE_GROUPS) as [
    Exclude<keyof RichTextPreviewOptions, "enabled">,
    string[],
  ][]) {
    if (!options[key]) continue;
    for (const prop of cssProps) {
      props.add(prop);
    }
  }
  return props;
}

function sanitizeBaseHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta", "form"],
  });
}

function parseHtml(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

function unwrapElement(element: Element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function replaceWithText(element: Element, text: string) {
  const parent = element.parentNode;
  if (!parent) return;
  parent.replaceChild(element.ownerDocument.createTextNode(text), element);
}

function replaceWithSpan(element: Element, text: string) {
  const parent = element.parentNode;
  if (!parent) return;
  const span = element.ownerDocument.createElement("span");
  span.textContent = text;
  parent.replaceChild(span, element);
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

function normalizeLengthValue(value: string, min: number, max: number) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px|rem|em)$/i);
  if (!match) return value.trim();
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(amount)) return value.trim();
  if (unit === "px") {
    return `${Math.min(Math.max(amount, min), max)}px`;
  }
  const scaledMin = min / 16;
  const scaledMax = max / 16;
  return `${Math.min(Math.max(amount, scaledMin), scaledMax)}${unit}`;
}

function sanitizeStyleValue(property: string, value: string, forPreview: boolean) {
  const normalized = value.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    lowered.includes("expression(") ||
    lowered.includes("url(") ||
    lowered.includes("javascript:")
  ) {
    return null;
  }
  if (property === "font-size" && forPreview) {
    return normalizeLengthValue(normalized, 12, 18);
  }
  if ((property === "width" || property === "max-width") && lowered === "100%") {
    return normalized;
  }
  return normalized;
}

function sanitizeInlineStyle(
  value: string | null,
  allowedProps: Set<string>,
  forPreview: boolean,
) {
  if (!value) return "";
  const declarations = value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const nextStyles: string[] = [];

  for (const declaration of declarations) {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;
    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const rawValue = declaration.slice(colonIndex + 1).trim();
    if (!allowedProps.has(property)) continue;
    const sanitizedValue = sanitizeStyleValue(property, rawValue, forPreview);
    if (!sanitizedValue) continue;
    nextStyles.push(`${property}: ${sanitizedValue}`);
  }

  return nextStyles.join("; ");
}

function sanitizeElementAttributes(
  element: HTMLElement,
  allowedStyleProps: Set<string>,
  forPreview: boolean,
) {
  const attributeNames = [...element.getAttributeNames()];
  for (const name of attributeNames) {
    if (
      name === "href" ||
      name === "src" ||
      name === "alt" ||
      name === "title" ||
      name === "colspan" ||
      name === "rowspan"
    ) {
      continue;
    }
    if (name === "style") {
      const nextStyle = sanitizeInlineStyle(
        element.getAttribute("style"),
        allowedStyleProps,
        forPreview,
      );
      if (nextStyle) {
        element.setAttribute("style", nextStyle);
      } else {
        element.removeAttribute("style");
      }
      continue;
    }
    element.removeAttribute(name);
  }
}

function transformPreviewNode(element: HTMLElement, options: RichTextPreviewOptions) {
  for (const child of [...element.children]) {
    transformPreviewNode(child as HTMLElement, options);
  }

  const tag = element.tagName.toLowerCase();

  if (tag === "img" && !options.preserveImages) {
    element.remove();
    return;
  }

  if (tag === "table" && !options.preserveTables) {
    replaceWithSpan(element, element.textContent?.replace(/\s+/g, " ").trim() || "");
    return;
  }

  if ((tag === "thead" || tag === "tbody" || tag === "tr" || tag === "td" || tag === "th") && !options.preserveTables) {
    unwrapElement(element);
    return;
  }

  if ((tag === "ul" || tag === "ol") && !options.preserveLists) {
    unwrapElement(element);
    return;
  }

  if (tag === "li" && !options.preserveLists) {
    replaceWithText(element, `• ${element.textContent?.trim() || ""} `);
    return;
  }

  if (tag === "blockquote" && !options.preserveBlockquotes) {
    unwrapElement(element);
    return;
  }

  if ((tag === "pre" || tag === "code") && !options.preserveCode) {
    unwrapElement(element);
    return;
  }

  if (tag === "a") {
    if (!options.preserveLinks) {
      unwrapElement(element);
      return;
    }
    const href = normalizeUrl(element.getAttribute("href"));
    if (href) {
      element.setAttribute("href", href);
    } else {
      element.removeAttribute("href");
    }
  }

  if ((tag === "b" || tag === "strong") && !options.preserveBold) {
    unwrapElement(element);
    return;
  }

  if ((tag === "i" || tag === "em") && !options.preserveItalic) {
    unwrapElement(element);
    return;
  }

  if (
    (tag === "u" || tag === "s" || tag === "del" || tag === "ins" || tag === "sub" || tag === "sup") &&
    !options.preserveDecoration
  ) {
    unwrapElement(element);
    return;
  }

  sanitizeElementAttributes(element, buildPreviewStyleProps(options), true);
}

function transformDetailNode(element: HTMLElement, mode: RichTextDetailMode) {
  for (const child of [...element.children]) {
    transformDetailNode(child as HTMLElement, mode);
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "a") {
    const href = normalizeUrl(element.getAttribute("href"));
    if (href) {
      element.setAttribute("href", href);
    } else {
      element.removeAttribute("href");
    }
  }

  const allowedStyleProps = mode === "full" ? FULL_STYLE_PROPS : CLEAN_STYLE_PROPS;
  sanitizeElementAttributes(element, allowedStyleProps, false);
}

export function parseRichTextPreviewOptions(value: string | null) {
  if (!value) return DEFAULT_RICH_TEXT_PREVIEW_OPTIONS;
  try {
    const parsed = JSON.parse(value) as Partial<RichTextPreviewOptions>;
    return {
      ...DEFAULT_RICH_TEXT_PREVIEW_OPTIONS,
      ...parsed,
      enabled: parsed.enabled ?? DEFAULT_RICH_TEXT_PREVIEW_OPTIONS.enabled,
    };
  } catch {
    return DEFAULT_RICH_TEXT_PREVIEW_OPTIONS;
  }
}

export function serializeRichTextPreviewOptions(options: RichTextPreviewOptions) {
  return JSON.stringify(options);
}

export function sanitizePreviewHtml(html: string, options: RichTextPreviewOptions) {
  if (!options.enabled) return "";
  const doc = parseHtml(sanitizeBaseHtml(html));
  for (const child of [...doc.body.children]) {
    transformPreviewNode(child as HTMLElement, options);
  }
  return doc.body.innerHTML;
}

export function sanitizeDetailHtml(html: string, mode: RichTextDetailMode) {
  const doc = parseHtml(sanitizeBaseHtml(html));
  for (const child of [...doc.body.children]) {
    transformDetailNode(child as HTMLElement, mode);
  }
  return doc.body.innerHTML;
}
