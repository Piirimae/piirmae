import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

let pohiGraafik = null;
let grupiSektorGraafik = null; // UUS: Parema tiiva sektorgraafiku objekt
let seaded = null;
let hinnadAjalugu = [];
let laetudKassaAndmed = [];

async function initKuuvaatedLeht() {
    // 1. Käivitame autoriseerimise ja ootame, kuni roll on teada
    await kuvaKasutajaNimi(); 

    const roll = window.userRole;

    // 2. 🔒 TURVALUKK: Kui kasutaja on blokeeritud, katkestame lehe laadimise kohe!
    if (roll === "blokeeritud") {
        console.error("Ligipääs blokeeritud.");
        return; 
    }
    
    console.log("Kasutaja on lubatud, laen Kuuvaated andmed...");
}

// --- Alglaadimine ---
window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    seaded = await laeSeaded();
    
    // Laeme hindade finantsajaloo
    const { data: hist } = await sb.from("hinnad").select("*");
    hinnadAjalugu = hist || [];

    TäidaKuuDropdown();
    SeadistaFiltriKuulajad();
    SeadistaKaartideKlikid(); // UUS: Kaartide tagasitõmbumise kuulajad
    
    // Vaikimisi käivitame jooksva kuu Pulsi
    await UuendaPulssi();
});

// --- Kuupäevade ja filtrite loogika ---
function TäidaKuuDropdown() {
    const select = document.getElementById("pulssKuu");
    const nüüd = new Date();
    let jooksevAasta = nüüd.getFullYear();
    let jooksevKuu = nüüd.getMonth() + 1;

    let html = "";
    // Genereerime viimased 12 kuud dropdowni valikusse
    for (let i = 0; i < 12; i++) {
        const kuuStr = `${jooksevAasta}-${String(jooksevKuu).padStart(2, '0')}`;
        html += `<option value="${kuuStr}">${kuuStr}</option>`;
        jooksevKuu--;
        if (jooksevKuu === 0) {
            jooksevKuu = 12;
            jooksevAasta--;
        }
    }
    select.innerHTML = html;
}

function SeadistaFiltriKuulajad() {
    const ajaTyyp = document.getElementById("ajaTyyp");
    const kuuGrupp = document.getElementById("kuuValikGrupp");
    const vahemikGrupp = document.getElementById("vahemikValikGrupp");

    ajaTyyp.onchange = () => {
        if (ajaTyyp.value === "vahemik") {
            kuuGrupp.style.display = "none";
            vahemikGrupp.style.display = "flex";
        } else if (ajaTyyp.value === "nadal") {
            kuuGrupp.style.display = "none";
            vahemikGrupp.style.display = "none";
        } else {
            kuuGrupp.style.display = "flex";
            vahemikGrupp.style.display = "none";
        }
    };

    document.getElementById("uuendaPulssBtn").onclick = UuendaPulssi;
    
    // Perioodi navigatsiooni nupp
    document.getElementById("eelmineKuuBtn").onclick = async () => {
        const kuuSelect = document.getElementById("pulssKuu");
        const praeguneIndex = kuuSelect.selectedIndex;
        if (praeguneIndex < kuuSelect.options.length - 1 && ajaTyyp.value === "kuu") {
            kuuSelect.selectedIndex = praeguneIndex + 1;
            await UuendaPulssi();
        }
    };

    // 🌟 SÜNKROONIS: Seadistame siinsamas ka kopeerimise ja screenshot'i nupud
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

// UUS: Kui hiir liigub kaartidelt välja, kaotame aktiivse klassi ja nad tõmbuvad graafiku alla tagasi
function SeadistaKaartideKlikid() {
    document.querySelectorAll(".nihkes-kaart").forEach(kaart => {
        kaart.addEventListener("mouseleave", () => {
            kaart.classList.remove("aktiivne");
        });
    });
}

// --- Andmete pärimine ja arvutused ---
function leiaHind(tooteNimi, kuupaevStr) {
    const targetTime = new Date(`${kuupaevStr}T00:00:00`).getTime();
    const leitud = hinnadAjalugu.find(h => {
        if (h.nimi !== tooteNimi) return false;
        const alates = new Date(h.kehtiv_alates).getTime();
        const kuni = h.kehtiv_kuni ? new Date(h.kehtiv_kuni).getTime() : Infinity;
        return targetTime >= alates && targetTime <= kuni;
    });
    if (leitud) return Number(leitud.hind);
    const v = seaded.veerud.find(i => i.nimi === tooteNimi);
    return v ? Number(v.hind) || 0 : 0;
}

async function UuendaPulssi() {
    const ajaTyyp = document.getElementById("ajaTyyp").value;
    let query = sb.from("kassatabel").select("*");

    if (ajaTyyp === "kuu") {
        const valitudKuu = document.getElementById("pulssKuu").value;
        query = query.eq("kuu_id", valitudKuu);
    } else if (ajaTyyp === "vahemik") {
        const alates = document.getElementById("vahemikAlates").value;
        const kuni = document.getElementById("vahemikKuni").value;
        if (alates) query = query.gte("kuupaev", alates);
        if (kuni) query = query.lte("kuupaev", kuni);
    } else if (ajaTyyp === "nadal") {
        const jooksevAasta = new Date().getFullYear();
        query = query.gte("kuupaev", `${jooksevAasta}-01-01`).lte("kuupaev", `${jooksevAasta}-12-31`);
    }

    const { data, error } = await query.order("kuupaev", { ascending: true });
    if (error) return console.error(error);
    laetudKassaAndmed = data || [];

    GenerreeriKombineeritudGraafik();
    ArvutaJaKuvaPerioodiInfo(ajaTyyp); 
    UuendaGrupiSektoritGlobaalselt(); 
}
// --- Suure kombineeritud graafiku joonistamine (Tulp + Joon) ---
function GenerreeriKombineeritudGraafik() {
    const sildid = laetudKassaAndmed.map(r => r.kuupaev);
    const kassaKäibed = [];
    const artikliteArvud = [];

    laetudKassaAndmed.forEach(r => {
        let päevaKäive = 0;
        let päevaArtiklid = 0;

        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (v.tüüp === "toit") {
                päevaKäive += kogus * leiaHind(v.nimi, r.kuupaev);
                päevaArtiklid += kogus;
            } else if (v.tüüp === "number") {
                päevaKäive += kogus;
            }
        });

        kassaKäibed.push(päevaKäive);
        artikliteArvud.push(päevaArtiklid);
    });

    if (pohiGraafik) pohiGraafik.destroy();

    const ctx = document.getElementById("pohiGraafik").getContext("2d");
    pohiGraafik = new Chart(ctx, {
        type: "bar",
        data: {
            labels: sildid,
            datasets: [
                {
                    label: "Kassa käive (€)",
                    data: kassaKäibed,
                    backgroundColor: "rgba(241, 196, 15, 0.6)",
                    borderColor: "rgba(241, 196, 15, 1)",
                    borderWidth: 1,
                    yAxisID: "yKassa"
                },
                {
                    label: "Kokku artikleid (tk)",
                    data: artikliteArvud,
                    type: "line",
                    borderColor: "#2c3e50",
                    backgroundColor: "#2c3e50",
                    borderWidth: 3,
                    pointBackgroundColor: "#e74c3c",
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    yAxisID: "yArtiklid",
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: "Kassa tulu ja artiklite maht perioodil" },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${context.raw.toFixed(context.datasetIndex === 0 ? 2 : 0)}` } }
            },
            scales: {
                yKassa: { type: "linear", position: "left", title: { display: true, text: "Käive eurodes (€)" } },
                yArtiklid: { 
                    type: "linear", 
                    position: "right", 
                    title: { display: true, text: "Kogus tükkides (tk)" },
                    grid: { drawOnChartArea: false } 
                }
            },
            // 🌟 MULTI-LUKUSTUS JA SÜNKROONIS SÜSTEEM:
            onClick: (event, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const idx = element.index;

                // 1. Toome parema tiiva kaardid esile
                const kaartGrupid = document.getElementById("kaartTootegrupid");
                const kaartInfo = document.getElementById("kaartPerioodiInfo");
                if (kaartGrupid) kaartGrupid.classList.add("aktiivne");
                if (kaartInfo) kaartInfo.classList.add("aktiivne");

                // 2. Käivitame lohistatava akna ja päevapõhise sektori loogika
                UuendaGrupiSektoritPaevaLõikes(idx);
                
                // Kuna Chart.js 4+ event standardis asub algne klikikoht e.native sees, võtame koordinaadid sealt
                const nativeEvt = event.native || event;
                LooLohistatavSektor(idx, nativeEvt.clientX, nativeEvt.clientY);

                // 3. Tekitame musta info-notatsiooni püsivalt graafiku kohale screenshotiks
                const notatsiooniId = `note-pulss-${element.datasetIndex}-${idx}`;
                const olemasolevNote = document.getElementById(notatsiooniId);
                
                if (olemasolevNote) {
                    olemasolevNote.remove();
                    return;
                }

                const canvasPosition = chart.canvas.getBoundingClientRect();
                const vigaTop = window.scrollY + canvasPosition.top + element.element.y - 45;
                const vigaLeft = window.scrollX + canvasPosition.left + element.element.x - 60;

                const noot = document.createElement("div");
                noot.id = notatsiooniId;
                noot.className = "lukustatud-notatsioon";
                
                const kuupaevTekst = chart.data.labels[idx];
                const seeriaNimi = chart.data.datasets[element.datasetIndex].label;
                const vaartus = chart.data.datasets[element.datasetIndex].data[idx];
                const yhik = element.datasetIndex === 0 ? "€" : "tk";
                
                noot.innerHTML = `<strong>${kuupaevTekst}</strong><br>${seeriaNimi}: ${vaartus.toFixed(element.datasetIndex === 0 ? 2 : 0)} ${yhik}`;
                
                Object.assign(noot.style, {
                    position: "absolute", top: `${vigaTop}px`, left: `${vigaLeft}px`,
                    background: "rgba(0, 0, 0, 0.9)", color: "white", padding: "6px 10px",
                    borderRadius: "4px", fontSize: "11px", zIndex: "1000", cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)", fontFamily: "sans-serif", lineLines: "1.3"
                });

                noot.onclick = () => noot.remove();
                document.body.appendChild(noot);
            }
        }
    });
}
// --- KAST 2: Arvuta ja kuva perioodi koondinfo (Täidab Sinu loetelu!) ---
function ArvutaJaKuvaPerioodiInfo(ajaTyyp) {
    let koguKäive = 0;
    let koguArtikleid = 0;
    let myugigaPaevi = 0;
    let esinesHinnamuutusi = false;
    
    // Toodete koondobjekt
    const toodeteKoondStatistika = {};
    seaded.veerud.forEach(v => {
        if (v.tüüp === "toit") {
            toodeteKoondStatistika[v.nimi] = { pealkiri: v.pealkiri, kogus: 0, tulu: 0 };
        }
    });

    laetudKassaAndmed.forEach(r => {
        let paevaKassa = 0;
        let paevaTooted = 0;
        let paevalOliMyyki = false;
        
        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit") {
                const hind = leiaHind(v.nimi, r.kuupaev);
                const tulu = kogus * hind;
                
                paevaKassa += tulu;
                paevaTooted += kogus;
                koguKäive += tulu;
                koguArtikleid += kogus;
                
                if (toodeteKoondStatistika[v.nimi]) {
                    toodeteKoondStatistika[v.nimi].kogus += kogus;
                    toodeteKoondStatistika[v.nimi].tulu += tulu;
                }
            } else if (v.tüüp === "number") {
                paevaKassa += kogus;
                koguKäive += kogus;
            }
        });
        
        if (paevalOliMyyki) myugigaPaevi++;
        kokkuTooteid = (typeof kokkuTooteid !== "undefined" ? kokkuTooteid : 0) + paevaTooted; // Turvavõrk vanale loogikale

        const muutusSellelPaeval = hinnadAjalugu.some(h => h.kehtiv_alates === r.kuupaev);
        if (muutusSellelPaeval) esinesHinnamuutusi = true;
    });

    // 🌟 JOONISTAME DÜNAAMILISE TEXT-LOENDI (Supp 74 tk / 296.00 €)
    const loendKonteiner = document.getElementById("toodeteTekstLoend");
    let loendHtml = "";
    let raportiTekstRidad = [];

    Object.keys(toodeteKoondStatistika).forEach(nimi => {
        const t = toodeteKoondStatistika[nimi];
        if (t.kogus > 0) {
            const rida = `${t.pealkiri} ${t.kogus} tk / ${t.tulu.toFixed(2)} €`;
            loendHtml += `<div style="padding: 3px 0; border-bottom: 1px solid #edf2f7;">• ${rida}</div>`;
            raportiTekstRidad.push(rida);
        }
    });

    if (loendKonteiner) {
        loendKonteiner.innerHTML = loendHtml || "<div style='color:#718096;'>Valitud vahemikus andmed puuduvad.</div>";
    }

    // Turvaline väärtuste kuvamine (Täidab mõlemad võimalikud HTML-i ID versioonid lennult!) [1.1]
    const kuvaElement = (id, tekst) => {
        const el = document.getElementById(id);
        if (el) el.innerText = tekst;
    };

    kuvaElement("uuringKoikPaevad", `${laetudKassaAndmed.length} päeva aknas`);
    kuvaElement("infoKoikPaevad", laetudKassaAndmed.length);
    
    kuvaElement("uuringMyugiPaevad", `${myugigaPaevi} päeva`);
    kuvaElement("infoMyugiPaevad", myugigaPaevi);
    
    kuvaElement("infoTootedKogus", `${koguArtikleid} tk`);
    kuvaElement("uuringKassaSumma", `${koguKäive.toFixed(2)} €`);
    kuvaElement("infoKassaSumma", `${koguKäive.toFixed(2)} €`);

    const tyypTekstid = { kuu: "Kuu baasil", nadal: "Aasta nädalad", vahemik: "Vaba vahemik" };
    kuvaElement("infoVordlusTüüp", tyypTekstid[ajaTyyp] || ajaTyyp);

    // Näitame või peidame Sinu hoiatustuld
    const hoiatusHinnad = document.getElementById("infoHinnaMuutused");
    if (hoiatusHinnad) {
        hoiatusHinnad.style.display = esinesHinnamuutusi ? "block" : "none";
    }

    // 🌟 GLOBAALNE RAPORT: Salvestame koondraporti teksti lõikelauale kopeerimise (Copy) nupu jaoks [1.1]
    window.viimanePulssKoondraportTekst = `📊 PIIRIMÄE PULSSI KOONDARUANNE\n` +
        `Vaadeldav periood: ${laetudKassaAndmed.length} kalendripäeva\n` +
        `Müügiga päevi kokku: ${myugigaPaevi} päeva\n` +
        `Kogu perioodi tulu: ${koguKäive.toFixed(2)} €\n` +
        `Müüdud artikleid kokku: ${koguArtikleid} tk\n\n` +
        `TOODETE DETAILNE JAOTUS:\n` + raportiTekstRidad.map(r => `- ${r}`).join("\n");
}

// --- KAST 1: Uuenda koondsektorit globaalselt (Kogu valitud perioodi tootejaotus) ---
function UuendaGrupiSektoritGlobaalselt() {
    const sektorAndmed = {};
    
    laetudKassaAndmed.forEach(r => {
        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (v.tüüp === "toit" && kogus > 0) {
                sektorAndmed[v.pealkiri] = (sektorAndmed[v.pealkiri] || 0) + kogus;
            }
        });
    });

    const labels = Object.keys(sektorAndmed);
    const data = Object.values(sektorAndmed);
    const kogusummaTk = data.reduce((a, b) => a + b, 0);

    const dunaamilisedSildid = labels.map((nimi, idx) => {
        const kogus = data[idx];
        const protsent = kogusummaTk > 0 ? ((kogus * 100) / kogusummaTk).toFixed(0) : 0;
        return `${nimi} (${protsent}%)`;
    });

    if (grupiSektorGraafik) grupiSektorGraafik.destroy();

    const ctx = document.getElementById("uuringuSektorGraafik") || document.getElementById("grupiSektorGraafik");
    if (!ctx) return;

    const paevadeVarvid = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#34495e"];

    grupiSektorGraafik = new Chart(ctx.getContext("2d"), {
        type: "pie",
        data: {
            labels: dunaamilisedSildid,
            datasets: [{
                data: data,
                backgroundColor: paevadeVarvid.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, padding: 4 } },
                tooltip: { enabled: false } 
            },
            onClick: (event, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const notatsiooniId = `note-pulss-sektor-${element.index}`;
                const olemasolevNote = document.getElementById(notatsiooniId);
                
                if (olemasolevNote) {
                    olemasolevNote.remove();
                    return;
                }

                const canvasPosition = chart.canvas.getBoundingClientRect();
                const vigaTop = window.scrollY + canvasPosition.top + element.element.y - 20;
                const vigaLeft = window.scrollX + canvasPosition.left + element.element.x - 40;

                const noot = document.createElement("div");
                noot.id = notatsiooniId;
                noot.className = "lukustatud-notatsioon";
                
                const tooteNimiJaProtsent = chart.data.labels[element.index];
                const tykkideArv = chart.data.datasets[0].data[element.index];
                
                noot.innerHTML = `<strong>${tooteNimiJaProtsent}</strong>: ${tykkideArv} tk`;
                
                Object.assign(noot.style, {
                    position: "absolute", top: `${vigaTop}px`, left: `${vigaLeft}px`,
                    background: "rgba(0, 0, 0, 0.85)", color: "white", padding: "5px 8px",
                    borderRadius: "4px", fontSize: "11px", zIndex: "1001", cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)", fontFamily: "sans-serif"
                });

                noot.onclick = () => noot.remove();
                document.body.appendChild(noot);
            }
        }
    });
}
        // 🌟 JÄTKUB SISSESÕIDU LOHISTAMISE LOGIKAST:
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// =========================================================================
// 📥 EXPORT KASTI SEADISTAMINE JA KÄIVITAMINE (Kopeeri & Screenshot)
// =========================================================================

// 1. Sidumine nuppudega lennult laadimisel
function SeadistaPulssEksportKuulajad() {
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

// Pikendame esialgset kuulajate funktsiooni lennult ilma vanu asju rikkumata
const algneFiltriMootorKäsk = SeadistaFiltriKuulajad;
SeadistaFiltriKuulajad = function() {
    algneFiltriMootorKäsk();
    SeadistaPulssEksportKuulajad(); // 🌟 SÜNKROONIS: Süütab õige nimega nupud põlema!
};

// 2. Kopeerimine lõikelauale (Copy to clipboard)
function KopeeriPulssRaportLikelauale() {
    // 🌟 SÜNKROONIS: Loeb andmed otse õigest koondraporti muutujast!
    if (!window.viimanePulssKoondraportTekst) {
        return alert("Andmeid pole veel arvutatud või vahemik on tühi!");
    }
    
    navigator.clipboard.writeText(window.viimanePulssKoondraportTekst)
        .then(() => alert("📋 Pulss-raport edukalt kopeeritud! Võid selle nüüd otse meili kleepida (Paste / Ctrl+V)."))
        .catch(err => console.error("Kopeerimise tõrge:", err));
}

// 3. Ekraanipildi tegemine (Screenshot PNG)
async function TeePulssTyoalastScreenshot() {
    alert("Valmistun ekraanipildi loomiseks. Palun oota hetk...");
    
    // 🔧 PARANDATUD: Täielik ja toimiv html2canvas raamistiku CDN veebiaadress
    if (typeof html2canvas === "undefined") {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net" + "/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Jäädvustame kogu tööala koos märkmete ja graafikutega topeltteravusega
    const uuringuKest = document.body;
    html2canvas(uuringuKest, { background: "#ffffff", useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        // 🔧 PARANDATUD: Lisatud õiged template stringi jutumärgid failinime ümber
        link.download = `piirimae-pulss-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}
// =========================================================================
// 🌟 ÕIGED PARANDUSED JA TÄIENDUSED: KOGU LEHE KOONDSTATISTIKA JA EXPORT
// =========================================================================

// --- 1. SAKSA TÄPSUSEGA TOODETE TEKSTILOENDI JA RAPORTI LOOMINE (Kast 2 Uuendus) ---
// Kirjutame Sinu ArvutaJaKuvaPerioodiInfo funktsiooni tulemused üle targa loendiga
const algneArvutaJaKuvaPerioodiInfo = ArvutaJaKuvaPerioodiInfo;
ArvutaJaKuvaPerioodiInfo = function(vordlusTyyp) {
    // Käivitame esmalt Sinu baasarvutused (Kassa, Päevad, Hoiatustuled)
    algneArvutaJaKuvaPerioodiInfo(vordlusTyyp);

    if (laetudKassaAndmed.length === 0) return;

    // Loome otsinguobjekti toodete summeerimiseks kogu perioodi kohta
    const toodeteKoondStatistika = {};
    seaded.veerud.forEach(v => {
        if (v.tüüp === "toit") {
            toodeteKoondStatistika[v.nimi] = { pealkiri: v.pealkiri, kogus: 0, tulu: 0 };
        }
    });

    let koguKäiveTooted = 0;
    let koguArtikleidTooted = 0;
    let müügigaPäevi = 0;

    laetudKassaAndmed.forEach(r => {
        let paevalOliMyyki = false;
        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit") {
                const hind = leiaHind(v.nimi, r.kuupaev);
                const tulu = kogus * hind;
                koguKäiveTooted += tulu;
                koguArtikleidTooted += kogus;

                if (toodeteKoondStatistika[v.nimi]) {
                    toodeteKoondStatistika[v.nimi].kogus += kogus;
                    toodeteKoondStatistika[v.nimi].tulu += tulu;
                }
            }
        });
        if (paevalOliMyyki) müügigaPäevi++;
    });

    // 🌟 JOONISTAME DÜNAAMILISE KAST 2 TOODETE TEKSTILOENDI (Supp 74 tk / 296.00 €)
    let loendKest = document.getElementById("toodeteTekstLoend");
    if (!loendKest) {
        const kassaElement = document.getElementById("infoKassaSumma");
        if (kassaElement) {
            loendKest = document.createElement("div");
            loendKest.id = "toodeteTekstLoend";
            Object.assign(loendKest.style, {
                maxHeight: "140px", overflowY: "auto", fontVerra: "monospace",
                fontSize: "11px", background: "#f8f9fa", padding: "6px",
                borderRadius: "4px", border: "1px solid #cbd5e1", marginTop: "10px",
                lineHeight: "1.4", textAlign: "left", color: "#2d3748"
            });
            kassaElement.parentNode.appendChild(loendKest);
        }
    }

    let loendHtml = "";
    let raportiTekstRidad = [];

    Object.keys(toodeteKoondStatistika).forEach(nimi => {
        const t = toodeteKoondStatistika[nimi];
        if (t.kogus > 0) {
            const rida = `${t.pealkiri} ${t.kogus} tk / ${t.tulu.toFixed(2)} €`;
            loendHtml += `<div style="padding:2px 0; border-bottom:1px solid #edf2f7;">• ${rida}</div>`;
            raportiTekstRidad.push(rida);
        }
    });

    if (loendKest) {
        loendKest.innerHTML = loendHtml || "<div>Valitud vahemikus toidutellimused puuduvad.</div>";
    }

    // 🌟 RAPORTI LOOMINE: Paneme kokku teksti lõikelauale kopeerimise (Copy) jaoks
    window.viimanePulssKoondraportTekst = `📊 PIIRIMÄE PULSSI KOONDARUANNE\n` +
        `Vaadeldav periood: ${laetudKassaAndmed.length} kalendripäeva\n` +
        `Müügiga päevi kokku: ${müügigaPäevi} päeva\n` +
        `Kogu perioodi tulu: ${document.getElementById("infoKassaSumma")?.innerText || koguKäiveTooted.toFixed(2) + " €"}\n\n` +
        `TOODETE DETAILNE JAOTUS:\n` + raportiTekstRidad.map(r => `- ${r}`).join("\n");
};

// --- 2. KAST 1 LUKUSTAMINE: Sektordiagrammile protsendid lennult (Kogu perioodi jaotus) ---
const algneUuendaGrupiSektoritGlobaalselt = UuendaGrupiSektoritGlobaalselt;
UuendaGrupiSektoritGlobaalselt = function() {
    const gruppideSummad = {};
    laetudKassaAndmed.forEach(r => {
        seaded.veerud.forEach(v => {
            if (v.tüüp === "toit") {
                const kogus = Number(r[v.nimi]) || 0;
                if (kogus > 0) {
                    gruppideSummad[v.pealkiri] = (gruppideSummad[v.pealkiri] || 0) + kogus;
                }
            }
        });
    });

    const labels = Object.keys(gruppideSummad);
    const data = Object.values(gruppideSummad);
    const kogusummaTk = data.reduce((a, b) => a + b, 0);

    const dunaamilisedSildid = labels.map((nimi, idx) => {
        const kogus = data[idx];
        const protsent = kogusummaTk > 0 ? ((kogus * 100) / kogusummaTk).toFixed(0) : 0;
        return `${nimi} (${protsent}%)`;
    });

    if (grupiSektorGraafik) grupiSektorGraafik.destroy();
    const ctx = document.getElementById("grupiSektorGraafik");
    if (!ctx) return;

    grupiSektorGraafik = new Chart(ctx.getContext("2d"), {
        type: "pie",
        data: {
            labels: dunaamilisedSildid,
            datasets: [{
                data: data,
                backgroundColor: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c", "#e67e22"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "bottom", labels: { boxWidth: 10, font: { size: 9 }, padding: 3 } },
                tooltip: { enabled: false } 
            },
            onClick: (event, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const notatsiooniId = `note-pulss-sektor-${element.index}`;
                const olemasolevNote = document.getElementById(notatsiooniId);
                
                if (olemasolevNote) { olemasolevNote.remove(); return; }

                const canvasPosition = chart.canvas.getBoundingClientRect();
                const vigaTop = window.scrollY + canvasPosition.top + element.element.y - 20;
                const vigaLeft = window.scrollX + canvasPosition.left + element.element.x - 40;

                const noot = document.createElement("div");
                noot.id = notatsiooniId;
                noot.className = "lukustatud-notatsioon";
                noot.innerHTML = `<strong>${chart.data.labels[element.index]}</strong>: ${chart.data.datasets[0].data[element.index]} tk`;
                
                Object.assign(noot.style, {
                    position: "absolute", top: `${vigaTop}px`, left: `${vigaLeft}px`,
                    background: "rgba(0, 0, 0, 0.85)", color: "white", padding: "5px 8px",
                    borderRadius: "4px", fontSize: "11px", zIndex: "1005", cursor: "pointer"
                });
                noot.onclick = () => noot.remove();
                document.body.appendChild(noot);
            }
        }
    });
};
// =========================================================================
// 📥 EXPORT PANEELI SEADISTAMINE JA KÄIVITAMINE (Kopeeri & Screenshot)
// =========================================================================

// 1. Sidumine nuppudega lennult lehe laadimisel
function SeadistaPulssEksportKuulajad() {
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

// Pikendame esialgset kuulajate funktsiooni lennult ilma Sinu vanu asju rikkumata
const algneFiltriMootorKäsk = SeadistaFiltriKuulajad;
SeadistaFiltriKuulajad = function() {
    algneFiltriMootorKäsk();
    SeadistaPulssEksportKuulajad(); // 🌟 Süütab eksportnupud põlema!
};

// 2. Kopeerimine lõikelauale (Copy to clipboard)
function KopeeriPulssRaportLikelauale() {
    // Kontrollime, kas globaalne raporti tekst on olemas
    if (!window.viimanePulssKoondraportTekst) {
        return alert("Andmeid pole veel arvutatud või perioodi vahemik on tühi!");
    }
    
    navigator.clipboard.writeText(window.viimanePulssKoondraportTekst)
        .then(() => alert("📋 Koondraport kopeeritud! Võid selle nüüd otse meili või sõnumisse kleepida (Paste / Ctrl+V)."))
        .catch(err => console.error("Kopeerimise tõrge:", err));
}

// 3. Ekraanipildi tegemine (Screenshot PNG)
async function TeePulssTyoalastScreenshot() {
    alert("Valmistun ekraanipildi loomiseks. Palun oota hetk...");
    
    // 🔧 PARANDATUD: Täielik ja toimiv html2canvas raamistiku CDN veebiaadress
    if (typeof html2canvas === "undefined") {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net" + "/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Jäädvustame kogu tööala koos märkmete ja graafikutega topeltteravusega
    const uuringuKest = document.body;
    html2canvas(uuringuKest, { background: "#ffffff", useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        link.download = `piirimae-pulss-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

