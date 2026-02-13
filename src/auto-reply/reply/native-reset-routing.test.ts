import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome as withTempHomeBase } from "../../../test/helpers/temp-home.js";

vi.mock("../../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  compactEmbeddedPiSession: vi.fn(),
  runEmbeddedPiAgent: vi.fn(),
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
}));

const usageMocks = vi.hoisted(() => ({
  loadProviderUsageSummary: vi.fn().mockResolvedValue({
    updatedAt: 0,
    providers: [],
  }),
  formatUsageSummaryLine: vi.fn().mockReturnValue("📊 Usage: Claude 80% left"),
  resolveUsageProviderId: vi.fn((provider: string) => provider.split("/")[0]),
}));

vi.mock("../../infra/provider-usage.js", () => usageMocks);

const modelCatalogMocks = vi.hoisted(() => ({
  loadModelCatalog: vi.fn().mockResolvedValue([
    {
      provider: "anthropic",
      id: "claude-opus-4-5",
      name: "Claude Opus 4.5",
      contextWindow: 200000,
    },
  ]),
  resetModelCatalogCacheForTest: vi.fn(),
}));

vi.mock("../../agents/model-catalog.js", () => modelCatalogMocks);

import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import { getReplyFromConfig } from "../reply.js";

const webMocks = vi.hoisted(() => ({
  webAuthExists: vi.fn().mockResolvedValue(true),
  getWebAuthAgeMs: vi.fn().mockReturnValue(120_000),
  readWebSelfId: vi.fn().mockReturnValue({ e164: "+1999" }),
}));

vi.mock("../../web/session.js", () => webMocks);

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(
    async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockClear();
      return await fn(home);
    },
    { prefix: "openclaw-native-reset-routing-" },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("native /new routing", () => {
  it("prefers command target session route when OriginatingTo mismatches target chat", async () => {
    await withTempHome(async (home) => {
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "hello" }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      const res = await getReplyFromConfig(
        {
          Body: "/new",
          RawBody: "/new",
          CommandBody: "/new",
          From: "telegram:group:-1001234567890:topic:99",
          To: "slash:12345",
          ChatType: "group",
          Provider: "telegram",
          Surface: "telegram",
          CommandAuthorized: true,
          CommandSource: "native",
          SessionKey: "telegram:slash:12345",
          CommandTargetSessionKey: "agent:main:telegram:group:-1001234567890:topic:99",
          OriginatingChannel: "telegram",
          OriginatingTo: "telegram:12345",
        },
        {},
        {
          agents: {
            defaults: {
              model: "anthropic/claude-opus-4-5",
              workspace: join(home, "openclaw"),
            },
          },
          channels: {
            telegram: {
              allowFrom: ["*"],
            },
          },
          session: {
            store: join(tmpdir(), `openclaw-session-test-${Date.now()}.json`),
          },
        },
      );

      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toBe("hello");
      expect(runEmbeddedPiAgent).toHaveBeenCalledOnce();
      const call = vi.mocked(runEmbeddedPiAgent).mock.calls[0]?.[0];
      expect(call?.messageTo).toBe("telegram:-1001234567890");
      expect(call?.messageTo).not.toBe("telegram:12345");
      expect(call?.messageTo).not.toBe("slash:12345");
      expect(call?.prompt ?? "").toContain("A new session was started via /new or /reset");
    });
  });
});
