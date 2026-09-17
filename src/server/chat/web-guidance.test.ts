import { describe, expect, it } from "vitest";
import { parseWebGuidance } from "./web-guidance";

describe("real web provenance", () => {
  const execution = { type: "tool.execution", name: "web_search" };
  const message = { type: "message.output", content: [
    { type: "text", text: "Voici les étapes. [Lien inventé](https://invented.example)" },
    { type: "tool_reference", tool: "web_search", url: "https://manual.example/guide", title: "Manuel officiel" },
  ] };
  it("requires both execution and actual tool references", () => {
    expect(parseWebGuidance([message])).toBeNull();
    expect(parseWebGuidance([execution, { type: "message.output", content: [{ type: "text", text: "Une réponse sans sources" }] }])).toBeNull();
  });
  it("labels external advice and uses only tool-provided URLs", () => {
    const answer = parseWebGuidance([execution, message]);
    expect(answer).toContain("Piste trouvée sur le web");
    expect(answer).toContain("https://manual.example/guide");
    expect(answer).not.toContain("https://invented.example");
  });
});
