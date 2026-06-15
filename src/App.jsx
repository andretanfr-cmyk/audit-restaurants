import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://kcabmieqsqjchfjjxbnj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYWJtaWVxc3FqY2hmamp4Ym5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzE4OTksImV4cCI6MjA5Njk0Nzg5OX0.dIAeEtM-FRBuF34XMLmwpBrkNwtLO17V7j8qdlC_TkU";

const LOGINS = { DG: "Direction2024!", DO: "Ops2024!" };
const LABELS = { DG: "Directeur(rice) Général(e)", DO: "Directeur Opérationnel" };

// ── MODÈLE PAR DÉFAUT (utilisé seulement si aucun modèle n'existe encore en base) ──
const DEFAULT_SECS = [
  { id:"ouv", t:"Ouverture & Mise en place", p:15, cr:[
    {id:"o1",l:"Présentoirs / devanture propres et attractifs",d:"Vitre, enseignes, ardoise, menu extérieur"},
    {id:"o2",l:"Salle prête avant le premier couvert",d:"Tables dressées, mise en place complète"},
    {id:"o3",l:"Staff en tenue à l'heure de l'ouverture",d:"Uniformes, badges, hygiène personnelle"},
    {id:"o4",l:"Briefing équipe réalisé, plan de salle optimisé",d:"Réservations connues, VIP signalés"},
    {id:"o5",l:"Produits frais réceptionnés et contrôlés",d:"DLC, T°C, conformité bon de livraison"},
  ]},
  { id:"acc", t:"Accueil & Expérience client", p:20, cr:[
    {id:"a1",l:"Accueil à l'entrée en moins de 30 secondes",d:"Contact visuel, sourire, formule de bienvenue"},
    {id:"a2",l:"Placement et installation fluides",d:"Manteau pris, chaises avancées, carte présentée"},
    {id:"a3",l:"Prise de commande en moins de 5 minutes",d:""},
    {id:"a4",l:"Personnel connaît la carte, allergènes, suggestions",d:"Test spot possible sur 1-2 serveurs"},
    {id:"a5",l:"Gestion des insatisfactions : immédiate et proactive",d:"Pas d'escalade client visible"},
    {id:"a6",l:"Prise de congé et fidélisation",d:"Formule de départ, invitation à revenir"},
  ]},
  { id:"cui", t:"Cuisine & Qualité des Plats", p:25, cr:[
    {id:"c1",l:"Respect des fiches techniques (présentation, grammages)",d:"Contrôle visuel sur envois"},
    {id:"c2",l:"Température des plats à l'envoi conforme",d:"Chaud / froid selon type de plat"},
    {id:"c3",l:"Temps de ticket respecté",d:"Entrée / plat / dessert"},
    {id:"c4",l:"Taux de retour / refus de plat < 1%",d:""},
    {id:"c5",l:"Organisation et propreté du poste en service",d:"Pas de croisements, organisation FIFO"},
    {id:"c6",l:"Zéro rupture non annoncée en salle",d:"Communication en temps réel cuisine–salle"},
  ]},
  { id:"hyg", t:"Hygiène & Sécurité Alimentaire", p:20, cr:[
    {id:"h1",l:"Plan de nettoyage affiché et signé à jour",d:"HACCP – document accessible"},
    {id:"h2",l:"Températures relevées et enregistrées",d:"Cahier ou logiciel de traçabilité"},
    {id:"h3",l:"Séparation physique zones propres / sales",d:"Pas de croisement flux"},
    {id:"h4",l:"Hygiène des mains : stations équipées, utilisation effective",d:""},
    {id:"h5",l:"Stockage conforme (dates, étiquetage, hauteur sol)",d:"Pas de produits périmés en stock actif"},
    {id:"h6",l:"Nuisibles : aucun signe de présence",d:"Bandes collantes, registre dératisation"},
  ]},
  { id:"cash", t:"Caisse & Gestion", p:10, cr:[
    {id:"k1",l:"Fond de caisse conforme en début de service",d:""},
    {id:"k2",l:"Tickets de caisse conformes (mentions légales, TVA)",d:""},
    {id:"k3",l:"Zéro offert hors procédure / autorisation",d:"Traçabilité des gestes commerciaux"},
    {id:"k4",l:"Vérification taux de no-show / annulations",d:""},
  ]},
  { id:"eq", t:"Management & Équipe", p:5, cr:[
    {id:"e1",l:"Planning affiché et respecté",d:"Pas d'absent non remplacé en service"},
    {id:"e2",l:"Manager de salle identifié, proactif, visible",d:""},
    {id:"e3",l:"Ambiance équipe : cohésion, pas de tensions",d:""},
    {id:"e4",l:"Objectifs du service communiqués",d:"CA, couverts, taux de retour"},
  ]},
  { id:"inf", t:"Infrastructures & Entretien", p:5, cr:[
    {id:"i1",l:"Toilettes propres, contrôlées toutes les heures",d:"Fiche de passage visible"},
    {id:"i2",l:"Mobilier en bon état (chaises, tables, sols)",d:"Aucun mobilier dégradé visible par le client"},
    {id:"i3",l:"Éclairage fonctionnel et adapté à l'ambiance",d:""},
    {id:"i4",l:"Matériels de service en bon état",d:"Pas d'ébréchure, rayures sur verres"},
  ]},
];

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────
const headers = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` };

async function dbGet(table, params = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function dbInsert(table, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function dbUpdate(table, id, data) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH", headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function dbDelete(table, id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "DELETE", headers
  });
  if (!r.ok) throw new Error(await r.text());
}
async function dbUpsert(table, data, onConflict) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { ...headers, "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function freshSC(secs) {
  const s = {};
  secs.forEach(sec => sec.cr.forEach(c => { s[c.id] = { note: null, na: false, flag: false, cmt: "" }; }));
  return s;
}

function calcGlobal(SC, secs) {
  let pts = 0, pw = 0;
  const secScores = {};
  secs.forEach(sec => {
    const active = sec.cr.filter(c => SC[c.id] && !SC[c.id].na && SC[c.id].note !== null);
    if (!active.length) { secScores[sec.id] = null; return; }
    const sum = active.reduce((a, c) => a + SC[c.id].note, 0);
    const pct = Math.round(sum / (active.length * 3) * 100);
    secScores[sec.id] = pct;
    pts += pct * (sec.p / 100);
    pw += sec.p;
  });
  return { global: pw > 0 ? Math.round(pts / pw * 100) : null, secScores };
}

function scoreColor(s) {
  if (s === null) return "#777";
  if (s >= 85) return "#2A7A4B";
  if (s >= 70) return "#2A5E7A";
  if (s >= 50) return "#E07B2A";
  return "#C8402A";
}

function verdictInfo(s) {
  if (s === null) return { label: "En attente", bg: "#555" };
  if (s >= 85) return { label: "Excellent", bg: "#2A7A4B" };
  if (s >= 70) return { label: "Satisfaisant", bg: "#2A5E7A" };
  if (s >= 50) return { label: "À améliorer", bg: "#E07B2A" };
  return { label: "Critique — Action immédiate", bg: "#C8402A" };
}

function hexToRgb(hex) {
  const h = hex.replace("#","");
  const bigint = parseInt(h, 16);
  return [(bigint>>16)&255, (bigint>>8)&255, bigint&255];
}

function fDate(d) {
  if (!d) return "—";
  const [y, m, j] = d.split("-"); return `${j}/${m}/${y}`;
}
function fDT(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function compressImage(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        const max = 900;
        if (w > h && w > max) { h = h * max / w; w = max; }
        else if (h > max) { w = w * max / h; h = max; }
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve({ id: "p" + Date.now() + Math.random().toString(36).slice(2, 5), data: cv.toDataURL("image/jpeg", 0.65) });
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  });
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
function exportAuditPDF(audit, secs, restoName) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15;
  let y = 0;

  // Header band
  doc.setFillColor(15,15,15);
  doc.rect(0,0,W,30,"F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(15);
  doc.text("AUDIT OPÉRATIONNEL", M, 12);
  doc.setFontSize(11);
  doc.setFont("helvetica","normal");
  doc.text(restoName || "Restaurant", M, 19);
  doc.setFontSize(9);
  doc.setTextColor(200,200,200);
  doc.text(`${fDate(audit.date)} — ${audit.service||"Service non précisé"} — Audité par ${audit.auteur||"—"}`, M, 25);

  y = 40;

  // Score global block
  const { global, secScores } = calcGlobal(audit.scores, secs);
  const { label, bg } = verdictInfo(global);
  const [r,g,b] = hexToRgb(bg);
  doc.setFillColor(r,g,b);
  doc.roundedRect(M, y, 38, 22, 2, 2, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(20);
  doc.text(global!==null?`${global}%`:"–", M+19, y+14, {align:"center"});

  doc.setTextColor(0,0,0);
  doc.setFontSize(13);
  doc.text("Score Global", M+46, y+8);
  doc.setFillColor(r,g,b);
  doc.roundedRect(M+46, y+11, 38, 7, 1, 1, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(9);
  doc.setFont("helvetica","bold");
  doc.text(label, M+65, y+15.5, {align:"center"});
  doc.setTextColor(0,0,0);
  doc.setFont("helvetica","normal");

  y += 32;

  // Section scores
  doc.setFont("helvetica","bold");
  doc.setFontSize(11);
  doc.text("Scores par section", M, y);
  y += 7;
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);

  secs.forEach(sec => {
    const pct = secScores[sec.id];
    const col = scoreColor(pct);
    const [rr,gg,bb] = hexToRgb(col);
    doc.setFillColor(rr,gg,bb);
    doc.rect(M, y-3.2, 6, 4.2, "F");
    doc.text(`${sec.t}  (poids ${sec.p}%)`, M+9, y);
    doc.setFont("helvetica","bold");
    doc.text(pct!==null?`${pct}%`:"–", W-M, y, {align:"right"});
    doc.setFont("helvetica","normal");
    y += 6;
    if (y > 275) { doc.addPage(); y = M; }
  });

  y += 4;

  // Points critiques / observations (notes 0-1)
  const criticalRows = [];
  secs.forEach(sec => sec.cr.forEach(c => {
    const s = audit.scores[c.id];
    if (s && !s.na && s.note !== null && s.note <= 1) {
      criticalRows.push({ label: c.l, note: s.note, cmt: s.cmt || "" });
    }
  }));

  if (criticalRows.length) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFont("helvetica","bold");
    doc.setFontSize(11);
    doc.text("Points nécessitant une action (notes 0-1)", M, y);
    y += 7;
    doc.setFontSize(9);
    criticalRows.forEach(row => {
      if (y > 275) { doc.addPage(); y = M; }
      const col = row.note === 0 ? [200,64,42] : [224,123,42];
      doc.setFillColor(...col);
      doc.circle(M+1.5, y-1, 1.5, "F");
      doc.setFont("helvetica","bold");
      doc.text(`[${row.note}]`, M+5, y);
      doc.setFont("helvetica","normal");
      const lines = doc.splitTextToSize(row.label, W - 2*M - 10);
      doc.text(lines, M+12, y);
      y += lines.length * 4.5;
      if (row.cmt) {
        doc.setTextColor(110,110,110);
        doc.setFont("helvetica","italic");
        const cl = doc.splitTextToSize("→ " + row.cmt, W - 2*M - 14);
        if (y > 275) { doc.addPage(); y = M; }
        doc.text(cl, M+14, y);
        y += cl.length * 4.5;
        doc.setTextColor(0,0,0);
        doc.setFont("helvetica","normal");
      }
      y += 2;
    });
    y += 4;
  }

  // Text blocks
  const addTextBlock = (title, text) => {
    if (!text || !text.trim()) return;
    if (y > 260) { doc.addPage(); y = M; }
    doc.setFont("helvetica","bold"); doc.setFontSize(11);
    doc.text(title, M, y); y += 6;
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, W-2*M);
    lines.forEach(line => {
      if (y > 280) { doc.addPage(); y = M; }
      doc.text(line, M, y); y += 4.5;
    });
    y += 5;
  };
  addTextBlock("🔴 Points critiques à remonter", audit.points_critiques);
  addTextBlock("✅ Points forts constatés", audit.points_forts);
  addTextBlock("📋 Plan d'action immédiat", audit.plan_action);

  // Photos
  const photos = audit.photos || [];
  if (photos.length) {
    photos.forEach((p, idx) => {
      doc.addPage();
      doc.setFont("helvetica","bold");
      doc.setFontSize(10);
      doc.text(`Photo ${idx+1} / ${photos.length}`, M, M-3);
      try {
        const props = doc.getImageProperties(p.data);
        const imgW = W - 2*M;
        const imgH = Math.min(imgW * props.height / props.width, 260);
        doc.addImage(p.data, "JPEG", M, M, imgW, imgH);
      } catch(e) {
        doc.text("(image illisible)", M, M+10);
      }
    });
  }

  const safeName = (restoName||"restaurant").replace(/[^a-z0-9]+/gi,"_");
  doc.save(`audit_${safeName}_${audit.date||"sans-date"}.pdf`);
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const inp = { width: "100%", padding: "9px 11px", border: "1.5px solid #E0E0E0", borderRadius: 3, fontFamily: "inherit", fontSize: 13, outline: "none", background: "white" };
const btn = { border: "none", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 18px" };
const lbl = { display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: ".8px", color: "#9A9A9A", marginBottom: 4 };

// ── TOAST ─────────────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position:"fixed", bottom:20, right:20, background:"#1A1A2E", color:"white", padding:"12px 20px", borderRadius:4, fontSize:13, zIndex:1000, boxShadow:"0 4px 20px rgba(0,0,0,.3)" }}>{msg}</div>;
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  const go = () => {
    if (!u || LOGINS[u] !== p) { setErr(true); return; }
    onLogin(u);
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#1A1A2E" }}>
      <div style={{ background:"#F8F6F1", padding:40, borderRadius:6, width:300, boxShadow:"0 20px 60px rgba(0,0,0,.4)" }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>Portail Audit</div>
        <div style={{ fontSize:12, color:"#9A9A9A", marginBottom:24 }}>Accès réservé — Direction</div>
        {err && <div style={{ color:"#C8402A", fontSize:12, marginBottom:12 }}>Identifiant ou mot de passe incorrect.</div>}
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Profil</label>
          <select value={u} onChange={e=>setU(e.target.value)} style={{ ...inp }}>
            <option value="">— Sélectionner —</option>
            <option value="DG">Directeur / Directrice Général(e)</option>
            <option value="DO">Directeur Opérationnel</option>
          </select>
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={lbl}>Mot de passe</label>
          <input type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} style={inp} />
        </div>
        <button onClick={go} style={{ ...btn, background:"#1A1A2E", color:"white", width:"100%" }}>Se connecter</button>
      </div>
    </div>
  );
}

// ── SCORE HEADER ──────────────────────────────────────────────────────────────
function ScoreHeader({ SC, secs }) {
  const { global, secScores } = calcGlobal(SC, secs);
  const circ = 238.76;
  const { label, bg } = verdictInfo(global);
  return (
    <div style={{ background:"#0F0F0F", color:"#F8F6F1", padding:"18px 22px", borderRadius:5, marginBottom:20, borderBottom:"3px solid #C8402A", display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
      <div style={{ position:"relative", width:76, height:76, flexShrink:0 }}>
        <svg width="76" height="76" viewBox="0 0 90 90" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6"/>
          <circle cx="45" cy="45" r="38" fill="none" stroke={bg} strokeWidth="6"
            strokeDasharray={`${global!==null?(global/100*circ):0} ${circ}`} strokeLinecap="round"/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:700, lineHeight:1 }}>{global!==null?global:"–"}</span>
          <span style={{ fontSize:9, color:"#9A9A9A" }}>/100</span>
        </div>
      </div>
      <div>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, marginBottom:7 }}>Score Global</div>
        <span style={{ display:"inline-block", background:bg, padding:"4px 12px", borderRadius:2, fontSize:11, fontWeight:600, letterSpacing:".8px", textTransform:"uppercase" }}>{label}</span>
      </div>
      <div style={{ flex:1, minWidth:200, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px 16px" }}>
        {secs.map(sec => {
          const pct = secScores[sec.id];
          const c = scoreColor(pct);
          return (
            <div key={sec.id} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10 }}>
              <span style={{ width:90, flexShrink:0, color:"rgba(255,255,255,.45)", textTransform:"uppercase", letterSpacing:".3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sec.t}</span>
              <div style={{ flex:1, height:3, background:"rgba(255,255,255,.1)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct||0}%`, background:c, borderRadius:2 }}/>
              </div>
              <span style={{ width:28, textAlign:"right", fontWeight:700, color:pct!==null?c:"#555" }}>{pct!==null?pct+"%":"–"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AUDIT FORM ────────────────────────────────────────────────────────────────
function AuditForm({ restoId, auditId, userName, secs, onSaved, onBack }) {
  const [SC, setSC] = useState(() => freshSC(secs));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [service, setService] = useState("");
  const [crit, setCrit] = useState("");
  const [pos, setPos] = useState("");
  const [plan, setPlan] = useState("");
  const [photos, setPhotos] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [lb, setLb] = useState(null);
  const [loading, setLoading] = useState(!!auditId);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!auditId) return;
    (async () => {
      try {
        const rows = await dbGet("audits", `id=eq.${auditId}&select=*`);
        if (!rows.length) return;
        const a = rows[0];
        const sc = a.scores || freshSC(secs);
        secs.forEach(sec => sec.cr.forEach(c => { if (!sc[c.id]) sc[c.id] = { note:null, na:false, flag:false, cmt:"" }; }));
        setSC(sc);
        setDate(a.date || "");
        setService(a.service || "");
        setCrit(a.points_critiques || "");
        setPos(a.points_forts || "");
        setPlan(a.plan_action || "");
        setPhotos(a.photos || []);
      } catch(e) { showToast("Erreur de chargement"); }
      setLoading(false);
    })();
  }, [auditId]);

  const setN = (id, n) => setSC(prev => ({ ...prev, [id]: { ...prev[id], na:false, note: prev[id].note===n ? null : n } }));
  const setNA = (id) => setSC(prev => ({ ...prev, [id]: { ...prev[id], na:!prev[id].na, note:null } }));
  const setFlag = (id) => setSC(prev => ({ ...prev, [id]: { ...prev[id], flag:!prev[id].flag } }));
  const setCmt = (id, v) => setSC(prev => ({ ...prev, [id]: { ...prev[id], cmt:v } }));

  const handlePhotos = async (files) => {
    const arr = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (photos.length + arr.length >= 20) { showToast("Limite 20 photos atteinte"); break; }
      arr.push(await compressImage(f));
    }
    setPhotos(prev => [...prev, ...arr]);
  };

  const save = async () => {
    setSaving(true);
    const { global } = calcGlobal(SC, secs);
    const payload = {
      restaurant_id: restoId,
      date, service,
      auteur: LABELS[userName],
      scores: SC,
      photos,
      points_critiques: crit,
      points_forts: pos,
      plan_action: plan,
      score_global: global
    };
    try {
      if (auditId) {
        await dbUpdate("audits", auditId, payload);
      } else {
        const rows = await dbInsert("audits", payload);
        onSaved(rows[0].id);
      }
      showToast("Audit enregistré ✓");
    } catch(e) {
      showToast("Erreur : " + e.message);
    }
    setSaving(false);
  };

  const del = async () => {
    if (!auditId || !window.confirm("Supprimer cet audit définitivement ?")) return;
    try {
      await dbDelete("audits", auditId);
      showToast("Supprimé");
      setTimeout(onBack, 600);
    } catch(e) { showToast("Erreur suppression"); }
  };

  if (loading) return <div style={{ textAlign:"center", padding:60, color:"#9A9A9A" }}>Chargement...</div>;

  return (
    <div>
      <Toast msg={toast} />
      {lb && (
        <div onClick={()=>setLb(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, cursor:"zoom-out" }}>
          <img src={lb} style={{ maxWidth:"90vw", maxHeight:"90vh", borderRadius:4 }} alt="photo" />
        </div>
      )}

      {/* Meta */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 20px", marginBottom:20 }}>
        <div><label style={lbl}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Service</label><input type="text" value={service} onChange={e=>setService(e.target.value)} placeholder="Déj / Dîner / Continu" style={inp} /></div>
      </div>

      <ScoreHeader SC={SC} secs={secs} />

      {/* Sections */}
      {secs.map((sec, si) => (
        <div key={sec.id} style={{ marginBottom:14, border:"1px solid #E8E8E8", borderRadius:4, overflow:"hidden" }}>
          <div onClick={()=>setCollapsed(p=>({...p,[sec.id]:!p[sec.id]}))}
            style={{ background:"#0F0F0F", color:"#F8F6F1", padding:"11px 16px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", userSelect:"none" }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:10, color:"#C8402A", fontWeight:700, letterSpacing:1 }}>0{si+1}</span>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.4, flex:1 }}>{sec.t}</span>
            <span style={{ fontSize:12, transition:"transform .3s", display:"inline-block", transform:collapsed[sec.id]?"rotate(-90deg)":"rotate(0deg)" }}>▾</span>
          </div>
          {!collapsed[sec.id] && sec.cr.map((cr, ci) => {
            const s = SC[cr.id] || { note:null, na:false, flag:false, cmt:"" };
            const noteColors = ["#C8402A","#E07B2A","#D4A020","#2A7A4B"];
            return (
              <div key={cr.id} style={{ display:"grid", gridTemplateColumns:"26px 1fr auto", alignItems:"start", gap:10, padding:"10px 16px", borderBottom:ci<sec.cr.length-1?"1px solid #F0F0F0":"none", background:"white" }}>
                <div style={{ fontSize:10, color:"#9A9A9A", paddingTop:6 }}>{si+1}.{ci+1}</div>
                <div>
                  <div style={{ fontSize:12.5, lineHeight:1.45 }}>{cr.l}</div>
                  {cr.d && <div style={{ fontSize:10.5, color:"#9A9A9A", marginTop:2 }}>{cr.d}</div>}
                  {s.note!==null && s.note<=1 && (
                    <input type="text" value={s.cmt} onChange={e=>setCmt(cr.id,e.target.value)} placeholder="Observation..." style={{ ...inp, marginTop:6, fontSize:12, padding:"5px 9px" }} />
                  )}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:3, paddingTop:4, flexShrink:0 }}>
                  {[0,1,2,3].map(n => {
                    const active = !s.na && s.note===n;
                    return <button key={n} onClick={()=>setN(cr.id,n)} style={{ width:29, height:29, border:`1.5px solid ${active?noteColors[n]:"#E0E0E0"}`, background:active?noteColors[n]:"white", borderRadius:3, cursor:"pointer", fontSize:11, fontWeight:700, color:active?"white":"#9A9A9A" }}>{n}</button>;
                  })}
                  <button onClick={()=>setNA(cr.id)} style={{ width:33, height:29, border:`1.5px solid ${s.na?"#1A1A2E":"#E0E0E0"}`, background:s.na?"#1A1A2E":"white", borderRadius:3, cursor:"pointer", fontSize:10, fontWeight:700, color:s.na?"white":"#9A9A9A" }}>N/A</button>
                  <button onClick={()=>setFlag(cr.id)} style={{ width:25, height:25, border:`1.5px solid ${s.flag?"#C8402A":"#E0E0E0"}`, background:s.flag?"#C8402A":"white", borderRadius:3, cursor:"pointer", fontSize:12, marginLeft:4 }}>🚩</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Obs */}
      {[["🔴 Points critiques à remonter", crit, setCrit], ["✅ Points forts constatés", pos, setPos], ["📋 Plan d'action immédiat", plan, setPlan]].map(([title, val, setter]) => (
        <div key={title} style={{ border:"1px solid #E8E8E8", borderRadius:4, overflow:"hidden", marginBottom:14 }}>
          <div style={{ background:"#F5F3EE", padding:"10px 16px", fontFamily:"'Space Grotesk',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>{title}</div>
          <div style={{ padding:"12px 16px" }}>
            <textarea value={val} onChange={e=>setter(e.target.value)} style={{ ...inp, minHeight:65, resize:"vertical" }} />
          </div>
        </div>
      ))}

      {/* Photos */}
      <div style={{ border:"1px solid #E8E8E8", borderRadius:4, overflow:"hidden", marginBottom:14 }}>
        <div style={{ background:"#F5F3EE", padding:"10px 16px", fontFamily:"'Space Grotesk',sans-serif", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>📷 Photos de l'audit</div>
        <div style={{ padding:"12px 16px" }}>
          <label style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 14px", border:"1.5px dashed #E0E0E0", borderRadius:4, cursor:"pointer", fontSize:12, color:"#9A9A9A", fontWeight:600 }}>
            + Ajouter des photos
            <input type="file" accept="image/*" multiple onChange={e=>handlePhotos(e.target.files)} style={{ display:"none" }} />
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:8, marginTop:10 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position:"relative", borderRadius:4, overflow:"hidden", border:"1px solid #E8E8E8", aspectRatio:"1" }}>
                <img src={p.data} onClick={()=>setLb(p.data)} style={{ width:"100%", height:"100%", objectFit:"cover", cursor:"pointer", display:"block" }} alt="" />
                <button onClick={()=>setPhotos(prev=>prev.filter(x=>x.id!==p.id))} style={{ position:"absolute", top:3, right:3, width:20, height:20, background:"rgba(0,0,0,.65)", color:"white", border:"none", borderRadius:2, cursor:"pointer", fontSize:11, lineHeight:1 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingBottom:40, flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:11, color:"#9A9A9A" }}>
          {[["#2A7A4B","Conforme (3)"],["#D4A020","À améliorer (2)"],["#E07B2A","Non-conforme (1)"],["#C8402A","Critique (0)"]].map(([c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:c }}/>{l}</div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {auditId && <button onClick={del} style={{ ...btn, background:"#C8402A", color:"white", fontSize:12, padding:"8px 14px" }}>🗑 Supprimer</button>}
          <button onClick={save} disabled={saving} style={{ ...btn, background:"#1A1A2E", color:"white", fontSize:12, padding:"8px 14px", opacity:saving?.7:1 }}>
            {saving ? "Enregistrement..." : "💾 Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
function History({ restoId, restoName, secs, onOpen, onNew }) {
  const [audits, setAudits] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await dbGet("audits", `restaurant_id=eq.${restoId}&order=date.desc,created_at.desc&select=*`);
        setAudits(rows);
      } catch(e) { setAudits([]); }
    })();
  }, [restoId]);

  if (audits === null) return <div style={{ textAlign:"center", padding:50, color:"#9A9A9A" }}>Chargement...</div>;
  if (!audits.length) return (
    <div style={{ textAlign:"center", padding:50, color:"#9A9A9A" }}>
      <div style={{ marginBottom:14 }}>Aucun audit enregistré pour ce restaurant.</div>
      <button onClick={onNew} style={{ ...btn, background:"#1A1A2E", color:"white" }}>+ Créer le premier audit</button>
    </div>
  );

  return (
    <div>
      {audits.map(a => {
        const col = scoreColor(a.score_global);
        return (
          <div key={a.id}
            style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 16px", border:"1px solid #E8E8E8", borderRadius:4, marginBottom:8, background:"white", transition:"border-color .15s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#1A1A2E"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="#E8E8E8"}>
            <div onClick={()=>onOpen(a.id)} style={{ cursor:"pointer", background:col, color:"white", borderRadius:3, padding:"4px 10px", minWidth:50, textAlign:"center", fontWeight:700, fontSize:13, fontFamily:"'Space Grotesk',sans-serif" }}>
              {a.score_global!==null ? a.score_global+"%" : "–"}
            </div>
            <div onClick={()=>onOpen(a.id)} style={{ flex:1, cursor:"pointer" }}>
              <div style={{ fontSize:13, fontWeight:600 }}>{fDate(a.date)} — {a.service || "Service non précisé"}</div>
              <div style={{ fontSize:11, color:"#9A9A9A", marginTop:2 }}>Par {a.auteur || "?"} · {fDT(a.created_at)}</div>
            </div>
            <div onClick={()=>onOpen(a.id)} style={{ cursor:"pointer", fontSize:11, color:"#9A9A9A", flexShrink:0 }}>{(a.photos||[]).length} photo(s)</div>
            <button onClick={(e)=>{ e.stopPropagation(); exportAuditPDF(a, secs, restoName); }}
              style={{ ...btn, background:"#F5F3EE", border:"1px solid #E0E0E0", color:"#1A1A2E", fontSize:11, padding:"7px 12px", flexShrink:0 }}>
              📄 PDF
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── EVOLUTION ─────────────────────────────────────────────────────────────────
const SECTION_COLORS = ["#C8402A","#2A7A4B","#2A5E7A","#E07B2A","#9A5BC8","#5BA3A3","#C88A2A","#8A2A6E"];

function Evolution({ restoId, restos, secs }) {
  const [audits, setAudits] = useState(null);
  const [networkLatest, setNetworkLatest] = useState(null); // { secId: avgPct }

  useEffect(() => {
    (async () => {
      try {
        const rows = await dbGet("audits", `restaurant_id=eq.${restoId}&order=date.asc,created_at.asc&select=id,date,scores,score_global`);
        setAudits(rows);
      } catch(e) { setAudits([]); }
    })();
  }, [restoId]);

  useEffect(() => {
    (async () => {
      try {
        // Pour chaque restaurant, récupérer son audit le plus récent
        const results = {};
        for (const sec of secs) results[sec.id] = [];
        for (const r of restos) {
          const rows = await dbGet("audits", `restaurant_id=eq.${r.id}&order=date.desc,created_at.desc&limit=1&select=scores`);
          if (rows.length) {
            const { secScores } = calcGlobal(rows[0].scores, secs);
            secs.forEach(sec => {
              if (secScores[sec.id] !== null) results[sec.id].push(secScores[sec.id]);
            });
          }
        }
        const avgs = {};
        secs.forEach(sec => {
          const arr = results[sec.id];
          avgs[sec.id] = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
        });
        setNetworkLatest(avgs);
      } catch(e) { setNetworkLatest(null); }
    })();
  }, [restos, secs]);

  if (audits === null) return <div style={{ textAlign:"center", padding:50, color:"#9A9A9A" }}>Chargement...</div>;
  if (!audits.length) return (
    <div style={{ textAlign:"center", padding:50, color:"#9A9A9A" }}>
      Aucun audit enregistré encore. La vue Évolution s'affichera dès le premier audit complété.
    </div>
  );

  // Build chart data
  const chartData = audits.map(a => {
    const { global, secScores } = calcGlobal(a.scores, secs);
    const row = { date: fDate(a.date), global };
    secs.forEach(sec => { row[sec.id] = secScores[sec.id]; });
    return row;
  });

  // Latest scores per section + trend
  const last = chartData[chartData.length - 1];
  const prev = chartData.length >= 2 ? chartData[chartData.length - 2] : null;

  const rows = secs.map(sec => {
    const latestVal = last[sec.id];
    const prevVal = prev ? prev[sec.id] : null;
    let trend = "—", trendColor = "#9A9A9A";
    if (latestVal !== null && prevVal !== null) {
      const diff = latestVal - prevVal;
      if (diff >= 3) { trend = `↑ +${diff}`; trendColor = "#2A7A4B"; }
      else if (diff <= -3) { trend = `↓ ${diff}`; trendColor = "#C8402A"; }
      else { trend = "→ stable"; trendColor = "#9A9A9A"; }
    }
    const netAvg = networkLatest ? networkLatest[sec.id] : null;
    let vsNet = null, vsNetColor = "#9A9A9A";
    if (latestVal !== null && netAvg !== null) {
      vsNet = latestVal - netAvg;
      vsNetColor = vsNet > 0 ? "#2A7A4B" : vsNet < 0 ? "#C8402A" : "#9A9A9A";
    }
    return { sec, latestVal, trend, trendColor, netAvg, vsNet, vsNetColor };
  }).sort((a,b) => {
    if (a.latestVal === null) return 1;
    if (b.latestVal === null) return -1;
    return a.latestVal - b.latestVal; // pires en premier
  });

  return (
    <div>
      {/* Global score over time */}
      <div style={{ border:"1px solid #E8E8E8", borderRadius:4, padding:"16px 18px", marginBottom:18, background:"white" }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.4, marginBottom:14 }}>Score global dans le temps</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top:5, right:20, left:-15, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis dataKey="date" tick={{ fontSize:11 }} />
            <YAxis domain={[0,100]} tick={{ fontSize:11 }} />
            <Tooltip formatter={(v)=>v!==null?`${v}%`:"–"} />
            <Line type="monotone" dataKey="global" name="Score global" stroke="#1A1A2E" strokeWidth={3} dot={{ r:4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per section over time */}
      <div style={{ border:"1px solid #E8E8E8", borderRadius:4, padding:"16px 18px", marginBottom:18, background:"white" }}>
        <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.4, marginBottom:14 }}>Évolution par section</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top:5, right:20, left:-15, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
            <XAxis dataKey="date" tick={{ fontSize:11 }} />
            <YAxis domain={[0,100]} tick={{ fontSize:11 }} />
            <Tooltip formatter={(v)=>v!==null?`${v}%`:"–"} />
            <Legend wrapperStyle={{ fontSize:11 }} />
            {secs.map((sec, i) => (
              <Line key={sec.id} type="monotone" dataKey={sec.id} name={sec.t} stroke={SECTION_COLORS[i % SECTION_COLORS.length]} strokeWidth={2} dot={{ r:3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Forces / Faiblesses table */}
      <div style={{ border:"1px solid #E8E8E8", borderRadius:4, overflow:"hidden", marginBottom:30, background:"white" }}>
        <div style={{ background:"#F5F3EE", padding:"12px 18px", fontFamily:"'Space Grotesk',sans-serif", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:.4 }}>
          Forces & Faiblesses — dernier audit
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #E8E8E8" }}>
                <th style={{ textAlign:"left", padding:"10px 16px", color:"#9A9A9A", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:.4 }}>Section</th>
                <th style={{ textAlign:"center", padding:"10px 12px", color:"#9A9A9A", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:.4 }}>Score actuel</th>
                <th style={{ textAlign:"center", padding:"10px 12px", color:"#9A9A9A", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:.4 }}>Évolution</th>
                <th style={{ textAlign:"center", padding:"10px 16px", color:"#9A9A9A", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:.4 }}>vs Moyenne réseau</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sec, latestVal, trend, trendColor, netAvg, vsNet, vsNetColor }) => (
                <tr key={sec.id} style={{ borderBottom:"1px solid #F5F3EE" }}>
                  <td style={{ padding:"10px 16px" }}>{sec.t}</td>
                  <td style={{ padding:"10px 12px", textAlign:"center" }}>
                    <span style={{ display:"inline-block", minWidth:42, padding:"3px 8px", borderRadius:3, background:scoreColor(latestVal), color:"white", fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", fontSize:12 }}>
                      {latestVal!==null?`${latestVal}%`:"–"}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px", textAlign:"center", color:trendColor, fontWeight:600 }}>{trend}</td>
                  <td style={{ padding:"10px 16px", textAlign:"center", color:vsNetColor, fontWeight:600 }}>
                    {vsNet!==null ? `${vsNet>0?"+":""}${vsNet} pts` : (netAvg===null ? "—" : "n/a")}
                    {netAvg!==null && <span style={{ color:"#9A9A9A", fontWeight:400, marginLeft:6 }}>(moy. {netAvg}%)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 16px", fontSize:10.5, color:"#9A9A9A", borderTop:"1px solid #F5F3EE" }}>
          La moyenne réseau est calculée à partir du dernier audit disponible de chaque restaurant. Le tableau est trié du score le plus faible au plus élevé pour prioriser les actions.
        </div>
      </div>
    </div>
  );
}

// ── TEMPLATE EDITOR ───────────────────────────────────────────────────────────
function TemplateEditor({ secs: initialSecs, onSave, onCancel }) {
  const [secs, setSecs] = useState(() => JSON.parse(JSON.stringify(initialSecs)));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""), 2500); };

  const totalWeight = secs.reduce((a,s)=>a+Number(s.p||0),0);

  const updateSection = (idx, field, value) => {
    setSecs(prev => prev.map((s,i)=> i===idx ? {...s, [field]: value} : s));
  };
  const moveSection = (idx, dir) => {
    setSecs(prev => {
      const arr = [...prev];
      const j = idx+dir;
      if (j<0 || j>=arr.length) return arr;
      [arr[idx],arr[j]] = [arr[j],arr[idx]];
      return arr;
    });
  };
  const removeSection = (idx) => {
    if (!window.confirm("Supprimer cette section et tous ses critères ?")) return;
    setSecs(prev => prev.filter((_,i)=>i!==idx));
  };
  const addSection = () => {
    setSecs(prev => [...prev, { id: genId("sec"), t:"Nouvelle section", p:0, cr:[] }]);
  };

  const updateCrit = (si, ci, field, value) => {
    setSecs(prev => prev.map((s,i)=> i!==si ? s : {...s, cr: s.cr.map((c,j)=> j===ci? {...c,[field]:value}:c)}));
  };
  const moveCrit = (si, ci, dir) => {
    setSecs(prev => prev.map((s,i)=>{
      if(i!==si) return s;
      const arr=[...s.cr]; const j=ci+dir;
      if(j<0||j>=arr.length) return s;
      [arr[ci],arr[j]]=[arr[j],arr[ci]];
      return {...s, cr:arr};
    }));
  };
  const removeCrit = (si,ci) => {
    setSecs(prev => prev.map((s,i)=> i!==si? s : {...s, cr: s.cr.filter((_,j)=>j!==ci)}));
  };
  const addCrit = (si) => {
    setSecs(prev => prev.map((s,i)=> i!==si? s : {...s, cr:[...s.cr, {id:genId("c"), l:"Nouveau critère", d:""}]}));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(secs);
    } catch(e) { showToast("Erreur : " + e.message); }
    setSaving(false);
  };

  return (
    <div>
      <Toast msg={toast} />
      <div style={{ background:"#F5F3EE", border:"1px solid #E8E8E8", borderRadius:4, padding:"12px 16px", marginBottom:18, fontSize:12.5, lineHeight:1.5, color:"#444" }}>
        Modifiez ici les sections et critères de la grille d'audit. Le <strong>poids (%)</strong> de chaque section détermine son importance dans le score global — l'ensemble doit idéalement totaliser <strong>100%</strong>.
        {" "}Total actuel : <strong style={{ color: totalWeight===100 ? "#2A7A4B" : "#C8402A" }}>{totalWeight}%</strong>
        {totalWeight!==100 && <span style={{ color:"#C8402A" }}> — ajustez les poids pour atteindre 100%.</span>}
      </div>

      {secs.map((sec, si) => (
        <div key={sec.id} style={{ marginBottom:14, border:"1px solid #E8E8E8", borderRadius:4, overflow:"hidden" }}>
          <div style={{ background:"#0F0F0F", padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:10, color:"#C8402A", fontWeight:700, letterSpacing:1 }}>0{si+1}</span>
            <input value={sec.t} onChange={e=>updateSection(si,"t",e.target.value)}
              style={{ ...inp, flex:1, minWidth:160, background:"#1A1A2E", border:"1px solid #333", color:"white", fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", fontSize:12, textTransform:"uppercase", letterSpacing:.4 }} />
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <input type="number" value={sec.p} onChange={e=>updateSection(si,"p",Number(e.target.value))}
                style={{ ...inp, width:60, background:"#1A1A2E", border:"1px solid #333", color:"white", textAlign:"center", fontSize:12 }} />
              <span style={{ color:"#9A9A9A", fontSize:11 }}>%</span>
            </div>
            <button onClick={()=>moveSection(si,-1)} disabled={si===0} style={{ ...btn, background:"#333", color:"white", padding:"6px 9px", fontSize:11, opacity: si===0?.3:1 }}>↑</button>
            <button onClick={()=>moveSection(si,1)} disabled={si===secs.length-1} style={{ ...btn, background:"#333", color:"white", padding:"6px 9px", fontSize:11, opacity: si===secs.length-1?.3:1 }}>↓</button>
            <button onClick={()=>removeSection(si)} style={{ ...btn, background:"#C8402A", color:"white", padding:"6px 10px", fontSize:11 }}>🗑</button>
          </div>

          {sec.cr.map((cr, ci) => (
            <div key={cr.id} style={{ display:"flex", gap:8, alignItems:"flex-start", padding:"10px 16px", borderBottom: ci<sec.cr.length-1 ? "1px solid #F0F0F0" : "none", background:"white", flexWrap:"wrap" }}>
              <span style={{ fontSize:10, color:"#9A9A9A", paddingTop:9, minWidth:24 }}>{si+1}.{ci+1}</span>
              <div style={{ flex:1, minWidth:200, display:"flex", flexDirection:"column", gap:6 }}>
                <input value={cr.l} onChange={e=>updateCrit(si,ci,"l",e.target.value)} placeholder="Libellé du critère" style={{ ...inp, fontSize:12.5 }} />
                <input value={cr.d} onChange={e=>updateCrit(si,ci,"d",e.target.value)} placeholder="Détail / précision (optionnel)" style={{ ...inp, fontSize:11, color:"#9A9A9A" }} />
              </div>
              <div style={{ display:"flex", gap:4, paddingTop:2 }}>
                <button onClick={()=>moveCrit(si,ci,-1)} disabled={ci===0} style={{ ...btn, background:"#F0F0F0", color:"#555", padding:"6px 9px", fontSize:11, opacity: ci===0?.3:1 }}>↑</button>
                <button onClick={()=>moveCrit(si,ci,1)} disabled={ci===sec.cr.length-1} style={{ ...btn, background:"#F0F0F0", color:"#555", padding:"6px 9px", fontSize:11, opacity: ci===sec.cr.length-1?.3:1 }}>↓</button>
                <button onClick={()=>removeCrit(si,ci)} style={{ ...btn, background:"#C8402A", color:"white", padding:"6px 10px", fontSize:11 }}>🗑</button>
              </div>
            </div>
          ))}

          <div style={{ padding:"10px 16px", background:"#FAFAF8" }}>
            <button onClick={()=>addCrit(si)} style={{ ...btn, background:"white", border:"1.5px dashed #E0E0E0", color:"#9A9A9A", fontSize:12, padding:"7px 14px" }}>+ Ajouter un critère</button>
          </div>
        </div>
      ))}

      <div style={{ display:"flex", gap:10, marginBottom:30, flexWrap:"wrap" }}>
        <button onClick={addSection} style={{ ...btn, background:"white", border:"1.5px dashed #1A1A2E", color:"#1A1A2E", fontSize:13 }}>+ Ajouter une section</button>
        <button onClick={()=>{ if(window.confirm("Réinitialiser le modèle par défaut ? Les modifications non enregistrées seront perdues.")) setSecs(JSON.parse(JSON.stringify(DEFAULT_SECS))); }}
          style={{ ...btn, background:"white", border:"1.5px solid #E0E0E0", color:"#9A9A9A", fontSize:13 }}>↺ Modèle par défaut</button>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingBottom:40 }}>
        <button onClick={onCancel} style={{ ...btn, background:"white", border:"1.5px solid #E0E0E0", fontSize:13 }}>Annuler</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background:"#1A1A2E", color:"white", fontSize:13, opacity:saving?.7:1 }}>
          {saving ? "Enregistrement..." : "💾 Enregistrer le modèle"}
        </button>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [restos, setRestos] = useState([]);
  const [secs, setSecs] = useState(null);
  const [view, setView] = useState("list"); // list | resto | template
  const [currentResto, setCurrentResto] = useState(null);
  const [tab, setTab] = useState("hist"); // hist | form | evol
  const [auditId, setAuditId] = useState(null);
  const [addName, setAddName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState("");
  const [loadingRestos, setLoadingRestos] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""), 2500); };

  useEffect(() => {
    if (!user) return;
    setLoadingRestos(true);
    Promise.all([
      dbGet("restaurants", "order=created_at.asc&select=*"),
      dbGet("settings", "key=eq.template&select=*")
    ]).then(([restoRows, settingsRows]) => {
      setRestos(restoRows);
      if (settingsRows.length && settingsRows[0].value) {
        setSecs(settingsRows[0].value);
      } else {
        setSecs(DEFAULT_SECS);
        dbUpsert("settings", { key: "template", value: DEFAULT_SECS }, "key").catch(()=>{});
      }
    }).catch(() => {
      showToast("Erreur de connexion à la base");
      setSecs(DEFAULT_SECS);
    }).finally(() => setLoadingRestos(false));
  }, [user]);

  const addResto = async () => {
    const name = addName.trim();
    if (!name) { showToast("Saisissez un nom"); return; }
    try {
      const rows = await dbInsert("restaurants", { name });
      setRestos(prev => [...prev, rows[0]]);
      setAddName(""); setShowAdd(false);
      showToast("Restaurant ajouté ✓");
    } catch(e) { showToast("Erreur : " + e.message); }
  };

  const saveTemplate = async (newSecs) => {
    await dbUpsert("settings", { key: "template", value: newSecs, updated_at: new Date().toISOString() }, "key");
    setSecs(newSecs);
    showToast("Modèle enregistré ✓");
    setView("list");
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div style={{ minHeight:"100vh", background:"#F8F6F1", fontFamily:"Inter,sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      <Toast msg={toast} />

      {/* Topbar */}
      <div style={{ background:"#1A1A2E", color:"#F8F6F1", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div onClick={()=>{ setView("list"); setCurrentResto(null); }}
          style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:15, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, cursor:"pointer" }}>
          {view!=="list" ? "← " : ""}Portail Audit Restaurants
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:12, color:"#9A9A9A" }}>
          {view!=="template" && (
            <span onClick={()=>setView("template")} style={{ color:"#F8F6F1", cursor:"pointer", textDecoration:"underline" }}>⚙️ Modèle d'audit</span>
          )}
          <span>{LABELS[user]}</span>
          <span onClick={()=>setUser(null)} style={{ color:"#F8F6F1", cursor:"pointer", textDecoration:"underline" }}>Déconnexion</span>
        </div>
      </div>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"24px 16px" }}>

        {secs===null ? (
          <div style={{ textAlign:"center", padding:40, color:"#9A9A9A" }}>Connexion à la base...</div>
        ) : (
        <>
        {/* ── LISTE ── */}
        {view==="list" && (
          <>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:20 }}>Mes restaurants</div>
            {loadingRestos ? (
              <div style={{ textAlign:"center", padding:40, color:"#9A9A9A" }}>Connexion à la base...</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:14, marginBottom:16 }}>
                {restos.map(r => (
                  <div key={r.id} onClick={()=>{ setCurrentResto(r); setView("resto"); setTab("hist"); setAuditId(null); }}
                    style={{ border:"1.5px solid #E8E8E8", borderRadius:5, padding:18, cursor:"pointer", background:"white", transition:"all .15s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor="#1A1A2E"; e.currentTarget.style.transform="translateY(-2px)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E8E8E8"; e.currentTarget.style.transform="translateY(0)"; }}>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:14, fontWeight:700, marginBottom:5 }}>{r.name}</div>
                    <div style={{ fontSize:11, color:"#9A9A9A" }}>Voir les audits →</div>
                  </div>
                ))}
                <div onClick={()=>setShowAdd(true)}
                  style={{ border:"1.5px dashed #E0E0E0", borderRadius:5, padding:18, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#9A9A9A", fontSize:13, fontWeight:600, transition:"all .15s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="#1A1A2E"; e.currentTarget.style.color="#1A1A2E"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E0E0E0"; e.currentTarget.style.color="#9A9A9A"; }}>
                  + Ajouter un restaurant
                </div>
              </div>
            )}
            {showAdd && (
              <div style={{ padding:16, border:"1.5px solid #1A1A2E", borderRadius:5, background:"white", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                <input autoFocus value={addName} onChange={e=>setAddName(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") addResto(); if(e.key==="Escape"){ setShowAdd(false); setAddName(""); } }}
                  placeholder="Nom du restaurant..." style={{ ...inp, flex:1, minWidth:180 }} />
                <button onClick={addResto} style={{ ...btn, background:"#1A1A2E", color:"white", padding:"9px 16px", fontSize:12 }}>Confirmer</button>
                <button onClick={()=>{ setShowAdd(false); setAddName(""); }} style={{ ...btn, background:"white", border:"1.5px solid #E0E0E0", padding:"9px 16px", fontSize:12 }}>Annuler</button>
              </div>
            )}
          </>
        )}

        {/* ── RESTAURANT ── */}
        {view==="resto" && currentResto && (
          <>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:16 }}>{currentResto.name}</div>
            <div style={{ display:"flex", gap:4, borderBottom:"2px solid #E8E8E8", marginBottom:20, flexWrap:"wrap" }}>
              {[["hist","Historique"],["form","Nouvel audit"],["evol","Évolution"]].map(([key,label])=>(
                <button key={key} onClick={()=>{ setTab(key); if(key==="form") setAuditId(null); }}
                  style={{ padding:"10px 18px", fontSize:12, fontWeight:700, cursor:"pointer", border:"none", background:"none", color:tab===key?"#1A1A2E":"#9A9A9A", borderBottom:`2px solid ${tab===key?"#C8402A":"transparent"}`, marginBottom:-2, textTransform:"uppercase", letterSpacing:.5 }}>
                  {label}
                </button>
              ))}
            </div>
            {tab==="hist" && (
              <History restoId={currentResto.id} restoName={currentResto.name} secs={secs} onOpen={id=>{ setAuditId(id); setTab("form"); }} onNew={()=>{ setAuditId(null); setTab("form"); }} />
            )}
            {tab==="form" && (
              <AuditForm
                restoId={currentResto.id}
                auditId={auditId}
                userName={user}
                secs={secs}
                onSaved={id=>setAuditId(id)}
                onBack={()=>{ setAuditId(null); setTab("hist"); }}
              />
            )}
            {tab==="evol" && (
              <Evolution restoId={currentResto.id} restos={restos} secs={secs} />
            )}
          </>
        )}

        {/* ── TEMPLATE EDITOR ── */}
        {view==="template" && (
          <>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:17, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:20 }}>Modèle d'audit</div>
            <TemplateEditor
              secs={secs}
              onSave={saveTemplate}
              onCancel={()=>setView("list")}
            />
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
