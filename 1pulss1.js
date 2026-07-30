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
        return; // See rida takistab ülejäänud koodi (andmete laadimise) käivitamist!
    }
    
    // Kui vaatleja roll ei tohi samuti seda lehte näha, kasuta hoopis seda:
    // if (roll === "blokeeritud" || roll === "vaatleja") { ... }

    // --- Siit edasi tuleb sinu lehe tavaline kood (graafikute joonistamine, andmete laadimine) ---
    console.log("Kasutaja on lubatud, laen Kuuvaated andmed...");
    // laeGraafikud();
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
            // Nädalate vaade kasutab siin näitena jooksva aasta andmeid, kohandatav vastavalt vajadusele
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
        // Nädalavaate puhul päritakse vaikimisi kogu jooksev aasta, grupeerimine tehakse graafikus
        const jooksevAasta = new Date().getFullYear();
        query = query.gte("kuupaev", `${jooksevAasta}-01-01`).lte("kuupaev", `${jooksevAasta}-12-31`);
    }

    const { data, error } = await query.order("kuupaev", { ascending: true });
    if (error) return console.error(error);
    laetudKassaAndmed = data || [];

    GenerreeriKombineeritudGraafik();
    ArvutaJaKuvaPerioodiInfo(ajaTyyp); // UUS: Täidab parema tiiva kolmanda kasti staatika
    UuendaGrupiSektoritGlobaalselt(); // UUS: Täidab esmase sektordiagrammi kogu perioodi andmetega
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
                yArtiklid: { type: "linear", position: "right", title: { display: true, text: "Kogus tükkides (tk)" }, grid: { drawOnChartArea: false } }
            },
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    
                    // Toome parema tiiva kaardid esile ja uuendame nende sisu vastavalt klikitud päevale
                    const kaartGrupid = document.getElementById("kaartTootegrupid");
                    const kaartInfo = document.getElementById("kaartPerioodiInfo");
                    
                    kaartGrupid.classList.add("aktiivne");
                    kaartInfo.classList.add("aktiivne");

                    UuendaGrupiSektoritPaevaLõikes(idx);
                    
                    // Käivitame ka Sinu algse lohistatava akna loogika, kui seda soovid paralleelselt kasutada
                    LooLohistatavSektor(idx, e.native.clientX, e.native.clientY);
                }
            }
        }
    });
}

// --- UUS: Kolmanda akna (Perioodi info) dünaamiline arvutus ---
function ArvutaJaKuvaPerioodiInfo(vordlusTyyp) {
    if (laetudKassaAndmed.length === 0) return;

    const koikPaevad = laetudKassaAndmed.length;
    let myugiPaevad = 0;
    let kokkuTooteid = 0;
    let kokkuKassa = 0;
    let esinesHinnamuutusi = false;

    laetudKassaAndmed.forEach(r => {
        let paevaKassa = 0;
        let paevaTooted = 0;
        let paevalOliMyyki = false;

        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit") {
                paevaKassa += kogus * leiaHind(v.nimi, r.kuupaev);
                paevaTooted += kogus;
            } else if (v.tüüp === "number") {
                paevaKassa += kogus;
            }
        });

        if (paevalOliMyyki) myugiPaevad++;
        kokkuTooteid += paevaTooted;
        kokkuKassa += paevaKassa;

        // Kontrollime, kas sellel kuupäeval kattus mõni hind finantsajalooga
        const muutusSellelPaeval = hinnadAjalugu.some(h => h.kehtiv_alates === r.kuupaev);
        if (muutusSellelPaeval) esinesHinnamuutusi = true;
    });

    // Kirjutame tulemused HTML-i elementidesse
    document.getElementById("infoKoikPaevad").innerText = koikPaevad;
    document.getElementById("infoMyugiPaevad").innerText = myugiPaevad;
    document.getElementById("infoTootedKogus").innerText = `${kokkuTooteid} tk`;
    document.getElementById("infoKassaSumma").innerText = `${kokkuKassa.toFixed(2)} €`;
    const tyypTekstid = { kuu: "Kuu baasil", nadal: "Aasta nädalad", vahemik: "Vaba vahemik" };
    document.getElementById("infoVordlusTüüp").innerText = tyypTekstid[vordlusTyyp] || vordlusTyyp;
    // Näitame või peidame Sinu soovitud hinnamuutuste hoiatustuld
    const hoiatusHinnad = document.getElementById("infoHinnaMuutused");
    if (esinesHinnamuutusi) {hoiatusHinnad.style.display = "block";} 
    else {hoiatusHinnad.style.display = "none";}}
    // --- UUS: Sektor 1 (Tootegrupid) uuendamine kogu perioodi kohta ---
    function UuendaGrupiSektoritGlobaalselt() {const gruppideSummad = {};
    laetudKassaAndmed.forEach(r => {seaded.veerud.forEach(v => {
    if (v.tüüp === "toit") {
    const kogus = Number(r[v.nimi]) || 0;
    if (kogus > 0) {
    gruppideSummad[v.pealkiri] = (gruppideSummad[v.pealkiri] || 0) + kogus;
    }
    }
    });
    });
    JoonistaSektorDiagramm(Object.keys(gruppideSummad), Object.values(gruppideSummad), "Kogu perioodi jaotus");
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

    // PARANDATUD RIDA: Lisatud graafiku pealkirjale mallijutt (backticks ``)
    JoonistaSektorDiagramm(sildid, kogused, `Jaotus: ${rida.kuupaev}`);
}

   function JoonistaSektorDiagramm(labels, data, pealkiri) {
   if (grupiSektorGraafik) grupiSektorGraafik.destroy();
   const ctx = document.getElementById("grupiSektorGraafik").getContext("2d");
   grupiSektorGraafik = new Chart(ctx, {
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
       plugins: {legend: { display: false }, // Peidame nimekirja, et mahuks ära paremasse tiiba
       title: { display: true, text: pealkiri, font: { size: 11 } }
        }
       }
   });
   }
// --- Dünaamiliste, lohistatavate sektordiagrammiketaste loomine ---
let popupIdCounter = 0;

function LooLohistatavSektor(kassaAndmeteIndex, clickX, clickY) {
    const rida = laetudKassaAndmed[kassaAndmeteIndex];
    if (!rida) return;

    popupIdCounter++;
    const popupId = `popup-${popupIdCounter}`;
    const canvasId = `canvas-${popupIdCounter}`;

    // Sektori andmete ettevalmistus artiklite lõikes
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

    if (sildid.length === 0) {
        alert(`Kuupäeval ${rida.kuupaev} pole müüdud ühtegi toiduartiklit.`);
        return;
    }

    // Luuakse HTML struktuur lohistatava akna jaoks
    const ala = document.getElementById("graafikuAla");
    const popup = document.createElement("div");
    popup.id = popupId;
    popup.classList.add("draggable-popup");
    
    // Paigutame akna korraks klõpsu asukoha lähedale
    const rect = ala.getBoundingClientRect();
    popup.style.left = `${clickX - rect.left - 50}px`;
    popup.style.top = `${clickY - rect.top - 50}px`;

    popup.innerHTML = `
        <div class="popup-header" id="${popupId}-header">
            <span class="popup-title">🍕 Artiklid: ${rida.kuupaev}</span>
            <button class="popup-close" onclick="document.getElementById('${popupId}').remove()">×</button>
        </div>
        <canvas id="${canvasId}" width="300" height="300"></canvas>
    `;

    ala.appendChild(popup);

    // Joonistatakse sektordiagramm Chart.js abil uude aknasse
    const ctx = document.getElementById(canvasId).getContext("2d");
    new Chart(ctx, {
        type: "pie",
        data: {
            labels: sildid,
            datasets: [{
                data: kogused,
                backgroundColor: [
                    "#3498db", "#2ecc71", "#e74c3c", "#f1c40f", "#9b59b6", "#1abc9c", "#34495e"
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 10 } } }
            }
        }
    });

    // Teeme akna hiirega ekraanil vabalt lohistatavaks (Drag & Drop)
    MuudaAkenLohistatavaks(popup);
}

function MuudaAkenLohistatavaks(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById(`${element.id}-header`);

    if (header) {
        header.onmousedown = dragMouseDown;
    } else {
        element.onmousedown = dragMouseDown;
    }

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

    

