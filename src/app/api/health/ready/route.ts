import { NextResponse } from "next/server";
import { checkDbHealth } from "@/server/persistence";
import { checkAllProvidersHealth } from "@/server/model";

export async function GET() {
  const [dbStatus, providersStatus] = await Promise.all([
    checkDbHealth(),
    checkAllProvidersHealth(),
  ]);

  const isHealthy = dbStatus.healthy && providersStatus.ollama.healthy;

  const payload = {
    status: isHealthy ? "ok" : "unhealthy",
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        status: dbStatus.healthy ? "healthy" : "unhealthy",
        latencyMs: dbStatus.latencyMs,
        ...(dbStatus.error ? { error: dbStatus.error } : {}),
      },
      ollama: {
        status: providersStatus.ollama.healthy ? "healthy" : "unhealthy",
        latencyMs: providersStatus.ollama.latencyMs,
        ...(providersStatus.ollama.installedModels
          ? { models: providersStatus.ollama.installedModels }
          : {}),
        ...(providersStatus.ollama.error ? { error: providersStatus.ollama.error } : {}),
      },
      mistral: {
        status: providersStatus.mistral.healthy ? "healthy" : "unhealthy",
        latencyMs: providersStatus.mistral.latencyMs,
        ...(providersStatus.mistral.installedModels
          ? { models: providersStatus.mistral.installedModels }
          : {}),
        ...(providersStatus.mistral.error ? { error: providersStatus.mistral.error } : {}),
      },
    },
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
  });
}
