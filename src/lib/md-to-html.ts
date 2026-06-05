export function mdToHtml(text: string): string {
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  let lines = escaped.split("\n");
  let html: string[] = [];
  let i = 0;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  while (i < lines.length) {
    let line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html.push("<pre><code>" + codeBuffer.join("\n") + "</code></pre>");
        codeBuffer = [];
        inCodeBlock = false;
        i++;
        continue;
      }
      inCodeBlock = true;
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      i++;
      continue;
    }

    if (line.startsWith("### ")) { html.push("<h3>" + inlineMd(line.slice(4)) + "</h3>"); i++; continue; }
    if (line.startsWith("## ")) { html.push("<h2>" + inlineMd(line.slice(3)) + "</h2>"); i++; continue; }
    if (line.startsWith("# ")) { html.push("<h1>" + inlineMd(line.slice(2)) + "</h1>"); i++; continue; }

    if (line.startsWith("> ")) {
      let quotes: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) { quotes.push(inlineMd(lines[i].slice(2))); i++; }
      html.push("<blockquote>" + quotes.join("<br>") + "</blockquote>");
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      let items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) { items.push("<li>" + inlineMd(lines[i].slice(2)) + "</li>"); i++; }
      html.push("<ul>" + items.join("") + "</ul>");
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      let items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push("<li>" + inlineMd(lines[i].replace(/^\d+\.\s/, "")) + "</li>"); i++; }
      html.push("<ol>" + items.join("") + "</ol>");
      continue;
    }

    if (line.startsWith("|")) {
      let tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) { tableLines.push(lines[i]); i++; }
      if (tableLines.length >= 2) {
        const headerCells = splitTableRow(tableLines[0]);
        const bodyRows = tableLines.slice(2);
        let tableHtml = "<table><thead><tr>";
        headerCells.forEach((cell) => { tableHtml += "<th>" + inlineMd(cell.trim()) + "</th>"; });
        tableHtml += "</tr></thead><tbody>";
        bodyRows.forEach((row) => {
          const cells = splitTableRow(row);
          tableHtml += "<tr>";
          cells.forEach((cell) => { tableHtml += "<td>" + inlineMd(cell.trim()) + "</td>"; });
          tableHtml += "</tr>";
        });
        tableHtml += "</tbody></table>";
        html.push(tableHtml);
      }
      continue;
    }

    if (line.trim() === "---") { html.push("<hr>"); i++; continue; }
    if (line.trim() === "") { i++; continue; }

    html.push("<p>" + inlineMd(line) + "</p>");
    i++;
  }

  if (inCodeBlock) html.push("<pre><code>" + codeBuffer.join("\n") + "</code></pre>");
  return html.join("\n");
}

function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function splitTableRow(line: string): string[] {
  const trimmed = line.replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

export function htmlToMd(html: string): string {
  let text = html
    .replace(/<h2>(.*?)<\/h2>/g, "## $1\n")
    .replace(/<h3>(.*?)<\/h3>/g, "### $1\n")
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "*$1*")
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, "```\n$1\n```\n")
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, function (_s: string, c: string) { return c.replace(/<br>/g, "\n").replace(/^(.*)$/gm, "> $1"); })
    .replace(/<ul>([\s\S]*?)<\/ul>/g, function (_s: string, c: string) { return c.replace(/<li>(.*?)<\/li>/g, "- $1\n"); })
    .replace(/<ol>([\s\S]*?)<\/ol>/g, function (_s: string, c: string) { return c.replace(/<li>(.*?)<\/li>/g, (_m: string, c2: string, idx: number) => (idx + 1) + ". " + c2 + "\n"); })
    .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<a\s+href="(.+?)".*?>(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<hr\s*\/?>/g, "---\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}