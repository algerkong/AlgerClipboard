// Text Transform Tools — pure functions for text manipulation

// Case transforms
export const toUpperCase = (text: string) => text.toUpperCase();
export const toLowerCase = (text: string) => text.toLowerCase();
export const toTitleCase = (text: string) =>
  text.replace(/\b\w/g, (c) => c.toUpperCase());
export const toCamelCase = (text: string) =>
  text
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
export const toSnakeCase = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
export const toKebabCase = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();

// Encoding transforms
export const toBase64Encode = (text: string) => {
  try {
    return btoa(
      new TextEncoder()
        .encode(text)
        .reduce((acc, byte) => acc + String.fromCharCode(byte), "")
    );
  } catch {
    return text;
  }
};
export const toBase64Decode = (text: string) => {
  try {
    const binary = atob(text.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return text;
  }
};
export const toUrlEncode = (text: string) => encodeURIComponent(text);
export const toUrlDecode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

// Format transforms
export const trimWhitespace = (text: string) => text.trim();
export const removeBlankLines = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
export const sortLines = (text: string) =>
  text.split("\n").sort().join("\n");
export const deduplicateLines = (text: string) =>
  [...new Set(text.split("\n"))].join("\n");
export const reverseText = (text: string) => [...text].reverse().join("");

// JSON transforms
export const jsonFormat = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};
export const jsonMinify = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
};

export interface TransformGroup {
  labelKey: string;
  transforms: {
    labelKey: string;
    fn: (text: string) => string;
  }[];
}

export const transformGroups: TransformGroup[] = [
  {
    labelKey: "contextMenu.transformCase",
    transforms: [
      { labelKey: "contextMenu.transformUpperCase", fn: toUpperCase },
      { labelKey: "contextMenu.transformLowerCase", fn: toLowerCase },
      { labelKey: "contextMenu.transformTitleCase", fn: toTitleCase },
      { labelKey: "contextMenu.transformCamelCase", fn: toCamelCase },
      { labelKey: "contextMenu.transformSnakeCase", fn: toSnakeCase },
      { labelKey: "contextMenu.transformKebabCase", fn: toKebabCase },
    ],
  },
  {
    labelKey: "contextMenu.transformEncoding",
    transforms: [
      { labelKey: "contextMenu.transformBase64Encode", fn: toBase64Encode },
      { labelKey: "contextMenu.transformBase64Decode", fn: toBase64Decode },
      { labelKey: "contextMenu.transformUrlEncode", fn: toUrlEncode },
      { labelKey: "contextMenu.transformUrlDecode", fn: toUrlDecode },
    ],
  },
  {
    labelKey: "contextMenu.transformFormat",
    transforms: [
      { labelKey: "contextMenu.transformTrim", fn: trimWhitespace },
      { labelKey: "contextMenu.transformRemoveBlankLines", fn: removeBlankLines },
      { labelKey: "contextMenu.transformSortLines", fn: sortLines },
      { labelKey: "contextMenu.transformDeduplicate", fn: deduplicateLines },
      { labelKey: "contextMenu.transformReverse", fn: reverseText },
    ],
  },
  {
    labelKey: "contextMenu.transformJson",
    transforms: [
      { labelKey: "contextMenu.transformJsonFormat", fn: jsonFormat },
      { labelKey: "contextMenu.transformJsonMinify", fn: jsonMinify },
    ],
  },
];