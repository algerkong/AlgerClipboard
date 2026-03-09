import { useMemo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { codeToHtml } from "shiki";
import mermaid from "mermaid";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

mermaid.initialize({ startOnLoad: false, theme: "dark", darkMode: true });

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, code).then(({ svg }) => setSvg(svg)).catch(() => setSvg(""));
  }, [code]);

  if (!svg) return <pre className="text-xs text-muted-foreground">{code}</pre>;
  return <div ref={ref} className="my-3 flex justify-center [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [highlighted, setHighlighted] = useState("");
  const [copied, setCopied] = useState(false);
  const lang = className?.replace("language-", "") || "";
  const code = String(children).replace(/\n$/, "");
  const isMermaid = lang === "mermaid";

  useEffect(() => {
    if (isMermaid) return;
    codeToHtml(code, {
      lang: lang || "text",
      theme: "vitesse-dark",
    }).then(setHighlighted).catch(() => setHighlighted(""));
  }, [code, lang, isMermaid]);

  if (isMermaid) return <MermaidBlock code={code} />;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative my-3 rounded-xl border border-border/40 bg-zinc-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20">
        <span className="text-2xs font-medium text-muted-foreground/60 uppercase tracking-wider">
          {lang || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-2xs text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      {highlighted ? (
        <div
          className="overflow-x-auto p-3 text-sm [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 text-sm font-mono">{code}</pre>
      )}
    </div>
  );
}

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [rehypeKatex, rehypeRaw], []);

  return (
    <div className={cn("markdown-preview", className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[0.85em] font-mono text-primary/90" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{String(children)}</CodeBlock>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border-b border-border/40 bg-muted/20 px-3 py-2 text-left text-xs font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="border-b border-border/20 px-3 py-2">{children}</td>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-3 border-l-3 border-primary/40 pl-4 text-muted-foreground italic">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-6 border-border/30" />;
          },
          input({ checked, ...props }) {
            return <input type="checkbox" checked={checked} readOnly className="mr-2 accent-primary" {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
