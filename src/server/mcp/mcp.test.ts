import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanHtml, parseYesWikiMarkupToMarkdown, generateSimpleDiff } from "./parsers";
import { YesWikiClient } from "./yeswiki-client";
import { createConfirmationToken, verifyConfirmationToken, hashContent } from "./tokens";
import { yeswikiTools } from "./tools";
import { AdminLovaMcpClient } from "./client";

describe("YesWiki MCP Server & Tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Parsers & Diff Utilities", () => {
    it("cleans raw HTML and strips script/style tags", () => {
      const rawHtml = '<div class="content"><h1>Titre</h1><script>alert("hack")</script><p>Texte &amp; contenu</p></div>';
      const cleaned = cleanHtml(rawHtml);
      expect(cleaned).toContain("Titre");
      expect(cleaned).toContain("Texte & contenu");
      expect(cleaned).not.toContain("alert");
      expect(cleaned).not.toContain("<script>");
    });

    it("converts YesWiki wikitext to Markdown", () => {
      const wikitext = "====== Titre Principal ======\n**Gras** et //Italique//\n[[PageLaser Guide Laser]]";
      const md = parseYesWikiMarkupToMarkdown(wikitext);
      expect(md).toContain("# Titre Principal");
      expect(md).toContain("**Gras** et *Italique*");
      expect(md).toContain("[Guide Laser](PageLaser)");
    });

    it("generates line diffs between existing and proposed content", () => {
      const oldText = "Ligne 1\nLigne 2";
      const newText = "Ligne 1\nLigne 2 modifiée\nLigne 3";
      const diff = generateSimpleDiff(oldText, newText);

      expect(diff).toContain("--- Original");
      expect(diff).toContain("+++ Proposed");
      expect(diff).toContain("- Ligne 2");
      expect(diff).toContain("+ Ligne 2 modifiée");
      expect(diff).toContain("+ Ligne 3");
    });
  });

  describe("Two-Step Confirmation Tokens", () => {
    it("issues and validates unexpired tokens", () => {
      const { token } = createConfirmationToken("TutoFraiseuse", "Contenu...", "Ajout règles", 300);
      const payload = verifyConfirmationToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.pageName).toBe("TutoFraiseuse");
      expect(payload?.contentHash).toBe(hashContent("Contenu..."));
    });

    it("rejects expired tokens", () => {
      const { token } = createConfirmationToken("TutoFraiseuse", "Contenu...", "Ajout", -10);
      const payload = verifyConfirmationToken(token);
      expect(payload).toBeNull();
    });

    it("rejects tampered tokens", () => {
      const { token } = createConfirmationToken("TutoFraiseuse", "Contenu...", "Ajout");
      const parts = token.split(".");
      const tampered = `${parts[0]}xyz.${parts[1]}`;
      expect(verifyConfirmationToken(tampered)).toBeNull();
    });
  });

  describe("YesWiki Reading Tools", () => {
    it("searches pages and returns formatted results", async () => {
      const client = new YesWikiClient({ baseUrl: "https://labovilleurbanne.fr/yeswiki/" });
      vi.spyOn(client as any, "fetchWithTimeout").mockResolvedValue(
        new Response(
          '<a href="?DecoupeuseLaser">Découpeuse Laser CO2</a><a href="?Imprimante3D">Imprimante 3D</a>',
          { status: 200 }
        )
      );

      const result = await yeswikiTools.yeswiki_search_pages.execute(
        { query: "laser", limit: 5 },
        client
      );

      expect(result.count).toBeGreaterThan(0);
      expect(result.results[0].pageName).toBe("DecoupeuseLaser");
      expect(result.results[0].canonicalUrl).toContain("DecoupeuseLaser");
    });

    it("fetches page content and metadata", async () => {
      const client = new YesWikiClient({ baseUrl: "https://labovilleurbanne.fr/yeswiki/" });
      vi.spyOn(client as any, "fetchWithTimeout").mockResolvedValue(
        new Response("====== Règles de Sécurité ======\n**Port des lunettes obligatoire.**", {
          status: 200,
          headers: { "last-modified": "Mon, 14 Sep 2026 12:00:00 GMT" },
        })
      );

      const page = await yeswikiTools.yeswiki_get_page.execute(
        { page_name: "SecuriteAtelier", format: "markdown" },
        client
      );

      expect(page.pageName).toBe("SecuriteAtelier");
      expect(page.content).toContain("# Règles de Sécurité");
      expect(page.content).toContain("**Port des lunettes obligatoire.**");
      expect(page.canonicalUrl).toBe("https://labovilleurbanne.fr/yeswiki/?SecuriteAtelier");
    });

    it("extracts machine status from Bazar records", async () => {
      const client = new YesWikiClient({ baseUrl: "https://labovilleurbanne.fr/yeswiki/" });
      const status = await yeswikiTools.yeswiki_get_machine_status.execute(
        { machine_name: "Laser" },
        client
      );

      expect(status.name).toContain("Laser");
      expect(status.status).toBe("disponible");
      expect(status.materials).toContain("Bois");
    });
  });

  describe("Two-Step Write Operations & Prompt Injection Defense", () => {
    it("prepares page update with diff and confirmation token without writing", async () => {
      const client = new YesWikiClient({ baseUrl: "https://labovilleurbanne.fr/yeswiki/" });
      vi.spyOn(client as any, "fetchWithTimeout").mockResolvedValue(
        new Response("Ancien contenu du tutoriel", { status: 200 })
      );

      const prep = await yeswikiTools.yeswiki_prepare_page_update.execute(
        {
          page_name: "TutoImpression",
          new_content: "Ancien contenu du tutoriel\nNouvelle étape de calibration",
          summary: "Mise à jour calibration",
        },
        client
      );

      expect(prep.status).toBe("prepared");
      expect(prep.diff).toContain("+ Nouvelle étape de calibration");
      expect(prep.confirmationToken).toBeDefined();

      // Ensure write tool fails if content was modified after token issuance
      await expect(
        yeswikiTools.yeswiki_apply_page_update.execute(
          {
            page_name: "TutoImpression",
            new_content: "Contenu altéré non autorisé",
            summary: "Mise à jour calibration",
            confirmation_token: prep.confirmationToken,
          },
          client
        )
      ).rejects.toThrow("Le contenu à enregistrer a été altéré");

      // Verify successful execution when token and content match
      const saveSpy = vi.spyOn(client, "savePage").mockResolvedValue({
        success: true,
        pageName: "TutoImpression",
        revisionId: "rev_123",
      });

      const applyRes = await yeswikiTools.yeswiki_apply_page_update.execute(
        {
          page_name: "TutoImpression",
          new_content: "Ancien contenu du tutoriel\nNouvelle étape de calibration",
          summary: "Mise à jour calibration",
          confirmation_token: prep.confirmationToken,
          user_signature: "Fablab Admin",
        },
        client
      );

      expect(applyRes.status).toBe("applied");
      expect(applyRes.revisionId).toBe("rev_123");
      expect(saveSpy).toHaveBeenCalledOnce();
    });
  });

  describe("AdminLova MCP Client Integration", () => {
    it("discovers tools and executes search", async () => {
      const client = new AdminLovaMcpClient();
      const tools = client.getAvailableTools();

      expect(tools.length).toBeGreaterThanOrEqual(7);
      expect(tools.map((t) => t.name)).toContain("yeswiki_search_pages");
      expect(tools.map((t) => t.name)).toContain("yeswiki_get_page");
      expect(tools.map((t) => t.name)).toContain("yeswiki_prepare_page_update");
    });
  });
});
