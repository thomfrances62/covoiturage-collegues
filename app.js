import React, { useState, useEffect, useRef } from "react";

// ── CONFIGURATION & CONSTANTES ──────────────────────────────────────────────
const ACCESS_CODE = "covoit2025";
const FUEL = { SP95: 1.72, SP98: 1.83, Diesel: 1.61, "Électrique": 0.18 };
const FUEL_ICONS = { SP95: "⛽", SP98: "⛽", Diesel: "🛢️", "Électrique": "⚡" };
const PRIME = 2.5;
const JOURS_SEM = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi"];
const TRAV_COORD = { lat: 50.6703, lon: 3.2283 };

// Tables Supabase (ou LocalStorage keys)
const K_USERS = "covoit_users";
const K_MSGS  = "covoit_messages";

// Connexion Supabase (Remplace avec tes vrais identifiants)
const supabase = window.supabase?.createClient('TON_URL_SUPABASE', 'TA_CLE_ANON');

// ── MOTEUR DE STOCKAGE ──────────────────────────────────────────────────────
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

// ── STYLES & UI COMPONENTS ──────────────────────────────────────────────────
const S = {
  card: { background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:12, boxShadow:"0 2px 4px rgba(0,0,0,0.05)" },
  inp:  { width:"100%", padding:"10px", borderRadius:8, border:"1px solid #ddd", marginBottom:10, fontSize:14 },
  lbl:  { fontSize:12, color:"#666", marginBottom:4, display:"block" }
};

const btn = (v) => ({
  padding:"8px 16px", borderRadius:8, cursor:"pointer", border:"none",
  background: v==="p" ? "#4F46E5" : "#eee", color: v==="p" ? "#fff" : "#333", fontWeight:500
});

function Av({ name, sz=36 }) {
  const ini = name?.split(" ").map(w=>w[0]).join("").toUpperCase() || "?";
  return <div style={{ width:sz, height:sz, borderRadius:"50%", background:"#eef2ff", color:"#4F46E5", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:600, fontSize:sz*0.4 }}>{ini}</div>;
}

// ── MODULE CARTE (LEAFLET) ──────────────────────────────────────────────────
function InteractiveMap({ users, me }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([50.6703, 3.2283], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
    }

    // Clear markers
    mapInstance.current.eachLayer(l => { if(l instanceof L.Marker) mapInstance.current.removeLayer(l); });

    // Travail
    L.marker([50.6703, 3.2283]).addTo(mapInstance.current).bindPopup("🏢 Bureau");

    // Users
    users.forEach(u => {
      if (u.cD) {
        const isMe = u.id === me?.id;
        const color = isMe ? '#10b981' : (u.role === 'conducteur' ? '#4f46e5' : '#f59e0b');
        const icon = L.divIcon({ html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`, iconSize:[12,12] });
        L.marker([u.cD.lat, u.cD.lon], { icon }).addTo(mapInstance.current).bindPopup(`<b>${u.prenom}</b> (${u.role})`);
      }
    });
  }, [users, me]);

  return <div ref={mapRef} style={{ height: "300px", borderRadius: 12, marginBottom: 20, zIndex: 1 }} />;
}

// ── MODULE TCHAT ────────────────────────────────────────────────────────────
function ChatBox({ me, partner, messages, onSend }) {
  const [txt, setTxt] = useState("");
  const key = [me.id, partner.id].sort().join("_");
  const chatMsgs = messages.filter(m => m.matchKey === key);
  const scrollRef = useRef();

  useEffect(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatMsgs]);

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>💬 Chat avec {partner.prenom}</div>
      <div ref={scrollRef} style={{ height: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 5 }}>
        {chatMsgs.map(m => (
          <div key={m.id} style={{ alignSelf: m.senderId === me.id ? 'flex-end' : 'flex-start', background: m.senderId === me.id ? '#4F46E5' : '#F3F4F6', color: m.senderId === me.id ? '#fff' : '#000', padding: '6px 12px', borderRadius: 12, fontSize: 13 }}>
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
        <input style={S.inp} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Message..." onKeyPress={e=>e.key==='Enter' && (onSend(key, txt), setTxt(""))} />
        <button style={btn("p")} onClick={() => { onSend(key, txt); setTxt(""); }}>OK</button>
      </div>
    </div>
  );
}

// ── APPLICATION PRINCIPALE ──────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState("Accueil");

  // Chargement initial
  useEffect(() => {
    async function load() {
      const u = await sGet(K_USERS);
      const m = await sGet(K_MSGS);
      setUsers(u);
      setMessages(m);
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
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>Covoit'Collab 2026</h2>
      <input type="password" style={S.inp} placeholder="Code d'accès" onChange={(e) => e.target.value === ACCESS_CODE && setUnlocked(true)} />
    </div>
  );

  if (!me) return (
    <div style={{ maxWidth: 400, margin: "50px auto", padding: 20 }}>
      <h3>Choisissez votre profil pour tester :</h3>
      {users.length === 0 ? <p>Aucun utilisateur. Créez-en un dans la base !</p> : 
        users.map(u => <button key={u.id} style={{...btn(), width:'100%', marginBottom:10}} onClick={() => setMe(u)}>{u.prenom} {u.nom}</button>)
      }
      <button style={btn("p")} onClick={() => setMe({id: "admin", prenom: "Thomas", role: "conducteur"})}>Mode Admin (Thomas)</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Covoit'Collab</h2>
        <button style={btn()} onClick={() => setMe(null)}>Déconnexion</button>
      </div>

      <nav style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {["Accueil", "Matching", "Profil"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={btn(tab === t ? "p" : "d")}>{t}</button>
        ))}
      </nav>

      {tab === "Accueil" && (
        <>
          <InteractiveMap users={users} me={me} />
          <div style={S.card}>
            <h3>Bienvenue, {me.prenom} !</h3>
            <p style={{ color: '#666' }}>Utilisateurs actifs : {users.length}</p>
          </div>
        </>
      )}

      {tab === "Matching" && (
        <div>
          <h3>Matchings disponibles</h3>
          {users.filter(u => u.id !== me.id).map(u => (
            <div key={u.id}>
              <div style={S.card}>
                <Av name={u.prenom} />
                <b>{u.prenom}</b> ({u.role}) habitant à {u.ville}
              </div>
              <ChatBox me={me} partner={u} messages={messages} onSend={handleSend} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
