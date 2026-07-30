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

                // 2. Käivitame statava akna ja päevapõhise sektori loogika
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

    // Turvaline väärtuste kuvamine lennult
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

    const hoiatusHinnad = document.getElementById("infoHinnaMuutused");
    if (hoiatusHinnad) {
        hoiatusHinnad.style.display = esinesHinnamuutusi ? "block" : "none";
    }

    // 🌟 GLOBAALNE RAPORT: Salvestame raporti teksti kopeerimise (Copy) nupu jaoks [1.1]
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

// --- UUS: Sektor 1 uuendamine klikitud päeva põhiselt ---
function UuendaGrupiSektoritPaevaLõikes(index) {
    const rida = laetudKassaAndmed[index];
    if (!rida) return; 
    
    const sildid = [];
    const kogused = []; 
    
    seaded.veerud.forEach(v => {
        if (v.tüüp === "toit") {
            const k = Number(rida[v.nimi]) || 0;
            if (k > 0) { 
                sildid.push(v.pealkiri); 
                kogused.push(k);
            }
        }
    });

    JoonistaSektorDiagramm(sildid, kogused, `Jaotus: ${rida.kuupaev}`);
}

function JoonistaSektorDiagramm(labels, data, pealkiri) {
    if (grupiSektorGraafik) grupiSektorGraafik.destroy();
    const ctx = document.getElementById("grupiSektorGraafik") || document.getElementById("uuringuSektorGraafik");
    if (!ctx) return;
    
    grupiSektorGraafik = new Chart(ctx.getContext("2d"), {
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
                title: { display: true, text: pealkiri, font: { size: 11 } }
            }
        }
    });
}

// =========================================================================
// 🍕 DÜNAAMILISTE, LOHISTATAVAT KETASTE LOOMINE JA LOHISTAMISMOOTOR [1.1]
// =========================================================================
let popupIdCounter = 0;

function LooLohistatavSektor(kassaAndmeteIndex, clickX, clickY) {
    const rida = laetudKassaAndmed[kassaAndmeteIndex];
    if (!rida) return;

    popupIdCounter++;
    const popupId = `popup-${popupIdCounter}`;
    const canvasId = `canvas-${popupIdCounter}`;

    const sildid = [];
    const kogused = [];
    
    seaded.veerud.forEach(v => {
        if (v.tüüp === "toit") {
            const k = Number(rida[v.nimi]) || 0;
            if (k > 0) {
                sildid.push(v.pealkiri);
                kogused.push(k);
            }
        }
    });

    if (sildid.length === 0) return;

    const ala = document.getElementById("graafikuAla") || document.body;
    const popup = document.createElement("div");
    popup.id = popupId;
    popup.classList.add("draggable-popup");
    
    const rect = ala.getBoundingClientRect();
    Object.assign(popup.style, {
    Object.assign(popup.style, {
        position: "absolute", 
        left: `${clickX - rect.left - 50}px`, 
        top: `${clickY - rect.top - 50}px`,
        background: "#ffffff", 
        border: "1px solid #cbd5e1", 
        borderRadius: "6px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.15)", 
        zIndex: "2000", 
        padding: "10px", 
        width: "220px"
    });

    popup.innerHTML = `
        <div class="popup-header" id="${popupId}-header" style="display:flex; justify-content:space-between; align-items:center; background:#edf2f7; padding:4px 8px; margin:-10px -10px 10px -10px; border-radius:6px 6px 0 0; cursor:move; font-size:11px; font-weight:bold;">
            <span class="popup-title">🍕 Artiklid: ${rida.kuupaev}</span>
            <button onclick="document.getElementById('${popupId}').remove()" style="background:none; border:none; font-size:16px; font-weight:bold; cursor:pointer;">×</button>
        </div>
        <canvas id="${canvasId}" width="200" height="200"></canvas>
    `;

    ala.appendChild(popup);

    const ctx = document.getElementById(canvasId).getContext("2d");
    new Chart(ctx, {
        type: "pie",
        data: {
            labels: sildid,
            datasets: [{
                data: kogused,
                backgroundColor: ["#3498db", "#2ecc71", "#e74c3c", "#f1c40f", "#9b59b6", "#1abc9c", "#34495e"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { 
                legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 9 } } } 
            }
        }
    });

    MuudaAkenLohistatavaks(popup);
}

function MuudaAkenLohistatavaks(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(`${element.id}-header`);
    
    if (header) header.onmousedown = dragMouseDown;
    else element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// =========================================================================
// 📥 EXPORT PANEELI SEADISTAMINE JA KÄIVITAMINE (Kopeeri & Screenshot)
// =========================================================================
function SeadistaPulssEksportKuulajad() {
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

function KopeeriPulssRaportLikelauale() {
    if (!window.viimanePulssKoondraportTekst) {
        return alert("Andmeid pole veel arvutatud või vahemik on tühi!");
    }
    navigator.clipboard.writeText(window.viimanePulssKoondraportTekst)
        .then(() => alert("📋 Koondraport kopeeritud! Võid selle nüüd meili kleepida (Ctrl+V)."))
        .catch(err => console.error("Kopeerimise tõrge:", err));
}

async function TeePulssTyoalastScreenshot() {
    alert("Valmistun ekraanipildi loomiseks. Palun oota hetk...");
    if (typeof html2canvas === "undefined") {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://jsdelivr.net" + "/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    const uuringuKest = document.body;
    html2canvas(uuringuKest, { background: "#ffffff", useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        link.download = `piirimae-pulss-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

