import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

let pohiGraafik = null;
let seaded = null;
let hinnadAjalugu = [];
let laetudKassaAndmed = [];

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
        } else {
            kuuGrupp.style.display = "flex";
            vahemikGrupp.style.display = "none";
        }
    };

    document.getElementById("uuendaPulssBtn").onclick = UuendaPulssi;
    
    // "Eelmine kuu" nupu loogika lennult liikumiseks
    document.getElementById("eelmineKuuBtn").onclick = async () => {
        const kuuSelect = document.getElementById("pulssKuu");
        const praeguneIndex = kuuSelect.selectedIndex;
        if (praeguneIndex < kuuSelect.options.length - 1) {
            kuuSelect.selectedIndex = praeguneIndex + 1;
            ajaTyyp.value = "kuu";
            kuuGrupp.style.display = "flex";
            vahemikGrupp.style.display = "none";
            await UuendaPulssi();
        }
    };
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
    }

    const { data, error } = await query.order("kuupaev", { ascending: true });
    if (error) return console.error(error);
    laetudKassaAndmed = data || [];

    GenerreeriKombineeritudGraafik();
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
                päevaKäive += kogus; // Staatiline number lisandub käibesse otse
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
                // ✅ KLIKILUGU: Kui klikitakse joone mummule või tulbale, loome lohistatava sektordiagrammi!
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    LooLohistatavSektor(idx, e.native.clientX, e.native.clientY);
                }
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
element.style.left = (element.offsetLeft - pos1) + "px";}
function closeDragElement() {document.onmouseup = null;document.onmousemove = null;}}
