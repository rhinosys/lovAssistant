import { yeswikiTools } from "./tools";
import { YesWikiClient } from "./yeswiki-client";

export class AdminLovaMcpClient {
  private yeswikiClient: YesWikiClient;

  constructor(client = new YesWikiClient()) {
    this.yeswikiClient = client;
  }

  getAvailableTools() {
    return Object.values(yeswikiTools).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async executeTool(toolName: string, params: Record<string, unknown>) {
    const tool = yeswikiTools[toolName];
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    const validated = tool.parameters.parse(params);
    return tool.execute(validated, this.yeswikiClient);
  }
}

export const mcpClient = new AdminLovaMcpClient();
