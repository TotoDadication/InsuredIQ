import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are InsuredIQ, an AI research tool for independent insurance agents at Paradox Insurance Agency. When given a business name, address, or any other identifying information, use web search to research the business and return a structured JSON profile for use in insurance intake and submission.

If the user provides a street address, search for what business is located at that address, then profile that business. If you genuinely cannot identify any business from the input after searching, return JSON with businessName set to "Unknown" and confidence set to "low" and populate as many fields as possible.

CRITICAL: You must ALWAYS return valid JSON. Never return a conversational response or explanation — even if data is limited, always return the JSON structure with null for unknown fields.

Return ONLY valid JSON, no markdown, no code fences, no explanation. The JSON must follow this exact structure:

{
  "businessName": "Full legal business name",
  "dba": "DBA name if different, or null",
  "confidence": "high|medium|low",
  "contact": {
    "address": "Full street address",
    "city": "City",
    "state": "State abbreviation",
    "zip": "ZIP",
    "phone": "Phone number or null",
    "website": "https://... or null",
    "email": "Email or null"
  },
  "businessDetails": {
    "yearFounded": "Year or null",
    "employeeCount": "Estimated count or range as string, or null",
    "annualRevenue": "Estimated revenue as string (e.g. '$2M–$5M') or null",
    "legalEntity": "LLC|Corp|Sole Prop|Partnership|etc or null",
    "stateOfIncorporation": "State abbreviation or null"
  },
  "operations": "2-4 sentence plain-English description of what the business does, its customers, and any notable risk factors",
  "classCodes": {
    "naics": {"code": "6-digit code", "description": "Description"},
    "sic": {"code": "4-digit code", "description": "Description"},
    "glClass": "ISO GL class code if applicable, or null"
  },
  "coverageRecommendations": [
    {
      "coverage": "Coverage name",
      "priority": "required|recommended|optional",
      "reason": "One sentence why this coverage applies to this business"
    }
  ],
  "dotFmcsa": {
    "applicable": true,
    "dotNumber": "DOT number or null",
    "mcNumber": "MC number or null",
    "vehicleCount": "Number or null"
  },
  "flags": ["Any underwriting concerns, notable risks, or items to verify — one per array item. Empty array if none."],
  "dataSourceNotes": "Brief note on what sources were found and confidence rationale"
}

Use your web search capability to research the business. If you cannot find reliable information for a field, use null — never fabricate data. Be specific and accurate for real businesses. confidence: high = found official website + corroborating sources; medium = found some data but gaps remain; low = limited information found.`;

const STATUS_STEPS = [
  { delay: 0,     step: "Searching the web...",        detail: "Looking up business records and website" },
  { delay: 5000,  step: "Analyzing operations...",     detail: "Identifying class codes and risk profile" },
  { delay: 10000, step: "Building coverage profile...", detail: "Matching coverages to business type" },
];

const EXAMPLES = [
  "Paradox Insurance, Kalispell MT",
  "Video Punk, St. Charles MO",
  "Lakeside Daycare Center, Chesterfield MO",
];

const s = {
  wrap: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1C1C1A", background: "#F7F6F2", minHeight: "100vh", padding: 0 },
  header: { background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,0.18)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 },
  logoMark: { width: 32, height: 32, background: "#185FA5", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: -0.5, flexShrink: 0 },
  logoText: { fontSize: 15, fontWeight: 600, letterSpacing: -0.3 },
  logoSub: { fontSize: 11, color: "#888780", marginLeft: 2 },
  badge: { marginLeft: "auto", fontSize: 11, fontWeight: 500, background: "#FAEEDA", color: "#633806", padding: "3px 10px", borderRadius: 20 },
  tabs: { display: "flex", gap: 0, borderBottom: "0.5px solid rgba(0,0,0,0.18)", background: "#fff", padding: "0 24px" },
  tab: { padding: "12px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", borderBottom: "2px solid transparent", color: "#888780", background: "none", border: "none", fontFamily: "inherit", marginBottom: -1 },
  tabActive: { color: "#185FA5", borderBottom: "2px solid #185FA5" },
  main: { maxWidth: 820, margin: "0 auto", padding: "28px 20px" },
  howBox: { background: "#E6F1FB", border: "0.5px solid rgba(24,95,165,0.2)", borderRadius: 12, padding: "18px 22px", marginBottom: 24 },
  howTitle: { fontSize: 11, fontWeight: 600, color: "#0C447C", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 },
  howGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 },
  howStep: { display: "flex", flexDirection: "column", gap: 4 },
  stepNum: { fontSize: 11, fontWeight: 600, color: "#185FA5" },
  stepTitle: { fontSize: 12, fontWeight: 500, color: "#0C447C", lineHeight: 1.3 },
  stepDesc: { fontSize: 11, color: "#0C447C", opacity: 0.72, lineHeight: 1.4 },
  searchBox: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 12, padding: 24, marginBottom: 24 },
  searchLabel: { fontSize: 12, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 },
  searchRow: { display: "flex", gap: 8 },
  input: { flex: 1, height: 42, border: "0.5px solid rgba(0,0,0,0.22)", borderRadius: 8, padding: "0 14px", fontSize: 14, color: "#1C1C1A", background: "#fff", outline: "none", fontFamily: "inherit" },
  btnSearch: { height: 42, padding: "0 20px", background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" },
  btnSearchDis: { opacity: 0.5, cursor: "default" },
  examples: { marginTop: 10, fontSize: 12, color: "#888780" },
  exLink: { color: "#0C447C", cursor: "pointer", marginLeft: 5 },
  statusBar: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 12, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 },
  statusText: { fontSize: 13, color: "#5F5E5A" },
  statusStep: { fontWeight: 500, color: "#1C1C1A" },
  errBox: { background: "#FCEBEB", border: "0.5px solid rgba(163,45,45,0.2)", borderRadius: 12, padding: "16px 20px", fontSize: 13, color: "#791F1F", marginBottom: 20 },
  resHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 12 },
  bizName: { fontSize: 20, fontWeight: 600, letterSpacing: -0.4, lineHeight: 1.2 },
  bizSub: { fontSize: 13, color: "#888780", marginTop: 3 },
  btnRow: { display: "flex", gap: 8, flexShrink: 0 },
  btnCopy: { height: 34, padding: "0 14px", background: "#fff", border: "0.5px solid rgba(0,0,0,0.22)", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", color: "#5F5E5A", whiteSpace: "nowrap", fontFamily: "inherit" },
  btnSave: { height: 34, padding: "0 14px", background: "#185FA5", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", color: "#fff", whiteSpace: "nowrap", fontFamily: "inherit" },
  btnSaved: { background: "#3B6D11" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  card: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 12, padding: "16px 18px" },
  cardFull: { gridColumn: "1 / -1" },
  cardLabel: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, color: "#888780", marginBottom: 10 },
  detailRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "0.5px solid rgba(0,0,0,0.08)", fontSize: 13 },
  detailKey: { color: "#888780", whiteSpace: "nowrap", flexShrink: 0, paddingTop: 1 },
  detailVal: { color: "#1C1C1A", textAlign: "right", lineHeight: 1.4 },
  codesRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  codePill: { background: "#F1EFE8", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 500 },
  codeSub: { color: "#888780", fontWeight: 400, marginLeft: 4 },
  covList: { display: "flex", flexDirection: "column", gap: 10 },
  covItem: { display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.4 },
  covBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0, marginTop: 1 },
  covRequired: { background: "#FCEBEB", color: "#A32D2D" },
  covRecommended: { background: "#FAEEDA", color: "#633806" },
  covOptional: { background: "#F1EFE8", color: "#888780" },
  covName: { fontWeight: 500 },
  covWhy: { color: "#888780", fontSize: 12 },
  flagCard: { gridColumn: "1 / -1", background: "#FAEEDA", border: "0.5px solid rgba(186,117,23,0.35)", borderRadius: 12, padding: "16px 18px" },
  flagLabel: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, color: "#633806", marginBottom: 10 },
  opsText: { fontSize: 13, color: "#5F5E5A", lineHeight: 1.6 },
  confRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(0,0,0,0.08)", fontSize: 12, color: "#888780" },
  confDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  disclaimer: { fontSize: 11, color: "#888780", marginTop: 16, lineHeight: 1.5 },
  emptyState: { textAlign: "center", padding: "60px 20px", color: "#888780" },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: 500, color: "#5F5E5A", marginBottom: 6 },
  emptyDesc: { fontSize: 13, lineHeight: 1.5 },
  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  historyCard: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" },
  historyCardHover: { background: "#F1EFE8" },
  historyMeta: { flex: 1, minWidth: 0 },
  historyName: { fontSize: 14, fontWeight: 500, color: "#1C1C1A", marginBottom: 2 },
  historyDetail: { fontSize: 12, color: "#888780" },
  historyRight: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  confPill: { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20 },
  confHigh: { background: "#EAF3DE", color: "#3B6D11" },
  confMed: { background: "#FAEEDA", color: "#633806" },
  confLow: { background: "#FCEBEB", color: "#A32D2D" },
  btnDelete: { background: "none", border: "none", cursor: "pointer", color: "#888780", fontSize: 16, padding: "2px 6px", lineHeight: 1, fontFamily: "inherit" },
  dbStats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 },
  statCard: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.18)", borderRadius: 12, padding: "14px 16px" },
  statNum: { fontSize: 22, fontWeight: 600, color: "#185FA5", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: "#888780", marginTop: 2 },
};

function Spinner() {
  return (
    <svg style={{ width: 20, height: 20, animation: "spin 0.75s linear infinite" }} viewBox="0 0 24 24" fill="none">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="#185FA5" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function DetailRow({ label, value, link }) {
  if (!value) return null;
  return (
    <div style={s.detailRow}>
      <span style={s.detailKey}>{label}</span>
      <span style={s.detailVal}>
        {link ? <a href={value} target="_blank" rel="noreferrer" style={{ color: "#0C447C" }}>{value.replace(/^https?:\/\//, "")}</a> : value}
      </span>
    </div>
  );
}

function CovBadge({ priority }) {
  const style = priority === "required" ? s.covRequired : priority === "recommended" ? s.covRecommended : s.covOptional;
  return <span style={{ ...s.covBadge, ...style }}>{priority}</span>;
}

function ConfPill({ confidence }) {
  const style = confidence === "high" ? s.confHigh : confidence === "medium" ? s.confMed : s.confLow;
  return <span style={{ ...s.confPill, ...style }}>{confidence}</span>;
}

function ProfileView({ profile, onCopy, onSave, copied, saved }) {
  const addr = [profile.contact?.address, profile.contact?.city, profile.contact?.state, profile.contact?.zip].filter(Boolean).join(", ");
  const confColor = profile.confidence === "high" ? "#639922" : profile.confidence === "medium" ? "#EF9F27" : "#E24B4A";
  const confLabel = profile.confidence === "high" ? "High confidence — multiple sources found" : profile.confidence === "medium" ? "Medium confidence — some data gaps" : "Low confidence — limited sources found";

  return (
    <div>
      <div style={s.resHeader}>
        <div>
          <div style={s.bizName}>
            {profile.businessName}
            {profile.dba && <span style={{ fontWeight: 400, fontSize: 15, color: "#888780" }}> dba {profile.dba}</span>}
          </div>
          <div style={s.bizSub}>{profile.classCodes?.naics?.description}</div>
        </div>
        <div style={s.btnRow}>
          <button style={s.btnCopy} onClick={onCopy}>{copied ? "Copied!" : "Copy for Wunderite"}</button>
          <button style={{ ...s.btnSave, ...(saved ? s.btnSaved : {}) }} onClick={onSave}>
            {saved ? "Saved to DB" : "Save to database"}
          </button>
        </div>
      </div>

      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.cardLabel}>Contact & location</div>
          {addr && <DetailRow label="Address" value={addr} />}
          <DetailRow label="Phone" value={profile.contact?.phone} />
          <DetailRow label="Email" value={profile.contact?.email} />
          <DetailRow label="Website" value={profile.contact?.website} link />
        </div>

        <div style={s.card}>
          <div style={s.cardLabel}>Business details</div>
          <DetailRow label="Entity type" value={profile.businessDetails?.legalEntity} />
          <DetailRow label="Founded" value={profile.businessDetails?.yearFounded} />
          <DetailRow label="Employees" value={profile.businessDetails?.employeeCount} />
          <DetailRow label="Est. revenue" value={profile.businessDetails?.annualRevenue} />
          <DetailRow label="Incorporated" value={profile.businessDetails?.stateOfIncorporation} />
        </div>

        <div style={{ ...s.card, ...s.cardFull }}>
          <div style={s.cardLabel}>Operations summary</div>
          <div style={s.opsText}>{profile.operations}</div>
          <div style={{ marginTop: 14 }}>
            <div style={{ ...s.cardLabel, marginBottom: 8 }}>Classification codes</div>
            <div style={s.codesRow}>
              {profile.classCodes?.naics?.code && (
                <div style={s.codePill}>NAICS {profile.classCodes.naics.code}<span style={s.codeSub}>{profile.classCodes.naics.description}</span></div>
              )}
              {profile.classCodes?.sic?.code && (
                <div style={s.codePill}>SIC {profile.classCodes.sic.code}<span style={s.codeSub}>{profile.classCodes.sic.description}</span></div>
              )}
              {profile.classCodes?.glClass && (
                <div style={s.codePill}>GL {profile.classCodes.glClass}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ ...s.card, ...s.cardFull }}>
          <div style={s.cardLabel}>Coverage recommendations</div>
          <div style={s.covList}>
            {(profile.coverageRecommendations || []).map((c, i) => (
              <div key={i} style={s.covItem}>
                <CovBadge priority={c.priority} />
                <div>
                  <div style={s.covName}>{c.coverage}</div>
                  <div style={s.covWhy}>{c.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {profile.flags?.length > 0 && (
          <div style={s.flagCard}>
            <div style={s.flagLabel}>Underwriting flags</div>
            <ul style={{ paddingLeft: 16, fontSize: 13, color: "#633806", lineHeight: 1.8 }}>
              {profile.flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}

        {profile.dotFmcsa?.applicable && (
          <div style={s.card}>
            <div style={s.cardLabel}>DOT / FMCSA</div>
            <DetailRow label="DOT #" value={profile.dotFmcsa.dotNumber} />
            <DetailRow label="MC #" value={profile.dotFmcsa.mcNumber} />
            <DetailRow label="Vehicles" value={profile.dotFmcsa.vehicleCount} />
          </div>
        )}
      </div>

      <div style={s.confRow}>
        <div style={{ ...s.confDot, background: confColor }} />
        <span>{confLabel}{profile.dataSourceNotes ? ` — ${profile.dataSourceNotes}` : ""}</span>
      </div>
      <p style={s.disclaimer}>
        All fields are AI-generated and require producer verification before use in a submission. Revenue and employee figures are estimates unless confirmed by the insured. Class codes should be verified against the applicable carrier's classification manual.
      </p>
    </div>
  );
}

export default function InsuredIQ() {
  const [activeTab, setActiveTab] = useState("search");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dbRecords, setDbRecords] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const timers = useRef([]);

  useEffect(() => { loadDb(); }, []);

  async function loadDb() {
    try {
      const result = await window.storage.list("insurediq:");
      const records = [];
      for (const key of (result?.keys || [])) {
        try {
          const r = await window.storage.get(key);
          if (r?.value) records.push(JSON.parse(r.value));
        } catch {}
      }
      records.sort((a, b) => b.savedAt - a.savedAt);
      setDbRecords(records);
    } catch {}
    setDbLoaded(true);
  }

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  async function runSearch(bizName) {
    const q = bizName || query;
    if (!q.trim() || loading) return;
    clearTimers();
    setLoading(true);
    setProfile(null);
    setError(null);
    setSaved(false);
    setStatusIdx(0);

    STATUS_STEPS.forEach((step, i) => {
      if (i === 0) return;
      const t = setTimeout(() => setStatusIdx(i), step.delay);
      timers.current.push(t);
    });

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Research this business for insurance intake: ${q}` }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "API error");

      const textBlock = data.content.find(b => b.type === "text");
      if (!textBlock) throw new Error("No text response from AI");

      let raw = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
        else throw new Error("No business found for that input. Try searching by business name instead of address, or add a city/state for better results.");
      }
      setProfile(parsed);
    } catch (err) {
      setError(err.message || "Unknown error. Please try again.");
    } finally {
      clearTimers();
      setLoading(false);
    }
  }

  async function saveToDb() {
    if (!profile || saved) return;
    const id = `insurediq:${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const record = {
      id,
      savedAt: Date.now(),
      query,
      profile,
    };
    try {
      await window.storage.set(id, JSON.stringify(record));
      setSaved(true);
      setDbRecords(prev => [record, ...prev]);
    } catch (e) {
      alert("Save failed: " + e.message);
    }
  }

  async function deleteRecord(id, e) {
    e.stopPropagation();
    try {
      await window.storage.delete(id);
      setDbRecords(prev => prev.filter(r => r.id !== id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
    } catch {}
  }

  function copyProfile() {
    if (!profile) return;
    const p = profile;
    const addr = [p.contact?.address, p.contact?.city, p.contact?.state, p.contact?.zip].filter(Boolean).join(", ");
    const lines = [
      `INSUREDIQ PROFILE — ${new Date().toLocaleDateString()}`,
      ``,
      `Business Name: ${p.businessName}${p.dba ? ` (dba ${p.dba})` : ""}`,
      `Address: ${addr}`,
      `Phone: ${p.contact?.phone || ""}`,
      `Website: ${p.contact?.website || ""}`,
      `Email: ${p.contact?.email || ""}`,
      ``,
      `Entity Type: ${p.businessDetails?.legalEntity || ""}`,
      `Year Founded: ${p.businessDetails?.yearFounded || ""}`,
      `Employees: ${p.businessDetails?.employeeCount || ""}`,
      `Est. Revenue: ${p.businessDetails?.annualRevenue || ""}`,
      ``,
      `NAICS: ${p.classCodes?.naics?.code || ""} — ${p.classCodes?.naics?.description || ""}`,
      `SIC: ${p.classCodes?.sic?.code || ""} — ${p.classCodes?.sic?.description || ""}`,
      `GL Class: ${p.classCodes?.glClass || ""}`,
      ``,
      `OPERATIONS:`,
      p.operations,
      ``,
      `COVERAGE RECOMMENDATIONS:`,
      ...(p.coverageRecommendations || []).map(c => `[${c.priority.toUpperCase()}] ${c.coverage} — ${c.reason}`),
      ``,
      ...(p.flags?.length ? [`UNDERWRITING FLAGS:`, ...p.flags.map(f => `• ${f}`), ``] : []),
      `Confidence: ${p.confidence} — ${p.dataSourceNotes || ""}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const step = STATUS_STEPS[statusIdx];
  const highCount = dbRecords.filter(r => r.profile?.confidence === "high").length;
  const flagCount = dbRecords.filter(r => r.profile?.flags?.length > 0).length;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.logoMark}>IQ</div>
        <div>
          <span style={s.logoText}>InsuredIQ</span>
          <span style={s.logoSub}> by Paradox Insurance</span>
        </div>
        <div style={s.badge}>Prototype v0.1</div>
      </div>

      <div style={s.tabs}>
        {[["search","Research"], ["database","Database"], ["history","Search history"]].map(([id, label]) => (
          <button key={id} style={{ ...s.tab, ...(activeTab === id ? s.tabActive : {}) }} onClick={() => { setActiveTab(id); setSelectedRecord(null); }}>
            {label} {id === "database" && dbRecords.length > 0 && `(${dbRecords.length})`}
          </button>
        ))}
      </div>

      <div style={s.main}>

        {activeTab === "search" && (
          <>
            <div style={s.howBox}>
              <div style={s.howTitle}>How it works</div>
              <div style={s.howGrid}>
                {[
                  ["Step 1","Enter a business name","Type any business, optionally with city or state"],
                  ["Step 2","AI searches the web","Claude searches for the website, contact info, and operations"],
                  ["Step 3","Profile is built","Claude assigns NAICS/SIC codes and coverage recommendations"],
                  ["Step 4","Save to database","Store the profile for later review, or copy into Wunderite"],
                ].map(([num, title, desc]) => (
                  <div key={num} style={s.howStep}>
                    <div style={s.stepNum}>{num}</div>
                    <div style={s.stepTitle}>{title}</div>
                    <div style={s.stepDesc}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.searchBox}>
              <label style={s.searchLabel}>Business name</label>
              <div style={s.searchRow}>
                <input
                  style={s.input}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runSearch()}
                  placeholder="Business name or address — e.g. Paradox Insurance, Kalispell MT"
                />
                <button style={{ ...s.btnSearch, ...(loading ? s.btnSearchDis : {}) }} onClick={() => runSearch()} disabled={loading}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  Research business
                </button>
              </div>
              <div style={s.examples}>
                Try an example:
                {EXAMPLES.map((ex, i) => (
                  <span key={ex}>
                    {i > 0 && " · "}
                    <span style={s.exLink} onClick={() => { setQuery(ex); runSearch(ex); }}>{ex.split(",")[0]}</span>
                  </span>
                ))}
              </div>
            </div>

            {loading && (
              <div style={s.statusBar}>
                <Spinner />
                <div style={s.statusText}>
                  <span style={s.statusStep}>{step.step}</span> {step.detail}
                </div>
              </div>
            )}

            {error && <div style={s.errBox}>Research failed: {error}</div>}

            {profile && (
              <ProfileView
                profile={profile}
                onCopy={copyProfile}
                onSave={saveToDb}
                copied={copied}
                saved={saved}
              />
            )}
          </>
        )}

        {activeTab === "database" && (
          <>
            {selectedRecord ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <button style={{ ...s.btnCopy, marginBottom: 0 }} onClick={() => setSelectedRecord(null)}>
                    Back to database
                  </button>
                  <span style={{ fontSize: 12, color: "#888780", marginLeft: 12 }}>
                    Saved {new Date(selectedRecord.savedAt).toLocaleDateString()} — searched as "{selectedRecord.query}"
                  </span>
                </div>
                <ProfileView
                  profile={selectedRecord.profile}
                  onCopy={() => {
                    const p = selectedRecord.profile;
                    const addr = [p.contact?.address, p.contact?.city, p.contact?.state, p.contact?.zip].filter(Boolean).join(", ");
                    navigator.clipboard.writeText([
                      `INSUREDIQ PROFILE — ${new Date(selectedRecord.savedAt).toLocaleDateString()}`,
                      `Business Name: ${p.businessName}`,
                      `Address: ${addr}`,
                      `NAICS: ${p.classCodes?.naics?.code} — ${p.classCodes?.naics?.description}`,
                      ``,
                      `OPERATIONS:`, p.operations,
                    ].join("\n"));
                    setCopied(true); setTimeout(() => setCopied(false), 2000);
                  }}
                  onSave={() => {}}
                  copied={copied}
                  saved={true}
                />
              </>
            ) : (
              <>
                <div style={s.dbStats}>
                  <div style={s.statCard}>
                    <div style={s.statNum}>{dbRecords.length}</div>
                    <div style={s.statLabel}>Total profiles saved</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statNum}>{highCount}</div>
                    <div style={s.statLabel}>High confidence</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={{ ...s.statNum, color: flagCount > 0 ? "#BA7517" : "#185FA5" }}>{flagCount}</div>
                    <div style={s.statLabel}>With UW flags</div>
                  </div>
                </div>

                {dbRecords.length === 0 ? (
                  <div style={s.emptyState}>
                    <div style={s.emptyIcon}>🗄️</div>
                    <div style={s.emptyTitle}>No profiles saved yet</div>
                    <div style={s.emptyDesc}>Research a business and click "Save to database" to store it here.</div>
                  </div>
                ) : (
                  <div style={s.historyList}>
                    {dbRecords.map(record => (
                      <div
                        key={record.id}
                        style={{ ...s.historyCard, ...(hoveredId === record.id ? s.historyCardHover : {}) }}
                        onClick={() => setSelectedRecord(record)}
                        onMouseEnter={() => setHoveredId(record.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <div style={s.historyMeta}>
                          <div style={s.historyName}>{record.profile?.businessName}</div>
                          <div style={s.historyDetail}>
                            {[record.profile?.contact?.city, record.profile?.contact?.state].filter(Boolean).join(", ")}
                            {record.profile?.classCodes?.naics?.description ? ` · ${record.profile.classCodes.naics.description}` : ""}
                          </div>
                        </div>
                        <div style={s.historyRight}>
                          <ConfPill confidence={record.profile?.confidence} />
                          {record.profile?.flags?.length > 0 && (
                            <span style={{ fontSize: 11, background: "#FAEEDA", color: "#633806", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>
                              {record.profile.flags.length} flag{record.profile.flags.length > 1 ? "s" : ""}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: "#888780" }}>{new Date(record.savedAt).toLocaleDateString()}</span>
                          <button style={s.btnDelete} onClick={(e) => deleteRecord(record.id, e)} title="Delete">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            {dbRecords.length === 0 ? (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>🕐</div>
                <div style={s.emptyTitle}>No search history yet</div>
                <div style={s.emptyDesc}>Every profile you save will appear here for review.</div>
              </div>
            ) : (
              <div style={s.historyList}>
                {dbRecords.map(record => (
                  <div
                    key={record.id}
                    style={{ ...s.historyCard, ...(hoveredId === record.id ? s.historyCardHover : {}) }}
                    onClick={() => { setSelectedRecord(record); setActiveTab("database"); }}
                    onMouseEnter={() => setHoveredId(record.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div style={s.historyMeta}>
                      <div style={s.historyName}>{record.profile?.businessName}</div>
                      <div style={s.historyDetail}>Searched as: "{record.query}" · {new Date(record.savedAt).toLocaleString()}</div>
                    </div>
                    <div style={s.historyRight}>
                      <ConfPill confidence={record.profile?.confidence} />
                      <button style={s.btnDelete} onClick={(e) => deleteRecord(record.id, e)} title="Delete">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
