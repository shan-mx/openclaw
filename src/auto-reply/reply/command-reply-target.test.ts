import { describe, expect, it } from "vitest";
import { resolveCommandReplyTarget } from "./command-reply-target.js";

describe("resolveCommandReplyTarget", () => {
  it("prefers originatingTo", () => {
    expect(
      resolveCommandReplyTarget({
        originatingTo: "telegram:-100123",
        commandFrom: "telegram:group:-100123",
        commandTo: "slash:12345",
      }),
    ).toBe("telegram:-100123");
  });

  it("falls back to commandFrom", () => {
    expect(
      resolveCommandReplyTarget({
        commandFrom: "telegram:group:-100123",
        commandTo: "slash:12345",
      }),
    ).toBe("telegram:group:-100123");
  });

  it("ignores slash pseudo targets", () => {
    expect(
      resolveCommandReplyTarget({
        commandTo: "slash:12345",
      }),
    ).toBeUndefined();
  });

  it("uses commandTo when it is a routable target", () => {
    expect(
      resolveCommandReplyTarget({
        commandTo: "telegram:12345",
      }),
    ).toBe("telegram:12345");
  });

  it("prefers telegram group target from command target session key", () => {
    expect(
      resolveCommandReplyTarget({
        originatingChannel: "telegram",
        commandTargetSessionKey: "agent:main:telegram:group:-1001234567890:topic:99",
        originatingTo: "telegram:12345",
        commandFrom: "telegram:group:-1001234567890:topic:99",
        commandTo: "slash:12345",
      }),
    ).toBe("telegram:-1001234567890");
  });
});
