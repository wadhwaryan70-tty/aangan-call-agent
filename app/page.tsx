import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Call = {
  id: string; started_at: string | null; caller_number: string | null; duration_sec: number;
  after_hours: boolean | null; classification: string | null; asked_pricing: boolean;
  booked_slot: string | null; claimed_by: string | null; showed_up: boolean | null;
  project_won: boolean | null; project_value_inr: number | null;
  cost_voice_inr: number; cost_llm_inr: number; fit_reason: string | null; status: string | null;
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + "%" : "–");

export default async function Dashboard() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error } = await db()
    .from("calls")
    .select("id, started_at, caller_number, duration_sec, after_hours, classification, asked_pricing, booked_slot, claimed_by, showed_up, project_won, project_value_inr, cost_voice_inr, cost_llm_inr, fit_reason, status")
    .gte("created_at", since)
    .order("started_at", { ascending: false });

  if (error) return <main style={wrap}><h1>Dashboard</h1><p>Couldn't load calls: {error.message}</p></main>;
  const calls = (data ?? []) as Call[];

  const connected = calls.filter((c) => c.status !== "failed");
  const qualified = calls.filter((c) => c.classification === "qualified");
  const booked = calls.filter((c) => c.booked_slot);
  const showed = calls.filter((c) => c.showed_up);
  const won = calls.filter((c) => c.project_won);
  const wonValue = won.reduce((s, c) => s + Number(c.project_value_inr ?? 0), 0);
  const voice = calls.reduce((s, c) => s + Number(c.cost_voice_inr ?? 0), 0);
  const llm = calls.reduce((s, c) => s + Number(c.cost_llm_inr ?? 0), 0);
  const cost = voice + llm;

  const tiles: [string, string, string][] = [
    ["Calls answered", `${connected.length} / ${calls.length}`, `${pct(connected.length, calls.length)} picked up by the agent`],
    ["After hours", String(calls.filter((c) => c.after_hours).length), "Calls the front desk would have missed"],
    ["Qualified", String(qualified.length), `${pct(qualified.length, connected.length)} of answered calls`],
    ["Consultations booked", String(booked.length), `${pct(booked.length, qualified.length)} of qualified`],
    ["Showed up", String(showed.length), `${pct(showed.length, booked.length)} of booked`],
    ["Projects won", String(won.length), wonValue ? inr(wonValue) + " in projects" : "Mark wins in Supabase"],
    ["Cost to run", inr(cost), `Voice ${inr(voice)} · AI ${inr(llm)}`],
    ["Cost per booking", booked.length ? inr(cost / booked.length) : "–", "Total cost ÷ consultations booked"],
  ];

  return (
    <main style={wrap}>
      <p style={eyebrow}>Aangan Studio · last 30 days</p>
      <h1 style={{ margin: "4px 0 20px", fontSize: 30 }}>Call desk</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {tiles.map(([k, v, s]) => (
          <div key={k} style={card}>
            <div style={eyebrow}>{k}</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            <div style={{ fontSize: 13, color: "#56635F" }}>{s}</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 32, fontSize: 18 }}>Recent calls</h2>
      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #D5DDDA", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr>{["When", "Caller", "Outcome", "Booked", "Claimed by", "Asked price", "Why"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {calls.slice(0, 50).map((c) => (
              <tr key={c.id}>
                <td style={td}>{c.started_at ? new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }) : "–"}{c.after_hours ? " 🌙" : ""}</td>
                <td style={td}>{c.caller_number ?? "–"}</td>
                <td style={td}><span style={{ ...pill, ...(tone[c.classification ?? "unclear"] ?? {}) }}>{label[c.classification ?? "unclear"] ?? c.classification}</span></td>
                <td style={td}>{c.booked_slot ? new Date(c.booked_slot).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }) : "–"}</td>
                <td style={td}>{c.claimed_by ?? "–"}</td>
                <td style={td}>{c.asked_pricing ? "Yes" : ""}</td>
                <td style={{ ...td, color: "#56635F" }}>{c.fit_reason ?? ""}</td>
              </tr>
            ))}
            {!calls.length && <tr><td style={td} colSpan={7}>No calls yet. Place a test call to the studio number.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "32px 20px 48px" };
const eyebrow: React.CSSProperties = { fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "#56635F", margin: 0 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #D5DDDA", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 4 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #D5DDDA", fontSize: 12, color: "#56635F", textTransform: "uppercase", letterSpacing: ".06em" };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #EEF2F0", verticalAlign: "top" };
const pill: React.CSSProperties = { padding: "2px 8px", borderRadius: 999, fontSize: 12 };
const label: Record<string, string> = { qualified: "Qualified", not_fit: "Not a fit", complaint: "Complaint", unclear: "Unclear" };
const tone: Record<string, React.CSSProperties> = {
  qualified: { background: "#E2F0E3", color: "#2E6B3A" },
  not_fit: { background: "#EEF2F0", color: "#56635F" },
  complaint: { background: "#F7E6E2", color: "#A23B2A" },
  unclear: { background: "#F6EDD6", color: "#8A6410" },
};
