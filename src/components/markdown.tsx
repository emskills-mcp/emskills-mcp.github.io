// Minimal, dependency-free Markdown renderer.
// Renders React elements only (never dangerouslySetInnerHTML), so untrusted
// SKILL.md content from GitHub cannot inject markup.

type Block =
  | { type: "code"; lang: string; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "hr" }
  | { type: "para"; text: string };

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  // YAML frontmatter → fenced code block so it stays readable.
  if (lines[0]?.trim() === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      blocks.push({ type: "code", lang: "yaml", text: lines.slice(1, end).join("\n") });
      i = end + 1;
    }
  }

  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: "para", text: para.join(" ") });
      para = [];
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fence = /^\s*```(\w*)/.exec(line);
    if (fence) {
      flush();
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? "")) buf.push(lines[i] ?? ""), i++;
      blocks.push({ type: "code", lang, text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ type: "heading", level: h[1]!.length, text: h[2]!.trim() });
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flush();
      blocks.push({ type: "hr" });
      continue;
    }
    const li = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]!);
      const items = [li[2]!];
      while (i + 1 < lines.length) {
        const next = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(lines[i + 1] ?? "");
        if (!next) break;
        items.push(next[2]!);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      flush();
      blocks.push({ type: "quote", text: q[1]! });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Inline: `code`, **bold**, *italic*, [text](url) — safe http(s) links only. */
function Inline({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={k++} className="rounded bg-panel px-1 py-0.5 font-mono text-[0.9em] text-signal">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const href = lm[2]!;
      nodes.push(
        /^https?:\/\//i.test(href) ? (
          <a
            key={k++}
            href={href}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="text-signal hover:underline"
          >
            {lm[1]}
          </a>
        ) : (
          <span key={k++}>{lm[1]}</span>
        ),
      );
    } else {
      nodes.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parse(source);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "code":
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-md border border-border bg-panel p-3 font-mono text-xs leading-relaxed text-foreground"
              >
                {b.text}
              </pre>
            );
          case "heading": {
            const size =
              b.level <= 1
                ? "text-xl"
                : b.level === 2
                  ? "text-lg"
                  : "text-base";
            return (
              <h3
                key={i}
                className={`pt-2 font-display font-semibold tracking-tight text-foreground ${size}`}
              >
                <Inline text={b.text} />
              </h3>
            );
          }
          case "list":
            return b.ordered ? (
              <ol key={i} className="list-decimal space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-signal/50 pl-3 italic">
                <Inline text={b.text} />
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-border" />;
          default:
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
