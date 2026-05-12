import React, { useState, useEffect, useRef } from "react";

// ── CONFIGURATION & CONSTANTES ──────────────────────────────────────────────
const ACCESS_CODE = "covoit2025";
const FUEL = { SP95: 1.72, SP98: 1.83, Diesel: 1.61, "Électrique": 0.18 };
const FUEL_ICONS = { SP95: "⛽", SP98: "⛽", Diesel: "🛢️", "Électrique": "⚡" };
const PRIME = 2.5;
const JOURS_SEM = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi"];
const TRAV_COORD = { lat: 50.6703, lon: 3.2283 };

// Tables de stockage
const K_USERS = "covoit_users";
const K_MSGS  = "covoit_messages";

// Initialisation Supabase (Vérifie tes clés dans ton dashboard Supabase)
const supabase = window.supabase?.createClient('TON_URL_SUPABASE', 'TA_CLE_ANON');

// ── FONCTIONS DE STOCKAGE ───────────────────────────────────────────────────
async function sGet(key) {
  if (supabase) {
    const { data } = await supabase.from(key).select('*');
    return data || [];
  }
  return JSON.parse(localStorage.getItem(key)) || [];
}

async function sSet(key, val) {
  if (supabase) {
    await supabase.from(key).upsert(val);
  } else {
    localStorage.setItem(key, JSON.stringify(val));
  }
}

// ── COMPOSANT CARTE (LEAFLET) ───────────────────────────────────────────────
function InteractiveMap({ users, me }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([50.6703, 3.2283], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
    }
    // Nettoyage markers
    mapInstance.current.eachLayer(l => { if(l instanceof L.Marker) mapInstance.current.removeLayer(l); });
    // Point Travail
    L.marker([50.6703, 3.2283]).addTo(mapInstance.current).bindPopup("🏢 Bureau");
    // Points Users
    users.forEach(u => {
      if (u.cD) {
        const col = u.role === 'conducteur' ? '#4f46e5' : '#f59e0b';
        L.circleMarker([u.cD.lat, u.cD.lon], { color: col, radius: 8 }).addTo(mapInstance.current)
          .bindPopup(`<b>${u.prenom}</b> (${u.role})`);
      }
    });
  }, [users]);

  return <div ref={mapRef} style={{ height: "300px", borderRadius: 12, marginBottom: 20, zIndex: 1, border: "1px solid #ddd" }} />;
}

// ── COMPOSANT TCHAT ─────────────────────────────────────────────────────────
function ChatBox({ me, partner, messages, onSend }) {
  const [txt, setTxt] = useState("");
  const key = [me.id, partner.id].sort().join("_");
  const chatMsgs = messages.filter(m => m.matchKey === key);
  const scrollRef = useRef();

  useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatMsgs]);

  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 10, marginTop: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>💬 Discussion avec {partner.prenom}</div>
      <div ref={scrollRef} style={{ height: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {chatMsgs.map(m => (
          <div key={m.id} style={{ alignSelf: m.senderId === me.id ? 'flex-end' : 'flex-start', background: m.senderId === me.id ? '#4F46E5' : '#F3F4F6', color: m.senderId === me.id ? '#fff' : '#000', padding: '6px 10px', borderRadius: 10, fontSize: 12 }}>
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
        <input style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Message..." />
        <button style={{ padding: "8px 15px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8 }} onClick={() => { onSend(key, txt); setTxt(""); }}>OK</button>
      </div>
    </div>
  );
}

// ── APP PRINCIPALE ──────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState("Accueil");

  useEffect(() => {
    async function load() {
      const u = await sGet(K_USERS);
      const m = await sGet(K_MSGS);
      setUsers(u || []);
      setMessages(m || []);
    }
    if (unlocked) load();
  }, [unlocked]);

  const handleSend = async (key, text) => {
    if (!text.trim()) return;
    const newMsg = { id: Date.now(), matchKey: key, senderId: me.id, text, ts: Date.now() };
    const update = [...messages, newMsg];
    setMessages(update);
    await sSet(K_MSGS, update);
  };

  if (!unlocked) return (
    <div style={{ maxWidth: 350, margin: "100px auto", textAlign: "center" }}>
      <h2>Covoit'Collab 2026</h2>
      <input type="password" placeholder="Code d'accès" style={{ width: '100%', padding: 10, marginBottom: 10 }} onChange={(e) => e.target.value === ACCESS_CODE && setUnlocked(true)} />
    </div>
  );

  if (!me) return (
    <div style={{ maxWidth: 500, margin: "50px auto", padding: 20 }}>
      <h3>Qui êtes-vous ?</h3>
      <button style={{ width: '100%', padding: 15, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8 }} onClick={() => setMe({ id: "thomas_1", prenom: "Thomas", role: "conducteur", cD: {lat: 50.63, lon: 3.06} })}>Connexion (Thomas)</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <b>🚗 Covoit'Collab</b>
        <button onClick={() => setMe(null)}>Déconnexion</button>
      </header>

      <nav style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {["Accueil", "Matching"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: 10, background: tab === t ? "#4F46E5" : "#eee", color: tab === t ? "#fff" : "#000", border: "none", borderRadius: 8 }}>{t}</button>
        ))}
      </nav>

      {tab === "Accueil" && (
        <>
          <InteractiveMap users={users} me={me} />
          <div style={{ background: "#f9f9f9", padding: 15, borderRadius: 12 }}>
            <h3>Salut {me.prenom} !</h3>
            <p>Il y a {users.length} collègues inscrits aujourd'hui.</p>
          </div>
        </>
      )}

      {tab === "Matching" && (
        <div>
          {users.filter(u => u.id !== me.id).map(u => (
            <div key={u.id} style={{ borderBottom: "1px solid #eee", padding: "15px 0" }}>
              <b>{u.prenom}</b> ({u.role}) à {u.ville}
              <ChatBox me={me} partner={u} messages={messages} onSend={handleSend} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
