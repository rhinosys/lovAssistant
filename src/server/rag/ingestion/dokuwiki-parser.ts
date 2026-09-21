/**
 * Parser transforming DokuWiki wikitext into clean standard Markdown.
 */

export interface ParsedDokuWikiPage {
  title: string;
  markdown: string;
  headings: string[];
}

export const extractTitleFromWikitext = (wikitext: string, fallbackId: string): string => {
  const h1Match = /^======\s*(.*?)\s*======/m.exec(wikitext);
  if (h1Match && h1Match[1].trim()) {
    return h1Match[1].trim();
  }
  const h2Match = /^=====\s*(.*?)\s*=====/m.exec(wikitext);
  if (h2Match && h2Match[1].trim()) {
    return h2Match[1].trim();
  }
  const parts = fallbackId.split(":");
  const lastPart = parts[parts.length - 1];
  return lastPart.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const parseDokuWikiToMarkdown = (wikitext: string, pageId = "page"): ParsedDokuWikiPage => {
  const headings: string[] = [];
  const title = extractTitleFromWikitext(wikitext, pageId);

  let md = wikitext;

  // 1. Convert Headers
  // DokuWiki: ====== H1 ======, ===== H2 =====, ==== H3 ====, === H4 ===, == H5 ==
  md = md.replace(/^======\s*(.*?)\s*======\s*$/gm, (_, text) => {
    const trimmed = text.trim();
    headings.push(trimmed);
    return `# ${trimmed}`;
  });

  md = md.replace(/^=====\s*(.*?)\s*=====\s*$/gm, (_, text) => {
    const trimmed = text.trim();
    headings.push(trimmed);
    return `## ${trimmed}`;
  });

  md = md.replace(/^====\s*(.*?)\s*====\s*$/gm, (_, text) => {
    const trimmed = text.trim();
    headings.push(trimmed);
    return `### ${trimmed}`;
  });

  md = md.replace(/^===\s*(.*?)\s*===\s*$/gm, (_, text) => {
    const trimmed = text.trim();
    headings.push(trimmed);
    return `#### ${trimmed}`;
  });

  md = md.replace(/^==\s*(.*?)\s*==\s*$/gm, (_, text) => {
    const trimmed = text.trim();
    headings.push(trimmed);
    return `##### ${trimmed}`;
  });

  // 2. Code blocks <code lang>...</code> or <code>...</code>
  md = md.replace(/<code\s*([a-zA-Z0-9_-]*)?>([\s\S]*?)<\/code>/gi, (_, lang, code) => {
    const language = lang ? lang.trim() : "";
    return `\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n`;
  });

  // 3. Inline code ''code''
  md = md.replace(/''([^'\n]+)''/g, "`$1`");

  // 4. Bold **text** (already standard markdown)
  // 5. Italic //text// -> *text*
  md = md.replace(/(^|[^\w/:])\/\/([^\n/]+?)\/\/([^\w/]|$)/g, "$1*$2*$3");

  // 6. Underline __text__ -> <u>text</u>
  md = md.replace(/__([^\n_]+)__/g, "<u>$1</u>");

  // 7. Strikethrough <del>text</del> -> ~~text~~
  md = md.replace(/<del>([\s\S]*?)<\/del>/gi, "~~$1~~");

  // 8. Images {{namespace:file.jpg?params|alt}} -> ![alt](absolute fetch.php URL)
  // DokuWiki media refs are internal namespace paths (e.g. ":equipement:foo.jpg"), not URLs —
  // they must be resolved through lib/exe/fetch.php?media=<namespace:file> to be fetchable.
  md = md.replace(/\{\{([^|\n]+?)(?:\|([^}\n]*))?\}\}/g, (_, mediaRef, alt) => {
    const cleanRef = mediaRef.split("?")[0].trim().replace(/^:/, "");
    const altText = alt ? alt.trim() : "image";

    // External images (already a full URL) pass through unchanged; only bare wiki namespace
    // refs need resolving via fetch.php.
    if (/^https?:\/\//.test(cleanRef)) {
      return `![${altText}](${cleanRef})`;
    }

    const mediaUrl = `https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=${encodeURIComponent(cleanRef)}`;
    return `![${altText}](${mediaUrl})`;
  });

  // 9. Links [[url|label]] or [[url]]
  md = md.replace(/\[\[([^|\n]+?)(?:\|([^\]\n]*))?\]\]/g, (_, target, label) => {
    const cleanTarget = target.trim();
    const linkText = label ? label.trim() : cleanTarget;

    if (cleanTarget.startsWith("http://") || cleanTarget.startsWith("https://")) {
      return `[${linkText}](${cleanTarget})`;
    }

    const canonicalUrl = `https://labovilleurbanne.fr/dokuwiki/${cleanTarget}`;
    return `[${linkText}](${canonicalUrl})`;
  });

  // 10. Unordered & Ordered Lists
  // DokuWiki: "  - item" -> "1. item" (ordered), "  * item" -> "- item" (unordered)
  md = md.replace(/^(\s*)-\s+/gm, "$11. ");
  md = md.replace(/^(\s*)\*\s+/gm, "$1- ");

  // 11. Clean redundant blank lines (max 2 consecutive)
  md = md.replace(/\n{3,}/g, "\n\n").trim();

  return {
    title,
    markdown: md,
    headings,
  };
};
