#!/usr/bin/env node
import { runStdioServer } from "./server";

// Load local .env if available
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // .env file is optional
}

runStdioServer().catch((error) => {
  console.error("Failed to start YesWiki MCP server:", error);
  process.exit(1);
});
