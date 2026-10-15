// Pure, client-safe line diff (LCS) used by the review queue's side-by-side view.

export type DiffRow = {
  type: "same" | "added" | "removed" | "changed";
  leftNo: number | null;
  rightNo: number | null;
  left: string | null;
  right: string | null;
};

export type FieldDiff = {
  field: string;
  before: string | null;
  after: string | null;
  changed: boolean;
};

function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

/** Side-by-side rows; adjacent remove+add pairs collapse into one "changed" row. */
export function diffLines(before: string, after: string, maxRows = 1200): DiffRow[] {
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  const table = lcsTable(a, b);

  const raw: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      raw.push({ type: "same", leftNo: i + 1, rightNo: j + 1, left: a[i]!, right: b[j]! });
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      raw.push({ type: "removed", leftNo: i + 1, rightNo: null, left: a[i]!, right: null });
      i++;
    } else {
      raw.push({ type: "added", leftNo: null, rightNo: j + 1, left: null, right: b[j]! });
      j++;
    }
  }
  while (i < a.length) {
    raw.push({ type: "removed", leftNo: i + 1, rightNo: null, left: a[i]!, right: null });
    i++;
  }
  while (j < b.length) {
    raw.push({ type: "added", leftNo: null, rightNo: j + 1, left: null, right: b[j]! });
    j++;
  }

  // Pair removals with the following additions so edits read on one line.
  const rows: DiffRow[] = [];
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k]!;
    if (cur.type === "removed") {
      let end = k;
      while (end + 1 < raw.length && raw[end + 1]!.type === "removed") end++;
      let addEnd = end;
      while (addEnd + 1 < raw.length && raw[addEnd + 1]!.type === "added") addEnd++;
      const removals = raw.slice(k, end + 1);
      const additions = raw.slice(end + 1, addEnd + 1);
      const n = Math.max(removals.length, additions.length);
      for (let x = 0; x < n; x++) {
        const r = removals[x];
        const ad = additions[x];
        rows.push({
          type: r && ad ? "changed" : r ? "removed" : "added",
          leftNo: r?.leftNo ?? null,
          rightNo: ad?.rightNo ?? null,
          left: r?.left ?? null,
          right: ad?.right ?? null,
        });
      }
      k = addEnd;
      continue;
    }
    rows.push(cur);
  }
  return rows.slice(0, maxRows);
}

/** Collapses long runs of unchanged lines into context windows. */
export function collapseContext(rows: DiffRow[], context = 3): (DiffRow | { type: "gap"; count: number })[] {
  const keep = new Set<number>();
  rows.forEach((r, idx) => {
    if (r.type === "same") return;
    for (let k = idx - context; k <= idx + context; k++) if (k >= 0 && k < rows.length) keep.add(k);
  });
  const out: (DiffRow | { type: "gap"; count: number })[] = [];
  let gap = 0;
  rows.forEach((r, idx) => {
    if (keep.has(idx)) {
      if (gap) {
        out.push({ type: "gap", count: gap });
        gap = 0;
      }
      out.push(r);
    } else {
      gap++;
    }
  });
  if (gap) out.push({ type: "gap", count: gap });
  return out;
}

export function diffStats(rows: DiffRow[]) {
  return {
    added: rows.filter((r) => r.type === "added").length,
    removed: rows.filter((r) => r.type === "removed").length,
    changed: rows.filter((r) => r.type === "changed").length,
  };
}
