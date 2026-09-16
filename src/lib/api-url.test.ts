import { describe, it, expect, afterEach } from "vitest";
import { apiUrl } from "./api-url";

describe("apiUrl", () => {
  const originalValue = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalValue;
    }
  });

  it("returns the path unchanged when no base path is set", () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(apiUrl("/api/threads")).toBe("/api/threads");
  });

  it("returns the path unchanged when the base path is an empty string", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    expect(apiUrl("/api/threads")).toBe("/api/threads");
  });

  it("prefixes the path with the configured base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/assistant";
    expect(apiUrl("/api/threads")).toBe("/assistant/api/threads");
  });

  it("strips a trailing slash from the base path before prefixing", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/assistant/";
    expect(apiUrl("/api/threads")).toBe("/assistant/api/threads");
  });
});
