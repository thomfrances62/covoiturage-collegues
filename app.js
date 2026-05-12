// Fermeture propre de la ChatBox que tu as commencée
      <div style={{ maxHeight:220, overflowY:"auto", padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
        {msgs.map(m => (
          <div key={m.id} style={{ alignSelf: m.senderId === me.id ? 'flex-end' : 'flex-start', background: m.senderId === me.id ? '#4F46E5' : '#eee', color: m.senderId === me.id ? '#fff' : '#000', padding: '6px 10px', borderRadius: 10, fontSize: 12 }}>
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display:"flex", gap:5, padding:8 }}>
        <input style={S.inp} value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Message..." />
        <button style={btn("p")} onClick={send}>OK</button>
      </div>
    </div>}
  </div>;
}

// N'oublie pas de fermer les éventuelles fonctions de Tab restantes ici...
// Remplace tes identifiants après avoir créé ton projet sur supabase.com
const supabase = window.supabase?.createClient('TON_URL_SUPABASE', 'TA_CLE_ANON');

// Nouvelle version des fonctions de stockage
async function sGet(key) {
  if (!supabase) return JSON.parse(localStorage.getItem(key)); // Fallback local
  const { data } = await supabase.from(key).select('*');
  return data;
}

async function sSet(key, val) {
  if (!supabase) return localStorage.setItem(key, JSON.stringify(val));
  await supabase.from(key).upsert(val);
}
// Nouveau composant de Carte
function CovoitMap({ users, me }) {
  const mapRef = useRef(null);
  const instance = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    
    // Initialisation
    if (!instance.current) {
      instance.current = L.map(mapRef.current).setView([50.6703, 3.2283], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(instance.current);
    }

    // Nettoyage et ajout des points
    instance.current.eachLayer(l => { if(l instanceof L.Marker) instance.current.removeLayer(l); });

    // Bureau
    L.marker([50.6703, 3.2283]).addTo(instance.current).bindPopup("🏢 Bureau (Lys-lez-Lannoy)");

    // Collègues
    users.forEach(u => {
      if (u.cD) {
        const color = u.role === 'conducteur' ? 'blue' : 'green';
        L.circleMarker([u.cD.lat, u.cD.lon], { color, radius: 8 }).addTo(instance.current)
          .bindPopup(`<b>${u.prenom}</b> (${u.role})<br>${u.ville}`);
      }
    });
  }, [users]);

  return <div ref={mapRef} style={{ height: "300px", borderRadius: "12px", marginBottom: "20px", border: "1px solid #ddd" }} />;
}
import React, { useState, useEffect, useRef } from "react";
// On importe Leaflet pour la carte (à ajouter dans ton index.html ou via CDN)
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
// <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

// ... (Garder tes constantes FUEL, PRIME, etc.)

// ── NOUVEAU COMPOSANT : CARTE INTERACTIVE ───────────────────────────────────
function InteractiveMap({ users, me }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    useEffect(() => {
        if (!mapRef.current) return;

        // Initialisation de la map centrée sur le lieu de travail (Lys-lez-Lannoy)
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current).setView([50.6703, 3.2283], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance.current);
        }

        // Nettoyage des anciens markers
        mapInstance.current.eachLayer((layer) => {
            if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
        });

        // Icone spéciale pour le Travail
        const workIcon = L.divIcon({
            html: `<div style="background:#4F46E5; color:white; padding:5px; border-radius:5px; font-weight:bold; font-size:10px; border:2px solid white">🏢 TRAVAIL</div>`,
            className: 'custom-div-icon',
            iconSize: [60, 25]
        });
        L.marker([50.6703, 3.2283], { icon: workIcon }).addTo(mapInstance.current).bindPopup("Bureau : Lys-lez-Lannoy");

        // Ajout des collègues
        users.forEach(u => {
            if (u.cD && u.cD.lat) {
                const isMe = u.id === me.id;
                const markerCol = isMe ? '#10b981' : (u.role === 'conducteur' ? '#4f46e5' : '#f59e0b');
                
                const userIcon = L.divIcon({
                    html: `<div style="background:${markerCol}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.2)"></div>`,
                    className: 'user-marker',
                    iconSize: [12, 12]
                });

                L.marker([u.cD.lat, u.cD.lon], { icon: userIcon })
                    .addTo(mapInstance.current)
                    .bindPopup(`<b>${u.prenom}</b> (${u.role})<br>📍 ${u.ville}<br>🕒 ${u.departMatin}`);
            }
        });
    }, [users, me]);

    return (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden', height: '300px', position: 'relative', zIndex: 1 }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
}

// ── NOUVEAU COMPOSANT : CHATBOX PRIVÉE ──────────────────────────────────────
function ChatBox({ me, partner, messages, saveMessages }) {
    const [txt, setTxt] = useState("");
    const key = [me.id, partner.id].sort().join("_");
    const chatMsgs = messages.filter(m => m.matchKey === key);
    const scrollRef = useRef();

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatMsgs]);

    const send = () => {
        if (!txt.trim()) return;
        const newMsg = {
            id: Date.now(),
            matchKey: key,
            senderId: me.id,
            text: txt,
            ts: Date.now()
        };
        saveMessages([...messages, newMsg]);
        setTxt("");
    };

    return (
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', height: '300px' }}>
            <div style={{ fontWeight: 600, borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '10px' }}>
                💬 Discussion avec {partner.prenom}
            </div>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {chatMsgs.length === 0 && <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>Lancez la discussion !</p>}
                {chatMsgs.map(m => (
                    <div key={m.id} style={{
                        alignSelf: m.senderId === me.id ? 'flex-end' : 'flex-start',
                        background: m.senderId === me.id ? '#4F46E5' : '#F3F4F6',
                        color: m.senderId === me.id ? 'white' : 'black',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        maxWidth: '80%'
                    }}>
                        {m.text}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                    style={S.inp} 
                    value={txt} 
                    onChange={e => setTxt(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && send()}
                    placeholder="Ecrire un message..."
                />
                <button style={btn("p")} onClick={send}>✈️</button>
            </div>
        </div>
    );
}

// ── DANS TON COMPOSANT PRINCIPAL (App) ──────────────────────────────────────
// Dans le rendu du Tab "Matching" ou "Mon Espace", tu peux maintenant appeler :

/*
    {tab === "Accueil" && (
        <>
            <InteractiveMap users={users} me={me} />
            <TabAccueil {...P} />
        </>
    )}
    
    {selectedPartner && (
        <ChatBox me={me} partner={selectedPartner} messages={messages} saveMessages={saveMessages} />
    )}
*/
