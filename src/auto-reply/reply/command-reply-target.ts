import { parseAgentSessionKey } from "../../routing/session-key.js";

function normalizeChannel(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveTelegramTargetFromSessionKey(sessionKey?: string): string | undefined {
  const parsed = parseAgentSessionKey(sessionKey);
  const rest = parsed?.rest ?? (sessionKey ?? "").trim().toLowerCase();
  if (!rest) {
    return undefined;
  }
  const groupPrefix = "telegram:group:";
  const channelPrefix = "telegram:channel:";
  const prefix = rest.startsWith(groupPrefix)
    ? groupPrefix
    : rest.startsWith(channelPrefix)
      ? channelPrefix
      : undefined;
  if (!prefix) {
    return undefined;
  }
  const peer = rest.slice(prefix.length).trim();
  if (!peer) {
    return undefined;
  }
  const chatId = peer.split(":topic:")[0]?.trim();
  if (!chatId) {
    return undefined;
  }
  return `telegram:${chatId}`;
}

export function resolveCommandReplyTarget(params: {
  originatingTo?: string;
  originatingChannel?: string;
  commandTargetSessionKey?: string;
  commandFrom?: string;
  commandTo?: string;
}): string | undefined {
  const channel = normalizeChannel(params.originatingChannel);
  const sessionTarget =
    channel === "telegram"
      ? resolveTelegramTargetFromSessionKey(params.commandTargetSessionKey)
      : undefined;
  const originatingTo = params.originatingTo?.trim();
  if (originatingTo) {
    if (sessionTarget && originatingTo !== sessionTarget) {
      return sessionTarget;
    }
    return originatingTo;
  }

  if (sessionTarget) {
    return sessionTarget;
  }

  const commandFrom = params.commandFrom?.trim();
  if (commandFrom) {
    return commandFrom;
  }

  const commandTo = params.commandTo?.trim();
  if (!commandTo) {
    return undefined;
  }
  if (commandTo.toLowerCase().startsWith("slash:")) {
    return undefined;
  }
  return commandTo;
}
