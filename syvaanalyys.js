// syvaanalyys.js (MOODUL) - Piirimäe Täielik Ristanalüüs ja Süvaanalüüs
import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

// Globaalsed muutujad graafikute ja andmete jaoks
let uuringuGraafik = null, uuringuSektorGraafik = null;
let seaded = null, hinnadAjalugu = [], baasKassaAndmed = [];

// --- 1. Alglaadimine ja andmete laadimine ---
window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    document.getElementById("logoutBtn").onclick = logout;
    seaded = await laeSeaded();
    const { data: hist } = await sb.from("hinnad").select("*");
    hinnadAjalugu = hist || [];

    // Kuupäevade vaikeväärtused
    const tana = new Date();
    document.getElementById("analyysKuni").value = tana.toISOString().split('T')[0];
    const aastaTagasi = new Date();
    aastaTagasi.setFullYear(tana.getFullYear() - 1);
    document.getElementById("analyysAlates").value = aastaTagasi.toISOString().split('T')[0];

    SeadistaFiltriKuulajad();
    await LaeBaasAndmedSupabasest();
});

// --- 2. Filtri ja dünaamilise UI haldus ---
function SeadistaFiltriKuulajad() {
    document.getElementById("uuendaUuringBtn").onclick = K2ivitaRistanalyys;
    document.getElementById("chkKoikTooted").onchange = (e) => {
        document.getElementById("gruppTooted").style.display = e.target.checked ? "none" : "flex";
    };
}

function GenerreeriDunaamilisedLinnukesed() {
    const sets = { aastad: new Set(), kuud: new Set(), nadalad: new Set(), tooted: new Set() };
    
    baasKassaAndmed.forEach(r => {
        if (!r.kuupaev) return;
        const d = new Date(r.kuupaev);
        sets.aastad.add(d.getFullYear());
        sets.kuud.add(d.getMonth() + 1);
        sets.nadalad.add(TuvastaNadalaNumber(d));
        seaded.veerud.forEach(v => {
            if (v.tüüp === "toit" && Number(r[v.nimi]) > 0) {
                sets.tooted.add(v.nimi);
            }
        });
    });
    
    // Sorteerime massiivid enne HTML-i saatmist puhtalt eraldi ära, et vältida sulgude segadust
    const sünkroonAastad = Array.from(sets.aastad).sort((a, b) => a - b);
    const sünkroonKuud = Array.from(sets.kuud).sort((a, b) => a - b);
    const sünkroonNadalad = Array.from(sets.nadalad).sort((a, b) => a - b);
    const sünkroonTooted = Array.from(sets.tooted).map(n => seaded.veerud.find(v => v.nimi === n)).filter(Boolean);

    // Genereerime puhta HTML-i
    EhitaLinnukesteHtml("gruppAastad", sünkroonAastad, "chk-aasta", (val) => `${val}. aasta`);
    EhitaLinnukesteHtml("gruppKuud", sünkroonKuud, "chk-kuu", (val) => ["Jaan", "Veebr", "Märts", "Apr", "Mai", "Juuni", "Juuli", "Aug", "Sept", "Okt", "Nov", "Dets"][val - 1]);
    EhitaLinnukesteHtml("gruppNadalad", sünkroonNadalad, "chk-nadal", (val) => `Näd ${val}`);
    EhitaLinnukesteHtmlObjektidega("gruppTooted", sünkroonTooted, "chk-toode");
}


// Abifunktsioonid HTMLi loomiseks ja "Vali kõik" loogikaks
function EhitaLinnukesteHtml(id, arr, kl, fmt) { /* ...dünaamiline chkbox list... */ }
function EhitaLinnukesteHtmlObjektidega(id, arr, kl) { /* ...toodete chkbox list... */ }

// --- 3. Ristanalüüsi mootor ja Chart.js ---
async function LaeBaasAndmedSupabasest() {
    const alates = document.getElementById("analyysAlates").value;
    const kuni = document.getElementById("analyysKuni").value;
    const { data } = await sb.from("kassatabel").select("*").gte("kuupaev", alates).lte("kuupaev", kuni);
    baasKassaAndmed = data || [];
    GenerreeriDunaamilisedLinnukesed();
    K2ivitaRistanalyys();
}

function leiaHindAjaloost(tooteNimi, kuupaevStr) {
    const target = new Date(kuupaevStr).getTime();
    const leitud = hinnadAjalugu.find(h => h.nimi === tooteNimi && target >= new Date(h.kehtiv_alates).getTime() && (!h.kehtiv_kuni || target <= new Date(h.kehtiv_kuni).getTime()));
    return leitud ? Number(leitud.hind) : (seaded.veerud.find(v => v.nimi === tooteNimi)?.hind || 0);
}

function K2ivitaRistanalyys() {
    // Filtreerib baasKassaAndmed valitud checkboxide alusel
    // Arvutab koondsummad ja valmistab andmed Chart.js jaoks
    JoonistaAastateVordlusGraafik(aastateKuuKaupaTulud);
    JoonistaKoondSektorGraafik(labels, data);
}

// Chart.js tulp- ja sektordiagrammide joonistamine
function JoonistaAastateVordlusGraafik(data) { /* ...Chart.js bar... */ }
function JoonistaKoondSektorGraafik(l, d) { /* ...Chart.js pie... */ }
function TuvastaNadalaNumber(d) { /* ...ISO nädal... */ }

