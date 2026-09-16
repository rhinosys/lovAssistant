import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { YesWikiClient } from "./yeswiki-client";
import { yeswikiTools } from "./tools";
import { logger } from "../observability/logger";

export function createYesWikiMcpServer(client = new YesWikiClient()) {
  const server = new Server(
    {
      name: "yeswiki-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // 1. Tool discovery
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Object.values(yeswikiTools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: "object",
        properties: (tool.parameters as any).shape
          ? Object.fromEntries(
              Object.entries((tool.parameters as any).shape).map(([k, v]: [string, any]) => [
                k,
                { type: v._def.typeName === "ZodNumber" ? "number" : "string", description: v.description },
              ])
            )
          : {},
      },
    }));

    return { tools };
  });

  // 2. Tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = yeswikiTools[toolName];

    if (!tool) {
      throw new Error(`Outil MCP inconnu: '${toolName}'`);
    }

    try {
      const parsedParams = tool.parameters.parse(request.params.arguments || {});
      const result = await tool.execute(parsedParams, client);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur d'exécution de l'outil";
      logger.error("MCP tool execution error", { toolName, error: message });
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Erreur: ${message}`,
          },
        ],
      };
    }
  });

  // 3. Resource discovery
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "yeswiki://bazar/machines",
          name: "Catalogue des machines du Fablab",
          description: "Inventaire structuré des équipements, statuts et guides d'utilisation",
          mimeType: "application/json",
        },
        {
          uri: "yeswiki://recent-changes",
          name: "Dernières modifications du Wiki",
          description: "Flux en temps réel des pages créées ou modifiées",
          mimeType: "application/json",
        },
      ],
    };
  });

  // 4. Resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === "yeswiki://bazar/machines") {
      const machines = await client.getBazarEntries("machines");
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(machines, null, 2),
          },
        ],
      };
    }

    if (uri === "yeswiki://recent-changes") {
      const changes = await client.listRecentChanges(20);
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(changes, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith("yeswiki://page/")) {
      const pageName = uri.replace("yeswiki://page/", "");
      const page = await client.getPage(pageName, "markdown");
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: page.content,
          },
        ],
      };
    }

    throw new Error(`Ressource non trouvée: '${uri}'`);
  });

  return server;
}

export async function runStdioServer() {
  const server = createYesWikiMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("YesWiki MCP Server running on stdio");
}
