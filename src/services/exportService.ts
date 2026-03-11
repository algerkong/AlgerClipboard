import { exportData } from "@/services/clipboardService";

interface ExportEntry {
  id: string;
  content_type: string;
  text_content: string | null;
  created_at: string;
  source_app: string | null;
  tags: string[];
  is_favorite: boolean;
  ai_summary: string | null;
}

function parseExportData(json: string): ExportEntry[] {
  const data = JSON.parse(json);
  return data.entries || [];
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export async function exportAsCSV(): Promise<string> {
  const json = await exportData();
  const entries = parseExportData(json);
  const header = "id,content_type,text_content,created_at,source_app,tags,is_favorite\n";
  const rows = entries.map((e) =>
    [
      e.id,
      e.content_type,
      escapeCSV(e.text_content || ""),
      e.created_at,
      e.source_app || "",
      escapeCSV((e.tags || []).join(";")),
      e.is_favorite ? "true" : "false",
    ].join(",")
  );
  return header + rows.join("\n");
}

export async function exportAsText(): Promise<string> {
  const json = await exportData();
  const entries = parseExportData(json);
  const sections = entries
    .filter((e) => e.text_content)
    .map((e) => {
      const meta = `[${e.created_at}] ${e.source_app || "Unknown"}`;
      return `${meta}\n${e.text_content}\n${"─".repeat(40)}`;
    });
  return sections.join("\n\n");
}

export async function exportAsHTML(): Promise<string> {
  const json = await exportData();
  const entries = parseExportData(json);
  const escapeHTML = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const rows = entries
    .map(
      (e) => `<tr>
  <td>${escapeHTML(e.content_type)}</td>
  <td><pre>${escapeHTML(e.text_content || "")}</pre></td>
  <td>${escapeHTML(e.created_at)}</td>
  <td>${escapeHTML(e.source_app || "")}</td>
  <td>${escapeHTML((e.tags || []).join(", "))}</td>
</tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AlgerClipboard Export</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-all; max-width: 500px; }
</style>
</head>
<body>
<h1>AlgerClipboard Export</h1>
<p>Exported: ${new Date().toISOString()}</p>
<table>
<thead><tr><th>Type</th><th>Content</th><th>Created</th><th>Source</th><th>Tags</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;
}
