import { useState, useRef, useEffect } from "react";

const SUPABASE_URL = "https://sjkeerulozbifeevcboy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqa2VlcnVsb3piaWZlZXZjYm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjU5NTMsImV4cCI6MjA5ODM0MTk1M30.sbWyZYFaWzKMfr03PN9M-ZOJbNSLQUuVpoE4OwtmLks";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadProfiles() {
  return await sbFetch("profiles?order=saved_at.desc");
}

async function saveProfile(record) {
  await sbFetch("profiles", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      id: record.id,
      saved_at: record.savedAt,
      query: record.query,
      profile: record.profile,
    }),
  });
}

async function deleteProfile(id) {
  await sbFetch(`profiles?id=eq.${id}`, { method: "DELETE" });
}

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
  { delay: 0,     step: "Searching the web",         detail: "Looking up business records and website" },
  { delay: 5000,  step: "Analyzing operations",      detail: "Identifying class codes and risk profile" },
  { delay: 10000, step: "Building coverage profile", detail: "Matching coverages to business type" },
  { delay: 14000, step: "Cross-checking sources",    detail: "Verifying contact details with Google Places" },
];

const BAR_COLORS = ["#0C7B7B", "#22A9A9", "#C08A2E", "#5A8F3C", "#5A72C4", "#B5761A"];

/* ---- palette ---- */
const C = {
  canvas: "#F2F0EA", rail: "#FCFBF8", card: "#fff",
  ink: "#1C1C1A", muted: "#75746D", faint: "#9C9B93", ghost: "#B4B3AB",
  accent: "#0C7B7B", brand: "#22A9A9", tint: "#E4F3F1",
  green: "#2E7D46", greenBg: "#E7F2E5",
  amber: "#96610F", amberBg: "#FAF0DA", amberStrip: "#FDF7EC",
  red: "#B23A32", redBg: "#FBEAE7",
  line: "rgba(28,28,26,0.09)", line2: "rgba(28,28,26,0.07)",
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const LOGO_SRC = "data:image/png;base64,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";

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
@keyframes iqspin { to { transform: rotate(360deg); } }
@keyframes iqshim { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
.iq-input:focus { border-color:${C.accent}; box-shadow:0 0 0 3px ${C.tint}; }
.iq-input::placeholder { color:${C.ghost}; }
.iq-primary:hover { filter:brightness(1.08); }
.iq-ghost:hover { background:#F4F2EC; }
.iq-row:hover { background:rgba(28,28,26,0.035); }
.iq-dbrow:hover { background:${C.rail}; border-color:rgba(28,28,26,0.16); }
.iq-suggest:hover { background:#F4F2EC; }
.iq-bar:hover { background:#F7F5F0; }
.iq-link:hover { text-decoration:underline; }
.iq-scroll::-webkit-scrollbar { width:9px; }
.iq-scroll::-webkit-scrollbar-thumb { background:rgba(28,28,26,0.14); border-radius:10px; }
`;

const shim = { background: "linear-gradient(90deg,#ECEAE3 25%,#F4F2EC 37%,#ECEAE3 63%)", backgroundSize: "800px 100%", animation: "iqshim 1.3s linear infinite" };

/* ================= small pieces ================= */

function ConfChip({ confidence }) {
  const map = {
    high: { c: C.green, bg: C.greenBg, bd: "rgba(46,125,70,0.25)", dot: "#2E7D46", label: "High confidence" },
    medium: { c: C.amber, bg: C.amberBg, bd: "rgba(150,97,15,0.28)", dot: "#C08A2E", label: "Medium confidence" },
    low: { c: C.red, bg: C.redBg, bd: "rgba(178,58,50,0.25)", dot: "#C4453D", label: "Low confidence" },
  };
  const m = map[confidence] || map.low;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: m.c, background: m.bg, border: `1px solid ${m.bd}`, borderRadius: 20, padding: "3px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.dot }} />{m.label}
    </span>
  );
}

function ConfPill({ confidence }) {
  const map = {
    high: { c: C.green, bg: C.greenBg, label: "High" },
    medium: { c: C.amber, bg: C.amberBg, label: "Medium" },
    low: { c: C.red, bg: C.redBg, label: "Low" },
  };
  const m = map[confidence] || map.low;
  return <span style={{ fontSize: 11, fontWeight: 500, color: m.c, background: m.bg, borderRadius: 20, padding: "2px 9px" }}>{m.label}</span>;
}

function confDot(confidence, size) {
  const c = confidence === "high" ? "#2E7D46" : confidence === "medium" ? "#C08A2E" : "#C4453D";
  return { width: size || 9, height: size || 9, borderRadius: "50%", background: c, flexShrink: 0 };
}

/* ================= profile dossier ================= */

function ProfileDossier({ profile, onCopy, onSave, copied, saved, showSaveHint }) {
  const p = profile;
  const addr = [p.contact?.address, p.contact?.city, p.contact?.state, p.contact?.zip].filter(Boolean).join(", ");
  const confColor = p.confidence === "high" ? "#2E7D46" : p.confidence === "medium" ? "#C08A2E" : "#C4453D";
  const notes = p.dataSourceNotes || "";
  const placesChecked = /Google Places/i.test(notes);
  const placesVerified = /Verified against Google Places/i.test(notes);
  const flags = p.flags || [];
  const cov = p.coverageRecommendations || [];
  const covReq = cov.filter(c => c.priority === "required");
  const covRec = cov.filter(c => c.priority === "recommended");
  const covOpt = cov.filter(c => c.priority === "optional");

  const metaLine = [
    p.businessDetails?.legalEntity,
    p.businessDetails?.yearFounded ? `Founded ${p.businessDetails.yearFounded}` : null,
    [p.contact?.city, p.contact?.state].filter(Boolean).join(", ") || null,
  ].filter(Boolean).join("  ·  ");

  const codes = [];
  if (p.classCodes?.naics?.code) codes.push({ kind: "NAICS", code: p.classCodes.naics.code, desc: p.classCodes.naics.description });
  if (p.classCodes?.sic?.code) codes.push({ kind: "SIC", code: p.classCodes.sic.code, desc: p.classCodes.sic.description });
  if (p.classCodes?.glClass) codes.push({ kind: "GL", code: p.classCodes.glClass, desc: "" });

  const firmo = [
    ["Entity type", p.businessDetails?.legalEntity],
    ["Year founded", p.businessDetails?.yearFounded],
    ["Employees", p.businessDetails?.employeeCount],
    ["Est. revenue", p.businessDetails?.annualRevenue],
    ["Incorporated", p.businessDetails?.stateOfIncorporation],
  ].filter(r => r[1]);

  const verifiedField = (label) => placesVerified && ["Address", "Phone", "Website"].includes(label);
  const contactRows = [
    { label: "Address", value: addr, link: false },
    { label: "Phone", value: p.contact?.phone, link: false },
    { label: "Website", value: p.contact?.website, link: true },
    { label: "Email", value: p.contact?.email, link: false },
  ].filter(r => r.value);

  const cardLabel = { fontSize: 11, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: C.faint };
  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" };

  const CoverageCol = ({ title, items, c, bg, bd }) => (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", background: bg, borderBottom: `1px solid ${bd}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: c }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: c }}>{items.length}</span>
      </div>
      <div style={{ padding: "2px 16px 8px" }}>
        {items.length === 0 && <div style={{ padding: "14px 0", fontSize: 12.5, color: C.ghost }}>None identified.</div>}
        {items.map((cv, i) => (
          <div key={i} style={{ padding: "11px 0", borderBottom: i === items.length - 1 ? "none" : `1px solid ${C.line2}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35 }}>{cv.coverage}</div>
            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.45, marginTop: 3 }}>{cv.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      {/* identity header */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: C.brand, marginBottom: 11 }}>Business Profile</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 22, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.2 }}>
            {p.businessName}
            {p.dba && <span style={{ fontWeight: 400, fontSize: 17, color: C.faint }}> dba {p.dba}</span>}
          </h1>
          {p.classCodes?.naics?.description && <div style={{ marginTop: 9, fontSize: 14, color: C.muted }}>{p.classCodes.naics.description}</div>}
          {metaLine && <div style={{ marginTop: 8, fontSize: 12.5, color: C.faint }}>{metaLine}</div>}
          <div style={{ marginTop: 14 }}><ConfChip confidence={p.confidence} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="iq-ghost" onClick={onCopy} style={{ height: 36, padding: "0 14px", background: C.card, border: "1px solid rgba(28,28,26,0.18)", borderRadius: 9, fontSize: 12.5, fontWeight: 500, fontFamily: FONT, color: "#4a4a45", cursor: "pointer" }}>
            {copied ? <span style={{ color: C.green }}>✓ Copied</span> : "Copy for Wunderite"}
          </button>
          <button className="iq-primary" onClick={onSave} disabled={saved} style={{ height: 36, padding: "0 16px", background: saved ? C.green : C.accent, border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, color: "#fff", cursor: saved ? "default" : "pointer", opacity: saved ? 0.92 : 1 }}>
            {saved ? "✓ Saved to database" : "Save to database"}
          </button>
        </div>
      </div>

      {/* underwriting flags — surfaced first */}
      {flags.length > 0 ? (
        <div style={{ marginTop: 24, background: C.amberStrip, border: "1px solid rgba(150,97,15,0.30)", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B5761A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: "#7A4E0C" }}>Underwriting flags</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#7A4E0C", background: "#F4E4C2", borderRadius: 20, padding: "1px 8px" }}>{flags.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {flags.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "#4a3b1e" }}>
                <span style={{ color: "#B5761A", flexShrink: 0, fontSize: 9, marginTop: 4 }}>●</span><span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 24, background: "#EAF3E4", border: "1px solid rgba(46,125,70,0.28)", borderRadius: 12, padding: "14px 18px", fontSize: 13.5, color: "#2E6B3E", display: "flex", alignItems: "center", gap: 9 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7D46" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          No underwriting concerns flagged for this business.
        </div>
      )}

      {/* contact & location */}
      <div style={{ marginTop: 24, ...card }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <div style={cardLabel}>Contact &amp; location</div>
          {placesChecked && (
            <span style={{ fontSize: 11, color: C.faint, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: placesVerified ? "#2E7D46" : "#C08A2E" }} />
              {placesVerified ? "Cross-checked with Google Places" : "Not found on Google Places"}
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 34px" }}>
          {contactRows.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.line2}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 2 }}>{row.label}</div>
                {row.link
                  ? <a className="iq-link" href={row.value} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, color: C.accent, textDecoration: "none" }}>{String(row.value).replace(/^https?:\/\//, "")}</a>
                  : <div style={{ fontSize: 13.5, color: C.ink }}>{row.value}</div>}
              </div>
              {placesChecked && (
                verifiedField(row.label)
                  ? <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: C.green, background: C.greenBg, border: "1px solid rgba(46,125,70,0.25)", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>✓ Verified</span>
                  : <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberBg, border: "1px solid rgba(150,97,15,0.28)", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>⚠ Unverified</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* coverage tiers */}
      <div style={{ marginTop: 30, display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>Coverage recommendations</h2>
        <span style={{ fontSize: 12, color: C.faint }}>Matched to risk profile</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, alignItems: "start" }}>
        <CoverageCol title="Required" items={covReq} c={C.red} bg={C.redBg} bd="rgba(178,58,50,0.16)" />
        <CoverageCol title="Recommended" items={covRec} c={C.amber} bg={C.amberBg} bd="rgba(150,97,15,0.16)" />
        <CoverageCol title="Optional" items={covOpt} c={C.muted} bg="#EFEDE6" bd="rgba(28,28,26,0.10)" />
      </div>

      {/* operations + firmographics */}
      <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, alignItems: "start" }}>
        <div style={card}>
          <div style={{ ...cardLabel, marginBottom: 11 }}>Operations summary</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#3f3f3a", margin: 0 }}>{p.operations}</p>
          {codes.length > 0 && <>
            <div style={{ ...cardLabel, margin: "18px 0 11px" }}>Classification codes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {codes.map((code, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#F4F2EC", border: `1px solid rgba(28,28,26,0.10)`, borderRadius: 9, padding: "6px 11px" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: C.accent, background: C.tint, borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>{code.kind} {code.code}</span>
                  {code.desc && <span style={{ fontSize: 12, color: C.muted }}>{code.desc}</span>}
                </div>
              ))}
            </div>
          </>}
        </div>
        <div style={card}>
          <div style={{ ...cardLabel, marginBottom: 6 }}>Firmographics</div>
          {firmo.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: i === firmo.length - 1 ? "none" : `1px solid ${C.line2}`, fontSize: 13 }}>
              <span style={{ color: C.faint }}>{row[0]}</span>
              <span style={{ fontWeight: 500, fontFamily: MONO, fontSize: 12.5, textAlign: "right" }}>{row[1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DOT / FMCSA */}
      {p.dotFmcsa?.applicable && (
        <div style={{ marginTop: 14, background: C.card, border: "1px solid rgba(34,169,169,0.35)", borderRadius: 14, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 15 }}>
            <span style={cardLabel}>DOT / FMCSA</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.accent, background: C.tint, border: "1px solid rgba(34,169,169,0.30)", borderRadius: 20, padding: "2px 9px" }}>Motor carrier</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {[["DOT #", p.dotFmcsa.dotNumber], ["MC #", p.dotFmcsa.mcNumber], ["Power units", p.dotFmcsa.vehicleCount]].map((row, i) => (
              <div key={i} style={{ background: "#F4F2EC", borderRadius: 10, padding: "13px 15px" }}>
                <div style={{ fontSize: 11, color: C.faint }}>{row[0]}</div>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, marginTop: 4 }}>{row[1] || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* footer notes */}
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid rgba(28,28,26,0.10)` }}>
        {notes && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
            <span style={{ ...confDot(p.confidence, 8), marginTop: 4 }} /><span>{notes}</span>
          </div>
        )}
        <p style={{ margin: "11px 0 0", fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
          All fields are AI-generated and require producer verification before use in a submission. Revenue and employee figures are estimates unless confirmed by the insured. Class codes should be verified against the applicable carrier's classification manual.
        </p>
      </div>

      {showSaveHint && !saved && (
        <div style={{ marginTop: 16, background: C.greenBg, border: "1px solid rgba(46,125,70,0.25)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#2E6B3E" }}>Save this profile so the whole team can see it and it feeds the insights dashboard.</span>
          <button className="iq-primary" onClick={onSave} style={{ flexShrink: 0, height: 34, padding: "0 16px", background: C.accent, border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, color: "#fff", cursor: "pointer" }}>Save to database</button>
        </div>
      )}
    </div>
  );
}

/* ================= loading skeleton ================= */

function LoadingState({ step }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 22 }}>
        <svg style={{ width: 20, height: 20, animation: "iqspin 0.8s linear infinite", flexShrink: 0 }} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="rgba(28,28,26,0.14)" strokeWidth="2.5" /><path d="M12 3a9 9 0 0 1 9 9" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" /></svg>
        <div><div style={{ fontSize: 14, fontWeight: 600 }}>{step.step}</div><div style={{ fontSize: 12.5, color: C.muted, marginTop: 1 }}>{step.detail}</div></div>
      </div>
      <div style={{ height: 14, width: 130, borderRadius: 8, marginBottom: 16, ...shim }} />
      <div style={{ height: 30, width: 340, borderRadius: 8, marginBottom: 10, ...shim }} />
      <div style={{ height: 14, width: 220, borderRadius: 8, marginBottom: 24, ...shim }} />
      <div style={{ height: 78, width: "100%", borderRadius: 14, marginBottom: 22, ...shim }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <div style={{ height: 190, borderRadius: 14, ...shim }} />
        <div style={{ height: 190, borderRadius: 14, ...shim }} />
        <div style={{ height: 190, borderRadius: 14, ...shim }} />
      </div>
    </div>
  );
}

/* ================= empty research state ================= */

function EmptyResearch() {
  const steps = [
    ["01", "Enter a business", "Type a business name, optionally with city and state — or a street address."],
    ["02", "AI searches the web", "Claude pulls the website, contact details, firmographics, and operations."],
    ["03", "Profile is built", "Class codes, tiered coverage, and underwriting flags are generated automatically."],
    ["04", "Verify & save", "Contact info is cross-checked with Google Places; save it for the whole team."],
  ];
  return (
    <div style={{ paddingTop: 40 }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>Research a business</h1>
      <p style={{ margin: "8px 0 30px", fontSize: 14, color: C.muted, maxWidth: 560, lineHeight: 1.6 }}>
        Enter a business in the search bar to generate a structured risk profile — contact details, firmographics, class codes, coverage recommendations, and underwriting flags.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, maxWidth: 720 }}>
        {steps.map(([n, t, d]) => (
          <div key={n} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.accent, marginBottom: 6 }}>{n}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= insights ================= */

function Insights({ records, onOpenRecord }) {
  const [drill, setDrill] = useState(null);

  const typeMap = {};
  records.forEach(r => {
    const desc = r.profile?.classCodes?.naics?.description;
    if (desc) typeMap[desc] = (typeMap[desc] || 0) + 1;
  });
  const types = Object.entries(typeMap).map(([k, c]) => ({ k, c })).sort((a, b) => b.c - a.c).slice(0, 8);
  const maxType = Math.max(1, ...types.map(t => t.c));

  const geoMap = {};
  records.forEach(r => {
    const st = r.profile?.contact?.state;
    const city = r.profile?.contact?.city;
    if (st) {
      if (!geoMap[st]) geoMap[st] = { c: 0, cities: new Set() };
      geoMap[st].c++;
      if (city) geoMap[st].cities.add(city);
    }
  });
  const geo = Object.entries(geoMap).map(([st, v]) => ({ st, c: v.c, cities: [...v.cities] })).sort((a, b) => b.c - a.c);

  const stat = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" };
  const statNum = { fontSize: 24, fontWeight: 600, color: C.accent, fontFamily: MONO };
  const statLabel = { fontSize: 11.5, color: C.faint, marginTop: 2 };
  const cardLabel = { fontSize: 11, fontWeight: 600, letterSpacing: 0.7, textTransform: "uppercase", color: C.faint };

  const stats = [
    [records.length, "Saved profiles"],
    [records.filter(r => r.profile?.confidence === "high").length, "High confidence"],
    [Object.keys(geoMap).length, "States covered"],
    [records.filter(r => (r.profile?.flags?.length || 0) > 0).length, "With UW flags"],
  ];

  if (drill) {
    const list = records.filter(r => drill.mode === "type" ? r.profile?.classCodes?.naics?.description === drill.key : r.profile?.contact?.state === drill.key);
    return (
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>Insights</h1>
        <p style={{ margin: "6px 0 22px", fontSize: 13.5, color: C.muted }}>Aggregated across the team's saved research.</p>
        <button className="iq-link" onClick={() => setDrill(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 12.5, color: C.accent, padding: 0, marginBottom: 16 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> Back to insights
        </button>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, marginBottom: 3 }}>{drill.label}</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 16 }}>{list.length} saved profile{list.length !== 1 ? "s" : ""}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {list.map(r => (
            <button key={r.id} className="iq-dbrow" onClick={() => onOpenRecord(r)} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, cursor: "pointer", fontFamily: FONT, textAlign: "left", width: "100%" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{r.profile?.businessName}</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[r.profile?.contact?.city, r.profile?.contact?.state].filter(Boolean).join(", ")}{r.profile?.classCodes?.naics?.description ? ` · ${r.profile.classCodes.naics.description}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <ConfPill confidence={r.profile?.confidence} />
                {(r.profile?.flags?.length || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberBg, borderRadius: 20, padding: "2px 8px" }}>{r.profile.flags.length} flag</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>Insights</h1>
      <p style={{ margin: "6px 0 22px", fontSize: 13.5, color: C.muted }}>Aggregated across the team's saved research.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        {stats.map((st, i) => (<div key={i} style={stat}><div style={statNum}>{st[0]}</div><div style={statLabel}>{st[1]}</div></div>))}
      </div>
      {records.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "48px 20px", textAlign: "center", color: C.faint, fontSize: 13.5 }}>
          No saved profiles yet — save research to populate the insights.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ ...cardLabel, marginBottom: 16 }}>Top business types</div>
            {types.map((row, i) => (
              <button key={row.k} className="iq-bar" onClick={() => setDrill({ mode: "type", key: row.k, label: row.k })} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: "none", cursor: "pointer", fontFamily: FONT, padding: "6px 6px", margin: "0 -6px 4px", borderRadius: 8 }}>
                <span style={{ fontSize: 12.5, color: C.ink, width: 140, flexShrink: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }} title={row.k}>{row.k}</span>
                <span style={{ flex: 1, minWidth: 60, background: "#F1EFE8", borderRadius: 5, height: 9, overflow: "hidden" }}><span style={{ display: "block", height: 9, borderRadius: 5, width: `${Math.round((row.c / maxType) * 100)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} /></span>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: MONO, width: 20, textAlign: "right", flexShrink: 0 }}>{row.c}</span>
              </button>
            ))}
            <div style={{ marginTop: 8, fontSize: 11, color: C.ghost }}>Click a type to see its saved profiles</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ ...cardLabel, marginBottom: 10 }}>Geographic spread</div>
            {geo.map(row => (
              <button key={row.st} className="iq-bar" onClick={() => setDrill({ mode: "geo", key: row.st, label: `${row.st} — saved profiles` })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 6px", margin: "0 -6px", border: "none", borderBottom: `1px solid ${C.line2}`, background: "none", cursor: "pointer", fontFamily: FONT, fontSize: 13, width: "100%", textAlign: "left" }}>
                <span style={{ fontWeight: 600, fontFamily: MONO, width: 32, flexShrink: 0 }}>{row.st}</span>
                <span style={{ flex: 1, fontSize: 12, color: C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{row.cities.join(", ")}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: C.accent, background: C.tint, borderRadius: 20, padding: "2px 9px", flexShrink: 0, fontFamily: MONO }}>{row.c}</span>
              </button>
            ))}
            <div style={{ marginTop: 8, fontSize: 11, color: C.ghost }}>Click a state to see its saved profiles</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= root ================= */

export default function InsuredIQ() {
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dbRecords, setDbRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const timers = useRef([]);

  useEffect(() => {
    if (!document.getElementById("iq-global-css")) {
      const st = document.createElement("style");
      st.id = "iq-global-css";
      st.textContent = GLOBAL_CSS;
      document.head.appendChild(st);
    }
    loadDb();
  }, []);

  async function loadDb() {
    try {
      const records = await loadProfiles();
      setDbRecords((records || []).map(r => ({ id: r.id, savedAt: r.saved_at, query: r.query, profile: r.profile })));
    } catch (e) { console.error(e); }
  }

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  async function runSearch(bizName) {
    const q = (bizName != null ? bizName : query);
    if (!q.trim() || loading) return;
    clearTimers();
    setTab("search");
    setFocused(false);
    setSelectedRecord(null);
    setLoading(true);
    setProfile(null);
    setError(null);
    setSaved(false);
    setStatusIdx(0);
    STATUS_STEPS.forEach((step, i) => { if (i === 0) return; timers.current.push(setTimeout(() => setStatusIdx(i), step.delay)); });

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
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
        else throw new Error("No business found for that input. Try a business name with city and state for best results.");
      }

      let finalProfile = { ...parsed };
      try {
        const placesRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${parsed.businessName} ${parsed.contact?.city || ""} ${parsed.contact?.state || ""}` }),
        });
        const placesData = await placesRes.json();
        if (placesData.found && placesData.result) {
          const gp = placesData.result;
          finalProfile = {
            ...finalProfile,
            contact: {
              ...finalProfile.contact,
              phone: gp.formatted_phone_number || finalProfile.contact?.phone,
              website: gp.website || finalProfile.contact?.website,
              address: gp.formatted_address || finalProfile.contact?.address,
            },
            dataSourceNotes: (finalProfile.dataSourceNotes || "") + " · Verified against Google Places.",
          };
        } else {
          finalProfile = { ...finalProfile, dataSourceNotes: (finalProfile.dataSourceNotes || "") + " · Not found on Google Places — unverified." };
        }
      } catch (placesErr) {
        console.error("Places lookup failed", placesErr);
        finalProfile = { ...finalProfile, dataSourceNotes: (finalProfile.dataSourceNotes || "") + " · Google Places check failed." };
      }

      setProfile(finalProfile);
    } catch (err) {
      setError(err.message || "Unknown error. Please try again.");
    } finally {
      clearTimers();
      setLoading(false);
    }
  }

  async function saveToDb() {
    if (!profile || saved) return;
    const id = `insurediq:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record = { id, savedAt: Date.now(), query, profile };
    try {
      await saveProfile(record);
      setSaved(true);
      setDbRecords(prev => [record, ...prev]);
    } catch (e) { alert("Save failed: " + e.message); }
  }

  async function deleteRecord(id, e) {
    e.stopPropagation();
    try {
      await deleteProfile(id);
      setDbRecords(prev => prev.filter(r => r.id !== id));
      if (selectedRecord?.id === id) setSelectedRecord(null);
    } catch (e) { console.error(e); }
  }

  function copyProfile(target) {
    const p = target || profile;
    if (!p) return;
    const addr = [p.contact?.address, p.contact?.city, p.contact?.state, p.contact?.zip].filter(Boolean).join(", ");
    const lines = [
      `INSUREDIQ PROFILE — ${new Date().toLocaleDateString()}`, ``,
      `Business Name: ${p.businessName}${p.dba ? ` (dba ${p.dba})` : ""}`,
      `Address: ${addr}`, `Phone: ${p.contact?.phone || ""}`,
      `Website: ${p.contact?.website || ""}`, `Email: ${p.contact?.email || ""}`, ``,
      `Entity Type: ${p.businessDetails?.legalEntity || ""}`,
      `Year Founded: ${p.businessDetails?.yearFounded || ""}`,
      `Employees: ${p.businessDetails?.employeeCount || ""}`,
      `Est. Revenue: ${p.businessDetails?.annualRevenue || ""}`, ``,
      `NAICS: ${p.classCodes?.naics?.code || ""} — ${p.classCodes?.naics?.description || ""}`,
      `SIC: ${p.classCodes?.sic?.code || ""} — ${p.classCodes?.sic?.description || ""}`,
      `GL Class: ${p.classCodes?.glClass || ""}`, ``, `OPERATIONS:`, p.operations, ``,
      `COVERAGE RECOMMENDATIONS:`,
      ...(p.coverageRecommendations || []).map(c => `[${c.priority.toUpperCase()}] ${c.coverage} — ${c.reason}`), ``,
      ...(p.flags?.length ? [`UNDERWRITING FLAGS:`, ...p.flags.map(f => `• ${f}`), ``] : []),
      `Confidence: ${p.confidence} — ${p.dataSourceNotes || ""}`,
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function openSavedProfile(record) {
    setProfile(record.profile);
    setSaved(true);
    setSelectedRecord(null);
    setTab("search");
    setFocused(false);
    setQuery("");
  }

  // typeahead: saved profiles only
  const q = query.trim().toLowerCase();
  const suggestions = q ? dbRecords.filter(r => (r.profile?.businessName || "").toLowerCase().includes(q)).slice(0, 6) : [];
  const showSuggest = focused && suggestions.length > 0;

  const step = STATUS_STEPS[statusIdx] || STATUS_STEPS[0];
  const highCount = dbRecords.filter(r => r.profile?.confidence === "high").length;
  const flagCount = dbRecords.filter(r => (r.profile?.flags?.length || 0) > 0).length;

  const navItem = (id, label, icon) => {
    const active = tab === id;
    return (
      <button key={id} onClick={() => { setTab(id); setSelectedRecord(null); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, padding: "9px 12px", borderRadius: 9, background: active ? C.tint : "transparent", color: active ? C.accent : "#4a4a45", fontWeight: active ? 600 : 500 }}>
        {icon}{label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.canvas, color: C.ink, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}>
      {/* ---------- left rail ---------- */}
      <aside style={{ width: 272, flexShrink: 0, height: "100vh", position: "sticky", top: 0, background: C.rail, borderRight: `1px solid rgba(28,28,26,0.10)`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "22px 20px", borderBottom: `1px solid rgba(28,28,26,0.08)` }}>
          <img src={LOGO_SRC} alt="Paradox" style={{ width: 42, height: 42, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: -0.3 }}>InsuredIQ</div>
            <div style={{ fontSize: 12, color: C.faint }}>by Paradox Insurance</div>
          </div>
        </div>

        <div style={{ padding: "16px 18px", borderBottom: `1px solid rgba(28,28,26,0.08)` }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.faint, marginBottom: 8 }}>Research a business</label>
          <div style={{ position: "relative" }}>
            <input className="iq-input" value={query}
              onChange={e => { setQuery(e.target.value); setFocused(true); }}
              onKeyDown={e => { if (e.key === "Enter") { setFocused(false); runSearch(); } }}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 130)}
              placeholder="Business name or address…"
              style={{ width: 236, height: 40, border: "1px solid rgba(28,28,26,0.18)", borderRadius: 9, padding: "0 12px", fontSize: 13.5, fontFamily: FONT, color: C.ink, background: "#fff", outline: "none" }} />
            {showSuggest && (
              <div style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 30, background: "#fff", border: "1px solid rgba(28,28,26,0.14)", borderRadius: 10, boxShadow: "0 10px 28px rgba(28,28,26,0.14)", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px 5px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: C.ghost }}>Saved profiles</div>
                {suggestions.map(r => (
                  <button key={r.id} className="iq-suggest" onMouseDown={() => openSavedProfile(r)} style={{ width: "100%", textAlign: "left", border: "none", background: "none", cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 9, padding: "8px 12px" }}>
                    <span style={confDot(r.profile?.confidence)} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.profile?.businessName}</span>
                      <span style={{ display: "block", fontSize: 11, color: C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[r.profile?.contact?.city, r.profile?.contact?.state].filter(Boolean).join(", ")}</span>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: C.green, background: C.greenBg, borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>Saved</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="iq-primary" onClick={() => runSearch()} disabled={loading} style={{ marginTop: 8, width: "100%", height: 38, background: C.accent, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            {loading ? "Researching…" : "Research business"}
          </button>
        </div>

        <nav style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2, borderBottom: `1px solid rgba(28,28,26,0.08)` }}>
          {navItem("search", "Research", <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>)}
          {navItem("database", "Team database", <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>)}
          {navItem("insights", "Insights", <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></svg>)}
        </nav>

        <div style={{ padding: "15px 16px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.faint }}>Team database</span>
          <span style={{ fontSize: 11, color: C.faint }}>{dbRecords.length}</span>
        </div>
        <div className="iq-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
          {dbRecords.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: C.ghost, lineHeight: 1.5 }}>No saved profiles yet. Research a business and save it to share with the team.</div>}
          {dbRecords.map(r => (
            <button key={r.id} className="iq-row" onClick={() => openSavedProfile(r)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: FONT, padding: "8px 10px", borderRadius: 9, background: "transparent" }}>
              <span style={confDot(r.profile?.confidence)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.profile?.businessName}</span>
                <span style={{ display: "block", fontSize: 11, color: C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[r.profile?.contact?.city, r.profile?.contact?.state].filter(Boolean).join(", ")}</span>
              </span>
              {(r.profile?.flags?.length || 0) > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: C.amber, background: C.amberBg, borderRadius: 20, padding: "1px 6px", flexShrink: 0 }}>{r.profile.flags.length}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: "11px 18px", borderTop: `1px solid rgba(28,28,26,0.08)`, fontSize: 11, color: C.faint, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2E7D46", flexShrink: 0 }} /> Shared workspace · live
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <main className="iq-scroll" style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "34px 46px" }}>

          {tab === "search" && (
            <>
              {loading && <LoadingState step={step} />}
              {!loading && error && (
                <div style={{ background: C.redBg, border: "1px solid rgba(178,58,50,0.25)", borderRadius: 12, padding: "16px 20px", fontSize: 13.5, color: "#791F1F" }}>
                  Research failed: {error}
                </div>
              )}
              {!loading && !error && profile && (
                <ProfileDossier profile={profile} onCopy={() => copyProfile()} onSave={saveToDb} copied={copied} saved={saved} showSaveHint />
              )}
              {!loading && !error && !profile && <EmptyResearch />}
            </>
          )}

          {tab === "database" && (
            selectedRecord ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                  <button className="iq-link" onClick={() => setSelectedRecord(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 12.5, color: C.accent, padding: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> Back to database
                  </button>
                  <span style={{ fontSize: 12, color: C.faint }}>Saved {new Date(selectedRecord.savedAt).toLocaleDateString()} · searched as “{selectedRecord.query}”</span>
                </div>
                <ProfileDossier profile={selectedRecord.profile} onCopy={() => copyProfile(selectedRecord.profile)} onSave={() => {}} copied={copied} saved={true} />
              </>
            ) : (
              <>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>Team database</h1>
                <p style={{ margin: "6px 0 22px", fontSize: 13.5, color: C.muted }}>Every profile the team saves is stored here and visible to everyone — click any row to open it.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}><div style={{ fontSize: 24, fontWeight: 600, color: C.accent, fontFamily: MONO }}>{dbRecords.length}</div><div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>Profiles saved</div></div>
                  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}><div style={{ fontSize: 24, fontWeight: 600, color: C.green, fontFamily: MONO }}>{highCount}</div><div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>High confidence</div></div>
                  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px" }}><div style={{ fontSize: 24, fontWeight: 600, color: "#C08A2E", fontFamily: MONO }}>{flagCount}</div><div style={{ fontSize: 11.5, color: C.faint, marginTop: 2 }}>With UW flags</div></div>
                </div>
                {dbRecords.length === 0 ? (
                  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "48px 20px", textAlign: "center", color: C.faint, fontSize: 13.5 }}>No profiles saved yet — research a business and click “Save to database”.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {dbRecords.map(record => (
                      <div key={record.id} className="iq-dbrow" onClick={() => setSelectedRecord(record)} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, cursor: "pointer" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: C.ink }}>{record.profile?.businessName}</div>
                          <div style={{ fontSize: 12, color: C.faint, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[record.profile?.contact?.city, record.profile?.contact?.state].filter(Boolean).join(", ")}{record.profile?.classCodes?.naics?.description ? ` · ${record.profile.classCodes.naics.description}` : ""}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <ConfPill confidence={record.profile?.confidence} />
                          {(record.profile?.flags?.length || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberBg, borderRadius: 20, padding: "2px 8px" }}>{record.profile.flags.length} flag{record.profile.flags.length > 1 ? "s" : ""}</span>}
                          <span style={{ fontSize: 11, color: C.ghost }}>{new Date(record.savedAt).toLocaleDateString()}</span>
                          <button onClick={(e) => deleteRecord(record.id, e)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: C.ghost, fontSize: 16, padding: "2px 6px", lineHeight: 1, fontFamily: FONT }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          )}

          {tab === "insights" && <Insights records={dbRecords} onOpenRecord={openSavedProfile} />}
        </div>
      </main>
    </div>
  );
}
