import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

// DOM elemendid
const kuuValik = document.getElementById("kuuValik");
const lukustaNupp = document.getElementById("lukustaNupp");
const salvestaNupp = document.getElementById("salvestaNupp");
const arhiiviNupp = document.getElementById("arhiiviNupp");
const prindiNupp = document.getElementById("prindiNupp");
const laeAllaNupp = document.getElementById("laeAllaNupp");
const vaateReziim = document.getElementById("vaateReziim");
const tbody = document.getElementById("tbody");

// --- Režiimi tuvastamine ---
const url = new URL(window.location.href);
const parandaKuu = url.searchParams.get("paranda");
const parandaArhiiviId = url.searchParams.get("arhiiviId");
const onParandusRez = parandaKuu && parandaArhiiviId;

let tabelLukus = true;
let praeguneKuu = null;

// =========================
//  INIT KASSATABEL (Kutsutakse välja logic.js seest!)
// =========================
export async function laeAndmedJaLukustus() {
    console.log("KASSATABEL: logic.js lõpetas tabeli ehituse. Alustan andmete laadimist Supabasest...");

    // 1. Laeme kasutaja nime ja tuvastame rolli
    await kuvaKasutajaNimi();

    if (onParandusRez) {
        praeguneKuu = parandaKuu;
    } else {
        praeguneKuu = kuuValik ? kuuValik.value : "";
    }

    // 2. Laeme andmed Supabasest valitud kuu kohta
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    console.log("KASSATABEL: Supabasest laetud andmed:", andmed);
    
    // 3. Täidame logic.js poolt valmis ehitatud tabeli sisendid andmetega
    täidaTabelSupabaseAndmetega(andmed);

    // 4. Seadistame nupud
    seadistaNupudJaLukustus();

    // 5. Kontrollime rolli õiguseid ja määrame lukustuse oleku
    const roll = window.userRole || "vaatleja";
    console.log("KASSATABEL: Kontrollin rolli õiguseid:", roll);

    if (roll === "superadmin" || roll === "admin" || roll === "sisestaja") {
        tabelLukus = false;
        rakendaLukustusOlek(false); // Avame tabeli superadminile/adminile/sisestajale
    } else {
        tabelLukus = true;
        rakendaLukustusOlek(true);  // Vaatlejale jääb lukku
    }

    // Sunnime logic.js-i summasid korraks üle arvutama laetud andmete põhjal
    setTimeout(() => {
        const esimeneInput = tbody.querySelector("input");
        if (esimeneInput) {
            esimeneInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }, 50);
}

// =========================
//  TABELI TÄITMINE
// =========================
function täidaTabelSupabaseAndmetega(andmed) {
    if (!andmed || andmed.length === 0) return;

    andmed.forEach(r => {
        const puhasKuupaev = r.kuupaev && r.kuupaev.includes("T") ? r.kuupaev.split("T")[0] : r.kuupaev;
        const tr = tbody.querySelector(`tr[data-date="${puhasKuupaev}"]`);
        if (!tr) return;

        const inputs = tr.querySelectorAll("input");
        inputs.forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            if (r[nimi] !== undefined && r[nimi] !== null) {
                inp.value = r[nimi];
            }
        });
    });
}

// =========================
//  SUPABASE PÄRINGUD
// =========================
async function laeKuuAndmedSupabasest(kuuId) {
    const { data, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("kuupaev");

    if (error) console.error("Viga andmete laadimisel:", error);
    return data || [];
}

function rakendaLukustusOlek(lukus) {
    tbody.querySelectorAll("input").forEach(inp => {
        inp.disabled = lukus;
    });

    if (lukustaNupp) {
        lukustaNupp.textContent = lukus ? "Tabel lukus (ava sisestamiseks)" : "Tabel avatud (lukusta)";
    }
}

// ✅ UUENDATUD JA PUHASTATUD FUNKTSIOON KASSATABEL.JS SEES:
function seadistaNupudJaLukustus() {
    // 1. Tavaline reaalne salvestamine (Ei mingeid paranduse modaleid!)
    if (salvestaNupp) {
        salvestaNupp.onclick = async () => {
            // Siia läheb Sinu reaalne elava kuu andmete salvestamise käsk Supabasse,
            // mille me saame vajadusel järgmisena korda teha!
            alert("Käivitan elava kuu andmete salvestamise põhitabelisse...");
        };
    }

    // 2. Lukustamise nupu loogika jääb samaks
    if (lukustaNupp) {
        lukustaNupp.onclick = () => {
            tabelLukus = !tabelLukus;
            rakendaLukustusOlek(tabelLukus);
        };
    }

    // 3. Prindi nupp töötab alati
    if (prindiNupp) prindiNupp.onclick = () => window.print();
    
    // 4. Teised nupud, mis on ootel
    if (laeAllaNupp) laeAllaNupp.onclick = () => alert("PDF raporti allalaadimine on arenduses.");
}


async function salvestaParandatudArhiiv() {
    // Teie olemasolev salvestamise loogika...
}
// =========================================================================
// 📺 UNIVERSAALNE TÄISEKRAANI MOOTOR (Kogu rakenduse lehtedele) [1.1]
// =========================================================================
window.addEventListener("DOMContentLoaded", () => {
    // 1. Luuakse dünaamiliselt väike puhas ujuv nupp ekraani ülanurka [1.1]
  const ujuvNupp = document.createElement("button");
ujuvNupp.id = "globaalneFullscreenBtn";
ujuvNupp.innerHTML = "📺 Täisekraan";
 Algsis tekst
    
    // Stiilime nupu otse koodist, et ta ei sõltuks CSS faili segadustest
    Object.assign(ujuvNupp.style, {
        position: "fixed",
        top: "10px",
        right: "10px",
        zIndex: "99999", // Alati kõige peal
        padding: "8px 12px",
        background: "#2c3e50",
        color: "white",
        border: "1px solid #cbd5e1",
        borderRadius: "6px",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "12px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        transition: "all 0.2s ease"
    });

    document.body.appendChild(ujuvNupp);

    // 2. Täisekraani sisse- ja väljalülitamise käsk lennult [1.1]
    ujuvNupp.onclick = () => {
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.msFullscreenElement) {
            
            const docEl = document.documentElement;
            if (docEl.requestFullscreen) docEl.requestFullscreen();
            else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen(); // Safari / iOS
            else if (docEl.msRequestFullscreen) docEl.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
    };

    // 3. OLEKU JÄLGIMINE: Tuvastab ka telefoni enda 'Tagasi' nupu või žesti [1.1]
    function uuendaNupuVisuaali() {
        const onTaisekraan = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        
        if (onTaisekraan) {
            ujuvNupp.innerHTML = "❌ Sulge"; // Muutub ristiks või sulgemise märgiks, nagu kaardil [1.1]
            ujuvNupp.style.background = "#e74c3c"; // Muutub punaseks
        } else {
            ujuvNupp.innerHTML = "📺 Täisekraan";
            ujuvNupp.style.background = "#2c3e50"; // Tumesinine tagasi
        }
    }

    document.addEventListener("fullscreenchange", uuendaNupuVisuaali);
    document.addEventListener("webkitfullscreenchange", uuendaNupuVisuaali);
    document.addEventListener("msfullscreenchange", uuendaNupuVisuaali);
});




















