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
const K_MSGS = "covoit_messages";

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
    // On vérifie si L (Leaflet) est bien chargé globalement
    if (typeof L === 'undefined') return; 

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([50.6703, 3.2283], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
    }
    
    // Nettoyage markers pour éviter les doublons au refresh
    mapInstance.current.eachLayer(l => { if(l instanceof L.Marker || l instanceof L.CircleMarker) mapInstance.current.removeLayer(l); });
    
    // Point Travail
    L.marker([50.6703, 3.2283]).addTo(mapInstance.current).bindPopup("🏢 Bureau Delpharm");
    
    // Points Users
    users.forEach(u => {
      if (u.cD && u.cD.lat) {
        const col = u.role === 'conducteur' ? '#4f46e5' : '#f59e0b';
        L.circleMarker([u.cD.lat, u.cD.lon], { color: col, radius: 8, fillOpacity: 0.8 }).addTo(mapInstance.current)
          .bindPopup(`<b>${u.prenom}</b> (${u.role})`);
      }
    });
  }, [users]);

  return <div ref={mapRef} style={{ height: "300px", borderRadius: 12, marginBottom: 20, zIndex: 1, border: "1px solid var(--color-border-tertiary)" }} />;
}

// ── COMPOSANT TCHAT (FIXÉ) ──────────────────────────────────────────────────
function ChatBox({ me, partner, messages, onSend }) {
  const [txt, setTxt] = useState("");
  const key = [me.id, partner.id].sort().join("_");
  const chatMsgs = messages.filter(m => m.matchKey === key);
  const scrollRef = useRef();

  // Scroll auto vers le bas quand un message arrive
  useEffect(() => { 
    if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
  }, [chatMsgs]);

  const send = () => {
    if (!txt.trim()) return;
    onSend(key, txt);
    setTxt("");
  };

  return (
    <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-secondary)", borderRadius: 12, padding: 10, marginTop: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>💬 Discussion avec {partner.prenom}</span>
        <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>ID: {key}</span>
      </div>
      <div ref={scrollRef} style={{ height: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: "5px" }}>
        {chatMsgs.length === 0 && <div style={{ textAlign: "center", fontSize: 11, color: "#aaa" }}>Aucun message.</div>}
        {chatMsgs.map(m => (
          <div key={m.id} style={{ 
            alignSelf: m.senderId === me.id ? 'flex-end' : 'flex-start', 
            background: m.senderId === me.id ? '#4F46E5' : 'var(--color-background-secondary)', 
            color: m.senderId === me.id ? '#fff' : 'var(--color-text-primary)', 
            padding: '8px 12px', 
            borderRadius: 12, 
            fontSize: 12,
            maxWidth: '80%'
          }}>
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
        <input 
          style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)" }} 
          value={txt} 
          onChange={e=>setTxt(e.target.value)} 
          placeholder="Écrire..." 
          onKeyDown={e => e.key === "Enter" && send()}
        />
        <button style={{ padding: "8px 15px", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }} onClick={send}>OK</button>
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

  // Chargement des données
  useEffect(() => {
    async function load() {
      const u = await sGet(K_USERS);
      const m = await sGet(K_MSGS);
      setUsers(u || []);
      setMessages(m || []);
    }
    if (unlocked) {
      load();
      // Polling toutes les 15 secondes pour les messages
      const timer = setInterval(load, 15000);
      return () => clearInterval(timer);
    }
  }, [unlocked]);

  const handleSend = async (key, text) => {
    const newMsg = { id: Date.now(), matchKey: key, senderId: me.id, text, ts: Date.now() };
    const update = [...messages, newMsg];
    setMessages(update);
    await sSet(K_MSGS, update);
  };

  // Écran de déverrouillage
  if (!unlocked) return (
    <div style={{ maxWidth: 350, margin: "100px auto", textAlign: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "#4F46E5", width: 60, height: 60, borderRadius: 15, margin: "0 auto 20px", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
         <svg width="30" height="30" fill="#fff" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
      </div>
      <h2>Covoit'Collab 2026</h2>
      <p style={{ color: "#666", fontSize: 14 }}>Entrez le code d'accès pour continuer</p>
      <input 
        type="password" 
        placeholder="Code d'accès" 
        style={{ width: '100%', padding: 12, marginBottom: 10, borderRadius: 8, border: "1px solid #ddd", boxSizing: 'border-box' }} 
        onChange={(e) => e.target.value === ACCESS_CODE && setUnlocked(true)} 
      />
    </div>
  );

  // Simulation Login (Thomas HSE)
  if (!me) return (
    <div style={{ maxWidth: 500, margin: "50px auto", padding: 20, fontFamily: "sans-serif" }}>
      <h3>Connexion à votre espace</h3>
      <div style={{ background: "#f3f4f6", padding: 20, borderRadius: 12 }}>
        <p style={{ fontSize: 14, color: "#666" }}>Sélectionnez votre profil (Démo) :</p>
        <button style={{ width: '100%', padding: 15, background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }} 
          onClick={() => setMe({ id: "thomas_1", prenom: "Thomas", nom: "Franceschini", role: "conducteur", cD: {lat: 50.63, lon: 3.06}, ville: "Lille" })}>
          Connexion en tant que Thomas
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20, fontFamily: "sans-serif", color: "var(--color-text-primary)" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
           <div style={{ background: "#4F46E5", padding: 5, borderRadius: 5, color: "#fff", fontWeight: "bold" }}>CC</div>
           <b>Covoit'Collab 2026</b>
        </div>
        <button style={{ background: "transparent", border: "1px solid #ddd", padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }} onClick={() => setMe(null)}>Déconnexion</button>
      </header>

      <nav style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {["Accueil", "Matching"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: 10, background: tab === t ? "#4F46E5" : "var(--color-background-secondary)", color: tab === t ? "#fff" : "var(--color-text-primary)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>{t}</button>
        ))}
      </nav>

      {tab === "Accueil" && (
        <>
          <InteractiveMap users={users} me={me} />
          <div style={{ background: "var(--color-background-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--color-border-tertiary)" }}>
            <h3 style={{ marginTop: 0 }}>Salut {me.prenom} ! 👋</h3>
            <p style={{ fontSize: 14 }}>Bienvenue sur l'outil de covoiturage de <b>Delpharm Lille</b>.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 15 }}>
               <div style={{ background: "#fff", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid #eee" }}>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>{users.length}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>Collègues inscrits</div>
               </div>
               <div style={{ background: "#fff", padding: 10, borderRadius: 8, textAlign: "center", border: "1px solid #eee" }}>
                  <div style={{ fontSize: 20, fontWeight: "bold" }}>{messages.length}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>Messages échangés</div>
               </div>
            </div>
          </div>
        </>
      )}

      {tab === "Matching" && (
        <div>
          <h3 style={{ fontSize: 16 }}>Compagnons de route potentiels</h3>
          {users.filter(u => u.id !== me.id).length === 0 ? (
            <p style={{ color: "#999", fontSize: 13 }}>Aucun autre collègue inscrit pour le moment.</p>
          ) : (
            users.filter(u => u.id !== me.id).map(u => (
              <div key={u.id} style={{ border: "1px solid var(--color-border-tertiary)", borderRadius: 12, padding: 15, marginBottom: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <b>{u.prenom} {u.nom}</b>
                   <span style={{ fontSize: 11, padding: "3px 8px", background: u.role === 'conducteur' ? "#eef2ff" : "#fffbeb", color: u.role === 'conducteur' ? "#4f46e5" : "#b45309", borderRadius: 10, fontWeight: 600 }}>{u.role.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>📍 Domicile : {u.ville || "Non précisé"}</div>
                <ChatBox me={me} partner={u} messages={messages} onSend={handleSend} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
