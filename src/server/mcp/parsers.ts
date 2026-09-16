/**
 * Utility parsers for YesWiki markup, HTML text cleaning, and diff generation.
 */

export function cleanHtml(html: string): string {
  if (!html) return "";

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseYesWikiMarkupToMarkdown(wikitext: string): string {
  if (!wikitext) return "";

  let md = wikitext;

  // YesWiki Headers
  md = md.replace(/^======\s*(.*?)\s*======$/gm, "# $1");
  md = md.replace(/^=====\s*(.*?)\s*=====$/gm, "## $1");
  md = md.replace(/^====\s*(.*?)\s*====$/gm, "### $1");
  md = md.replace(/^===\s*(.*?)\s*===$/gm, "#### $1");
  md = md.replace(/^==\s*(.*?)\s*==$/gm, "##### $1");

  // Bold & Italic
  // YesWiki uses **bold** and //italic//
  md = md.replace(/\/\/(.*?)\/\//g, "*$1*");
  md = md.replace(/__(.*?)__/g, "<u>$1</u>");

  // YesWiki Links: [[URL Description]] or [[PageName Description]] or [[URL]]
  md = md.replace(/\[\[([^\s\]]+)\s+([^\]]+)\]\]/g, "[$2]($1)");
  md = md.replace(/\[\[([^\s\]]+)\]\]/g, "[$1]($1)");

  // YesWiki Bullet lists
  md = md.replace(/^\t\*\s+/gm, "- ");
  md = md.replace(/^\t-\s+/gm, "- ");

  return md.trim();
}

export function generateSimpleDiff(oldText: string, newText: string): string {
  const oldLines = oldText ? oldText.split("\n") : [];
  const newLines = newText ? newText.split("\n") : [];

  const diff: string[] = ["--- Original", "+++ Proposed"];

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      diff.push(`+ ${newLine}`);
    } else if (newLine === undefined) {
      diff.push(`- ${oldLine}`);
    } else if (oldLine !== newLine) {
      diff.push(`- ${oldLine}`);
      diff.push(`+ ${newLine}`);
    } else {
      diff.push(`  ${oldLine}`);
    }
  }

  return diff.join("\n");
}
