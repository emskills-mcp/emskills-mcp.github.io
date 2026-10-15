// Server-only MCP client: performs a real Streamable-HTTP JSON-RPC call
// against a skill's registered MCP endpoint, and a manifest preflight when
// no live endpoint is registered.

export type RunLog = {
  t: number; // ms since run start
  level: "info" | "warn" | "error";
  msg: string;
};

export type RunResult = {
  ok: boolean;
  mode: "live" | "preflight";
  endpoint: string | null;
  tool: string;
  logs: RunLog[];
  output: string | null;
  error: string | null;
};

const TIMEOUT_MS = 20_000;

function logger() {
  const start = Date.now();
  const logs: RunLog[] = [];
  return {
    logs,
    add(level: RunLog["level"], msg: string) {
      logs.push({ t: Date.now() - start, level, msg });
    },
  };
}

/** Only http(s), no private/loopback hosts — this runs server-side (SSRF guard). */
function assertSafeEndpoint(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("MCP endpoint is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("MCP endpoint must use http(s).");
  }
  const host = url.hostname.toLowerCase();
  // In local development the registry's own reference MCP server lives on
  // localhost, so loopback is permitted there (never in production).
  const devLoopback =
    process.env["NODE_ENV"] !== "production" &&
    (host === "localhost" || host === "127.0.0.1");
  const blocked =
    !devLoopback &&
    (host === "localhost" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host));
  if (blocked) throw new Error("MCP endpoint host is not reachable from the registry.");
  return url;

}

async function rpc(
  endpoint: URL,
  body: Record<string, unknown>,
  sessionId?: string,
): Promise<{ json: unknown; sessionId: string | null; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        // Required by the MCP Streamable HTTP spec.
        Accept: "application/json, text/event-stream",
        ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    const trimmed = text.trim();
    if (trimmed.startsWith("event:") || trimmed.startsWith("data:")) {
      // SSE framing — take the last data: line.
      const dataLine = trimmed
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .pop();
      if (dataLine) json = JSON.parse(dataLine.slice(5).trim());
    } else if (trimmed) {
      try {
        json = JSON.parse(trimmed);
      } catch {
        json = null;
      }
    }
    return { json, sessionId: res.headers.get("mcp-session-id"), status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Calls a tool on a live MCP server and streams the exchange into logs. */
export async function runLiveTool(
  endpointRaw: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<RunResult> {
  const log = logger();
  const base: Omit<RunResult, "ok" | "output" | "error"> = {
    mode: "live",
    endpoint: endpointRaw,
    tool,
    logs: log.logs,
  };
  try {
    const endpoint = assertSafeEndpoint(endpointRaw);
    log.add("info", `POST ${endpoint.origin}${endpoint.pathname} — initialize`);

    const init = await rpc(endpoint, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "emskills-registry", version: "1.0.0" },
      },
    });
    if (init.status >= 400 || !init.json) {
      log.add("error", `initialize failed — HTTP ${init.status}`);
      log.add("error", init.text.slice(0, 500) || "(empty response)");
      return { ...base, ok: false, output: null, error: `MCP server rejected initialize (HTTP ${init.status}).` };
    }
    const session = init.sessionId ?? undefined;
    const serverInfo = (init.json as { result?: { serverInfo?: { name?: string; version?: string } } })
      .result?.serverInfo;
    log.add("info", `initialize ok — ${serverInfo?.name ?? "server"} v${serverInfo?.version ?? "?"}`);
    if (session) log.add("info", `session ${session}`);

    log.add("info", "tools/list");
    const list = await rpc(endpoint, { jsonrpc: "2.0", id: 2, method: "tools/list" }, session);
    const tools =
      (list.json as { result?: { tools?: { name: string }[] } }).result?.tools ?? [];
    log.add("info", `tools/list → ${tools.length} tool(s): ${tools.map((t) => t.name).join(", ") || "none"}`);
    if (tools.length && !tools.some((t) => t.name === tool)) {
      log.add("warn", `tool "${tool}" is not advertised by the server; calling anyway`);
    }

    log.add("info", `tools/call ${tool} ${JSON.stringify(args)}`);
    const call = await rpc(
      endpoint,
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: tool, arguments: args } },
      session,
    );
    const payload = call.json as
      | { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: { message?: string } }
      | null;

    if (payload?.error) {
      log.add("error", `JSON-RPC error: ${payload.error.message ?? "unknown"}`);
      return { ...base, ok: false, output: null, error: payload.error.message ?? "MCP call failed." };
    }
    const output =
      payload?.result?.content
        ?.map((c) => (c.type === "text" ? (c.text ?? "") : `[${c.type}]`))
        .join("\n") ?? call.text.slice(0, 2000);
    if (payload?.result?.isError) {
      log.add("error", "tool returned isError");
      return { ...base, ok: false, output, error: "The tool reported an error." };
    }
    log.add("info", `tools/call ok — ${output.length} chars returned`);
    return { ...base, ok: true, output, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.add("error", msg);
    return { ...base, ok: false, output: null, error: msg };
  }
}

/**
 * No live endpoint registered: validate the published manifest instead —
 * repo reachable, SKILL.md present, tool declared.
 */
export async function preflightTool(
  repo: string,
  tool: string,
  slug?: string,
): Promise<RunResult> {
  const log = logger();
  const base: Omit<RunResult, "ok" | "output" | "error"> = {
    mode: "preflight",
    endpoint: null,
    tool,
    logs: log.logs,
  };
  log.add("warn", "no live MCP endpoint registered for this skill — running manifest preflight");
  try {
    const { fetchSkillMd } = await import("@/lib/github.server");
    log.add("info", `resolving github.com/${repo}`);
    const doc = await fetchSkillMd(repo, slug);
    log.add("info", `fetched ${doc.path} (${doc.markdown.length} bytes)`);
    const declared = doc.markdown.includes(tool);
    if (declared) log.add("info", `tool "${tool}" is declared in the manifest`);
    else log.add("error", `tool "${tool}" was not found anywhere in ${doc.path}`);
    return {
      ...base,
      ok: declared,
      output: declared
        ? `Manifest checks passed. Install the server locally and call ${tool} to execute it.`
        : null,
      error: declared ? null : `"${tool}" is not declared in ${doc.path}.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.add("error", msg);
    return { ...base, ok: false, output: null, error: msg };
  }
}
