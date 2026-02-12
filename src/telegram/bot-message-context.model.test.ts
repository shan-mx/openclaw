import { describe, expect, it, vi } from "vitest";
import { buildTelegramMessageContext } from "./bot-message-context.js";

type GroupConfigInput = {
  model?: string;
};

type TopicConfigInput = {
  model?: string;
};

const buildContext = async (params: {
  cfg: Record<string, unknown>;
  groupConfig?: GroupConfigInput;
  topicConfig?: TopicConfigInput;
  chat?: Record<string, unknown>;
  messageThreadId?: number;
}) =>
  await buildTelegramMessageContext({
    primaryCtx: {
      message: {
        message_id: 1,
        chat: params.chat ?? { id: -100123, type: "supergroup", title: "Group" },
        date: 1_700_000_000,
        text: "@bot hello",
        ...(typeof params.messageThreadId === "number"
          ? { message_thread_id: params.messageThreadId }
          : {}),
        from: { id: 42, first_name: "Alice" },
      },
      me: { id: 7, username: "bot" },
    } as never,
    allMedia: [],
    storeAllowFrom: [],
    options: { forceWasMentioned: true },
    bot: {
      api: {
        sendChatAction: vi.fn(),
        setMessageReaction: vi.fn(),
      },
    } as never,
    cfg: params.cfg as never,
    account: { accountId: "default" } as never,
    historyLimit: 0,
    groupHistories: new Map(),
    dmPolicy: "open",
    allowFrom: [],
    groupAllowFrom: [],
    ackReactionScope: "off",
    logger: { info: vi.fn() },
    resolveGroupActivation: () => true,
    resolveGroupRequireMention: () => false,
    resolveTelegramGroupConfig: () => ({
      groupConfig: params.groupConfig as never,
      topicConfig: params.topicConfig as never,
    }),
  });

describe("buildTelegramMessageContext configured model priority", () => {
  const baseConfig = {
    agents: { defaults: { model: "anthropic/claude-opus-4-5", workspace: "/tmp/openclaw" } },
    channels: {
      telegram: {
        model: "openai/gpt-5.2",
        accounts: {
          default: {
            model: "anthropic/claude-sonnet-4-5",
          },
        },
      },
    },
    messages: { groupChat: { mentionPatterns: [] } },
  };

  it("prefers topic model over group and account", async () => {
    const context = await buildContext({
      cfg: baseConfig,
      groupConfig: { model: "openai/gpt-4.1-mini" },
      topicConfig: { model: "google/gemini-2.5-pro" },
      messageThreadId: 99,
      chat: { id: -100123, type: "supergroup", title: "Forum", is_forum: true },
    });
    expect(context?.ctxPayload?.model).toBe("google/gemini-2.5-pro");
  });

  it("uses group model when topic model is missing", async () => {
    const context = await buildContext({
      cfg: baseConfig,
      groupConfig: { model: "openai/gpt-4.1-mini" },
    });
    expect(context?.ctxPayload?.model).toBe("openai/gpt-4.1-mini");
  });

  it("falls back to account model when group/topic do not set one", async () => {
    const context = await buildContext({
      cfg: baseConfig,
    });
    expect(context?.ctxPayload?.model).toBe("anthropic/claude-sonnet-4-5");
  });
});
