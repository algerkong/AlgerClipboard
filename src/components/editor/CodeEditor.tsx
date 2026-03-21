import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, lineNumbers as lineNumbersExt, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { php } from "@codemirror/lang-php";
import { markdown } from "@codemirror/lang-markdown";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Hash, TextColumns, Minus, Plus } from "@phosphor-icons/react";

const FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20] as const;
const DEFAULT_FONT_SIZE = 13;

function makeDarkTheme(fontSize: number) {
  return EditorView.theme({
    "&": {
      backgroundColor: "transparent",
      color: "var(--color-foreground)",
      fontSize: `${fontSize}px`,
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      padding: "12px 0",
      caretColor: "var(--color-primary)",
    },
    ".cm-cursor": { borderLeftColor: "var(--color-primary)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--color-muted-foreground)",
      border: "none",
      paddingLeft: "8px",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-foreground)" },
    ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--primary) 8%, transparent)" },
    ".cm-selectionBackground": { backgroundColor: "color-mix(in oklab, var(--primary) 30%, transparent) !important" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in oklab, var(--primary) 45%, transparent) !important" },
    ".cm-matchingBracket": { backgroundColor: "color-mix(in oklab, var(--primary) 25%, transparent)", outline: "1px solid color-mix(in oklab, var(--primary) 45%, transparent)" },
    ".cm-foldGutter": { width: "12px" },
    ".cm-scroller": { overflow: "auto" },
  }, { dark: true });
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "javascript": return javascript({ jsx: true, typescript: true });
    case "html": return html();
    case "css": return css();
    case "json": return json();
    case "python": return python();
    case "rust": return rust();
    case "sql": return sql();
    case "xml": return xml();
    case "cpp": return cpp();
    case "java": return java();
    case "php": return php();
    case "markdown": return markdown();
    default: return [];
  }
}

interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
  className?: string;
  showToolbar?: boolean;
}

export function CodeEditor({ value, language = "plaintext", readOnly = false, onChange, onSave, className, showToolbar = true }: CodeEditorProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  // Compartments for dynamic reconfiguration
  const lineNumCompartment = useRef(new Compartment());
  const wrapCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  // Create the editor once (only re-create if language or readOnly changes)
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      lineNumCompartment.current.of(lineNumbersExt()),
      wrapCompartment.current.of(EditorView.lineWrapping),
      themeCompartment.current.of(makeDarkTheme(DEFAULT_FONT_SIZE)),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      bracketMatching(),
      foldGutter(),
      indentOnInput(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
        {
          key: "Mod-s",
          run: () => { onSaveRef.current?.(); return true; },
        },
      ]),
      getLanguageExtension(language),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    } else {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      );
    }

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  // Sync external value changes into the editor without recreating it
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Reconfigure line numbers
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumCompartment.current.reconfigure(
        showLineNumbers ? lineNumbersExt() : []
      ),
    });
  }, [showLineNumbers]);

  // Reconfigure word wrap
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartment.current.reconfigure(
        wordWrap ? EditorView.lineWrapping : []
      ),
    });
  }, [wordWrap]);

  // Reconfigure font size
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(makeDarkTheme(fontSize)),
    });
  }, [fontSize]);

  const handleFontSizeDown = () => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev as typeof FONT_SIZES[number]);
      if (idx > 0) return FONT_SIZES[idx - 1];
      return prev;
    });
  };

  const handleFontSizeUp = () => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev as typeof FONT_SIZES[number]);
      if (idx >= 0 && idx < FONT_SIZES.length - 1) return FONT_SIZES[idx + 1];
      return prev;
    });
  };

  const toolbarBtnClass = (active: boolean) => cn(
    "filter-pill min-h-0 p-1 transition-colors",
    active
      ? "text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {showToolbar && (
        <div className="tab-shell flex items-center justify-between px-3 py-0.5 shrink-0">
          <div className="flex items-center gap-1">
            <div className="surface-panel flex items-center gap-0 rounded-full px-0.5 py-0.5">
              <button
                onClick={() => setShowLineNumbers(!showLineNumbers)}
                title={t("detail.lineNumbers")}
                className={toolbarBtnClass(showLineNumbers)}
              >
                <Hash size={12} />
              </button>
              <button
                onClick={() => setWordWrap(!wordWrap)}
                title={t("detail.wordWrap")}
                className={toolbarBtnClass(wordWrap)}
              >
                <TextColumns size={12} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="surface-panel flex items-center gap-0 rounded-full px-0.5 py-0.5">
              <button
                onClick={handleFontSizeDown}
                disabled={fontSize <= FONT_SIZES[0]}
                title={t("detail.fontSizeDown")}
                className={cn(toolbarBtnClass(false), "disabled:opacity-30 disabled:cursor-not-allowed")}
              >
                <Minus size={12} />
              </button>
              <span className="min-w-[1.75rem] text-center text-2xs font-medium text-muted-foreground tabular-nums select-none leading-none">
                {fontSize}
              </span>
              <button
                onClick={handleFontSizeUp}
                disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                title={t("detail.fontSizeUp")}
                className={cn(toolbarBtnClass(false), "disabled:opacity-30 disabled:cursor-not-allowed")}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
