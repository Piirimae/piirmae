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


// --- 4. Linnukeste HTML-i ehitamine ja "Vali kaikki" loogika ---
function EhitaLinnukesteHtml(konteinerId, andmedArr, klassiNimi, vormindaTekstFn) {
    const ala = document.getElementById(konteinerId);
    if (!ala) return;

    let html = `
        <label style="font-weight:bold; border-bottom:1px dashed #cbd5e1; padding-bottom:2px; margin-bottom:4px;">
            <input type="checkbox" id="${konteinerId}-all" checked> Vali kõik
        </label>
    `;

    andmedArr.forEach(val => {
        const kuvatavTekst = vormindaTekstFn ? vormindaTekstFn(val) : val;
        html += `<label><input type="checkbox" class="${klassiNimi}" value="${val}" checked> ${kuvatavTekst}</label>`;
    });

    ala.innerHTML = html;

    const koikChk = document.getElementById(`${konteinerId}-all`);
    if (koikChk) {
        koikChk.onchange = (e) => {
            ala.querySelectorAll(`.${klassiNimi}`).forEach(chk => chk.checked = e.target.checked);
        };
    }
}

function EhitaLinnukesteHtmlObjektidega(konteinerId, tootedArr, klassiNimi) {
    const ala = document.getElementById(konteinerId);
    if (!ala) return;

    let html = `
        <label style="font-weight:bold; border-bottom:1px dashed #cbd5e1; padding-bottom:2px; margin-bottom:4px;">
            <input type="checkbox" id="${konteinerId}-all" checked> Vali kõik
        </label>
    `;

    tootedArr.forEach(v => {
        if (!v) return;
        html += `<label><input type="checkbox" class="${klassiNimi}" value="${v.nimi}" checked> ${v.pealkiri}</label>`;
    });

    ala.innerHTML = html;

    const koikChk = document.getElementById(`${konteinerId}-all`);
    if (koikChk) {
        koikChk.onchange = (e) => {
            ala.querySelectorAll(`.${klassiNimi}`).forEach(chk => chk.checked = e.target.checked);
        };
    }
}

// --- 5. Ristanalüüsi mootor ---
function K2ivitaRistanalyys() {
    const valitudAastad = Array.from(document.querySelectorAll(".chk-aasta:checked")).map(c => Number(c.value));
    const valitudKuud = Array.from(document.querySelectorAll(".chk-kuu:checked")).map(c => Number(c.value));
    const valitudNadalad = Array.from(document.querySelectorAll(".chk-nadal:checked")).map(c => Number(c.value));
    const valitudPaevad = Array.from(document.querySelectorAll(".chk-paev:checked")).map(c => Number(c.value));
    
    const koikTootedLinnuke = document.getElementById("chkKoikTooted").checked;
    const valitudTooted = koikTootedLinnuke 
        ? seaded.veerud.filter(v => v.tüüp === "toit").map(v => v.nimi)
        : Array.from(document.querySelectorAll(".chk-toode:checked")).map(c => c.value);

    let uuritavadPaevad = 0;
    let myugigaPaevad = 0;
    let uuringuKogusummaKassa = 0;
    let uuringuKogusummaTooted = 0;

    const sektorAndmed = {};
    const aastateKuuKaupaTulud = {};

    baasKassaAndmed.forEach(r => {
        if (!r.kuupaev) return;
        const d = new Date(r.kuupaev);
        
        const rAasta = d.getFullYear();
        const rKuu = d.getMonth() + 1;
        const rNadal = TuvastaNadalaNumber(d);
        const rPaev = d.getDay();

        if (!valitudAastad.includes(rAasta)) return;
        if (!valitudKuud.includes(rKuu)) return;
        if (!valitudNadalad.includes(rNadal)) return;
        if (!valitudPaevad.includes(rPaev)) return;

        uuritavadPaevad++;
        let paevalOliMyyki = false;
        let paevaKassaSumma = 0;

        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit") {
                if (valitudTooted.includes(v.nimi)) {
                    const tooteHind = leiaHindAjaloost(v.nimi, r.kuupaev);
                    const kassaOsa = kogus * tooteHind;
                    paevaKassaSumma += kassaOsa;
                    uuringuKogusummaTooted += kogus;

                    sektorAndmed[v.pealkiri] = (sektorAndmed[v.pealkiri] || 0) + kogus;
                }
            } else if (v.tüüp === "number") {
                paevaKassaSumma += kogus;
            }
        });

        if (paevalOliMyyki) myugigaPaevad++;
        uuringuKogusummaKassa += paevaKassaSumma;

        if (!aastateKuuKaupaTulud[rAasta]) {
            aastateKuuKaupaTulud[rAasta] = new Array(12).fill(0);
        }
        aastateKuuKaupaTulud[rAasta][rKuu - 1] += paevaKassaSumma;
    });

    document.getElementById("uuringKoikPaevad").innerText = uuritavadPaevad;
    document.getElementById("uuringMyugiPaevad").innerText = myugigaPaevad;
    document.getElementById("uuringTootedKogus").innerText = `${uuringuKogusummaTooted} tk`;
    document.getElementById("uuringKassaSumma").innerText = `${uuringuKogusummaKassa.toFixed(2)} €`;
    document.getElementById("uuringAktiivsedTooted").innerText = valitudTooted.length;

    JoonistaAastateVordlusGraafik(aastateKuuKaupaTulud);
    JoonistaKoondSektorGraafik(Object.keys(sektorAndmed), Object.values(sektorAndmed));
}

// --- 6. Chart.js tulp- ja sektordiagrammide joonistamine ---
function JoonistaAastateVordlusGraafik(aastateData) {
    if (uuringuGraafik) uuringuGraafik.destroy();

    const kuudeSildid = ["Jaan", "Veebr", "Märts", "Apr", "Mai", "Juuni", "Juuli", "Aug", "Sept", "Okt", "Nov", "Dets"];
    const varvid = [
        { bg: "rgba(241, 196, 15, 0.6)", border: "rgba(241, 196, 15, 1)" }, // Kollane/Kuldne
        { bg: "rgba(52, 152, 219, 0.6)", border: "rgba(52, 152, 219, 1)" }, // Sinine
        { bg: "rgba(46, 204, 113, 0.6)", border: "rgba(46, 204, 113, 1)" }  // Roheline
    ];

    const datasets = Object.keys(aastateData).map((aasta, idx) => {
        const v = varvid[idx % varvid.length];
        return {
            label: `${aasta}. aasta käive (€)`,
            data: aastateData[aasta],
            backgroundColor: v.bg,
            borderColor: v.border,
            borderWidth: 1
        };
    });

    const ctx = document.getElementById("uuringuGraafik").getContext("2d");
    uuringuGraafik = new Chart(ctx, {
        type: "bar",
        data: {
            labels: kuudeSildid,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { type: "linear", beginAtZero: true, title: { display: true, text: "Käive eurodes (€)" } }
            }
        }
    });
}

function JoonistaKoondSektorGraafik(labels, data) {
    if (uuringuSektorGraafik) uuringuSektorGraafik.destroy();

    const ctx = document.getElementById("uuringuSektorGraafik").getContext("2d");
    uuringuSektorGraafik = new Chart(ctx, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c", "#e67e22"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Valitud perioodi koondjaotus", font: { size: 11 } }
            }
        }
    });
}

// --- 7. ISO Nädalapäeva tuvastamise standard ---
function TuvastaNadalaNumber(d) {
    const tana = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const paevaNr = tana.getUTCDay() || 7;
    tana.setUTCDate(tana.getUTCDate() + 4 - paevaNr);
    const aastaAlgus = new Date(Date.UTC(tana.getUTCFullYear(), 0, 1));
    return Math.ceil((((tana - aastaAlgus) / 86400000) + 1) / 7);
}


