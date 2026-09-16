import { describe, it, expect } from "vitest";
import { parseDokuWikiToMarkdown, extractTitleFromWikitext } from "./dokuwiki-parser";

describe("DokuWiki to Markdown Parser", () => {
  it("converts DokuWiki headers to standard markdown headers", () => {
    const wikitext = `====== Titre Principal ======
===== Section 1 =====
==== Sous-section 1.1 ====
=== Sous-sous-section ===
== Niveau 5 ==`;

    const result = parseDokuWikiToMarkdown(wikitext, "start");
    expect(result.title).toBe("Titre Principal");
    expect(result.headings).toContain("Titre Principal");
    expect(result.headings).toContain("Section 1");
    expect(result.markdown).toContain("# Titre Principal");
    expect(result.markdown).toContain("## Section 1");
    expect(result.markdown).toContain("### Sous-section 1.1");
    expect(result.markdown).toContain("#### Sous-sous-section");
    expect(result.markdown).toContain("##### Niveau 5");
  });

  it("converts links and images properly", () => {
    const wikitext = `[[asso:local|Règles du local]]
[[equipement:decoupe_laser:start]]
[[https://github.com/fablab|GitHub Fablab]]
{{https://labovilleurbanne.fr/photo.jpg?600|Photo du Fablab}}`;

    const result = parseDokuWikiToMarkdown(wikitext, "test");
    expect(result.markdown).toContain("[Règles du local](https://labovilleurbanne.fr/dokuwiki/asso:local)");
    expect(result.markdown).toContain("[equipement:decoupe_laser:start](https://labovilleurbanne.fr/dokuwiki/equipement:decoupe_laser:start)");
    expect(result.markdown).toContain("[GitHub Fablab](https://github.com/fablab)");
    expect(result.markdown).toContain("![Photo du Fablab](https://labovilleurbanne.fr/photo.jpg)");
  });

  it("converts inline styling and lists", () => {
    const wikitext = `**Gras** et //Italique// et ''Code inline'' et __Souligné__
  * Puce 1
  * Puce 2
  - Num 1
  - Num 2`;

    const result = parseDokuWikiToMarkdown(wikitext, "test");
    expect(result.markdown).toContain("**Gras**");
    expect(result.markdown).toContain("*Italique*");
    expect(result.markdown).toContain("`Code inline`");
    expect(result.markdown).toContain("<u>Souligné</u>");
    expect(result.markdown).toContain("- Puce 1");
    expect(result.markdown).toContain("1. Num 1");
  });

  it("extracts clean title with fallback", () => {
    expect(extractTitleFromWikitext("====== Mon Super Titre ======", "page")).toBe("Mon Super Titre");
    expect(extractTitleFromWikitext("Du texte sans titre", "equipement:lulzbot-taz")).toBe("Lulzbot Taz");
  });
});
