import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { VerifiedBadge } from "@/components/verified-badge";
import { getMyVerification, requestVerification } from "@/lib/billing.functions";

type Verification = Awaited<ReturnType<typeof getMyVerification>>["verification"];

/** Publisher certification status + application form, shown on /contribute. */
export function PublisherVerificationPanel() {
  const load = useServerFn(getMyVerification);
  const apply = useServerFn(requestVerification);

  const [v, setV] = useState<Verification | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ org: "", contactEmail: "", evidenceUrl: "", notes: "" });

  useEffect(() => {
    load()
      .then((r) => setV(r.verification))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await apply({
        data: {
          org: form.org,
          contactEmail: form.contactEmail,
          evidenceUrl: form.evidenceUrl,
          notes: form.notes,
        },
      });
      setMessage(res.message);
      if (res.ok) {
        setOpen(false);
        const r = await load();
        setV(r.verification);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  const level = v?.status === "verified" ? v.badge : "community";
  const input =
    "mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-signal";
  const label = "font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <section className="mt-12 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Publisher certification
        </h2>
        <VerifiedBadge level={level} />
      </div>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
        Verified publishers show a badge on every skill they publish. Certification
        confirms that the submitting account belongs to the named organisation, and
        that calibration claims were validated on real hardware.
      </p>

      {v && (
        <dl className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
          <Row k="organisation" v={v.org} />
          <Row k="status" v={v.status} />
          <Row k="badge" v={v.badge} />
          <Row k="requested" v={v.created_at.slice(0, 10)} />
          {v.reviewer_notes && <Row k="reviewer" v={v.reviewer_notes} />}
        </dl>
      )}

      {message && (
        <p className="mt-4 rounded-md border border-signal/40 bg-signal/10 px-3 py-2 font-mono text-xs text-signal">
          {message}
        </p>
      )}

      {!open && v?.status !== "pending" && v?.status !== "verified" && (
        <button
          onClick={() => setOpen(true)}
          className="mt-5 rounded-md border border-brass/50 px-4 py-2.5 font-mono text-xs text-brass hover:border-brass"
        >
          Apply for verification
        </button>
      )}

      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>organisation</span>
            <input
              required
              value={form.org}
              onChange={(e) => setForm({ ...form, org: e.target.value })}
              className={input}
            />
          </label>
          <label className="block">
            <span className={label}>contact email</span>
            <input
              required
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className={input}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>evidence url</span>
            <input
              value={form.evidenceUrl}
              onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
              className={input}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={input}
            />
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-signal px-4 py-2.5 font-mono text-xs font-medium text-signal-foreground disabled:opacity-50"
            >
              {busy ? "submitting…" : "Submit request"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border px-4 py-2.5 font-mono text-xs text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
