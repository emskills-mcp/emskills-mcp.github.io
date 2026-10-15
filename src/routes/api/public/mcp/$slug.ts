import { createFileRoute } from "@tanstack/react-router";

/**
 * Reference MCP server hosted by the registry.
 *
 * Implements the Streamable-HTTP JSON-RPC subset used by the registry runner
 * (initialize / tools/list / tools/call) for any published skill. The tool it
 * advertises is the skill's declared `tool_call`, and the call returns a
 * deterministic reference report derived from the manifest and the supplied
 * arguments — enough for an agent (or the registry Run panel) to exercise the
 * skill end to end without vendor infrastructure.
 */

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

const PROTOCOL_VERSION = "2025-06-18";

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function rpcError(
  id: number | string | null | undefined,
  code: number,
  message: string,
  status = 200,
) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

async function loadSkill(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("skills")
    .select(
      "slug, name, technique, kind, summary, description, version, runtime, tool_call, repo, license",
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data ?? null) as import("@/lib/mcp-execute.server").HostedSkill | null;

}


async function handle(request: Request, slug: string): Promise<Response> {
  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  const skill = await loadSkill(slug);
  if (!skill) return rpcError(body.id, -32001, `Unknown skill "${slug}".`, 404);

  switch (body.method) {
    case "initialize":
      return rpcResult(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: `emskills/${skill.slug}`, version: skill.version },
      });

    case "notifications/initialized":
      return new Response(null, { status: 202 });

    case "ping":
      return rpcResult(body.id, {});

    case "tools/list":
      return rpcResult(body.id, {
        tools: [
          {
            name: skill.tool_call,
            description: skill.summary,
            inputSchema: {
              type: "object",
              properties: {
                input: { type: "string", description: "Path or URI of the dataset to process." },
              },
              additionalProperties: true,
            },
          },
        ],
      });

    case "tools/call": {
      const params = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (params.name && params.name !== skill.tool_call) {
        return rpcResult(body.id, {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown tool "${params.name}". This server exposes "${skill.tool_call}".`,
            },
          ],
        });
      }
      const args = params.arguments ?? {};
      const { executeSkill } = await import("@/lib/mcp-execute.server");
      const exec = await executeSkill(skill, args);
      return rpcResult(body.id, {
        content: [{ type: "text", text: exec.text }],
        structuredContent: {
          skill: skill.slug,
          tool: skill.tool_call,
          model: exec.model,
          grounded_in_manifest: exec.grounded,
        },
        isError: false,
      });

    }

    default:
      return rpcError(body.id, -32601, `Method not found: ${body.method ?? "(none)"}`);
  }
}

export const Route = createFileRoute("/api/public/mcp/$slug")({
  server: {
    handlers: {
      POST: async ({ request, params }) => handle(request, params.slug),
      GET: async ({ params }) =>
        Response.json({
          server: `emskills/${params.slug}`,
          transport: "streamable-http",
          protocolVersion: PROTOCOL_VERSION,
          hint: "POST JSON-RPC 2.0 requests (initialize, tools/list, tools/call) to this URL.",
        }),
    },
  },
});
