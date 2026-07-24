import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll } from "./auth.js";

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
let seaded = null;

// Mock seadete laadimine (asenda enda reaalse loogikaga, kui see on teises failis)
async function laeSeaded() {
    return {
        veerud: [
            { nimi: "sissetulek", pealkiri: "Sissetulek", tüüp: "number" },
            { nimi: "valjaminek", pealkiri: "Väljaminek", tüüp: "number" },
            { nimi: "markused", pealkiri: "Märkused", tüüp: "text" }
        ]
    };
}

//  INIT
// =========================
async function initKassatabel() {
    await kuvaKasutajaNimi();

    seaded = await laeSeaded();
    await laeKuuValikud();

    if (onParandusRez) {
        praeguneKuu = parandaKuu;
        if (kuuValik) {
            kuuValik.value = parandaKuu;
            kuuValik.disabled = true;
        }
    } else {
        praeguneKuu = kuuValik ? kuuValik.value : "";
    }

    // Genereerime tabeli kesta
    await genereeriKuuTabel();
    
    // Laeme andmed Supabasest
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    console.log("Supabasest laetud kassatabeli andmed:", andmed); // ÕIGES KOHAS LOGI
    
    // Täidame tabeli sisuga
    täidaTabelSupabaseAndmetega(andmed);

    // ✅ PARANDATUD: Nupud ja režiimid seadistatakse ENNE rolli lõplikku lukustust
    seadistaNupudJaLukustus();

    // LUGEGE ROLLI JA RAKENDAGE LUKUSTUS VASTAVALT SELLELE
    const roll = window.userRole || "vaatleja";
    console.log("Kassatabel kontrollib rolli õiguseid:", roll);

    if (roll === "superadmin" || roll === "admin" || roll === "sisestaja") {
        tabelLukus = false;
        rakendaLukustusOlek(false); 
    } else {
        tabelLukus = true;
        rakendaLukustusOlek(true); 
    }
}

// =========================
//  NUPPUDE JA LUKUSTUSE SEADISTAMINE
// =========================
function seadistaNupudJaLukustus() {
    if (onParandusRez) {
        if (vaateReziim) vaateReziim.textContent = `Režiim: arhiivist parandamine (${parandaKuu})`;
        
        // Tavalisest režiimist lukust lahti
        tabelLukus = false;
        rakendaLukustusOlek(false);

        // Peida tavalised salvestusnupud
        if (salvestaNupp) salvestaNupp.style.display = "none";
        if (arhiiviNupp) arhiiviNupp.style.display = "none";

        // Kontrolli, et nuppu ei loodaks mitu korda
        if (!document.getElementById("salvestaParandus") && arhiiviNupp) {
            const salvestaParandusBtn = document.createElement("button");
            salvestaParandusBtn.textContent = "Salvesta arhiivi (parandus)";
            salvestaParandusBtn.id = "salvestaParandus";
            salvestaParandusBtn.onclick = salvestaParandatudArhiiv;
            arhiiviNupp.parentNode.appendChild(salvestaParandusBtn);
        }
    } else {
        // Tavaline režiim
        if (salvestaNupp) salvestaNupp.onclick = () => alert("Salvestamine tuleb järgmises etapis");
        if (arhiiviNupp) arhiiviNupp.onclick = () => alert("Arhiiv tuleb järgmises etapis");
    }

    // Ühised nupud
    if (lukustaNupp) {
        lukustaNupp.onclick = () => {
            tabelLukus = !tabelLukus;
            rakendaLukustusOlek(tabelLukus);
        };
    }
    if (prindiNupp) prindiNupp.onclick = () => window.print();
    if (laeAllaNupp) laeAllaNupp.onclick = () => alert("PDF tuleb tulevikus");
}

// =========================
//  KUU VALIKUD
// =========================
async function laeKuuValikud() {
    const { data } = await sb.from("kassatabel").select("kuu_id").order("kuu_id");
    if (!data) return;

    const kuud = [...new Set(data.map(r => r.kuu_id))];
    kuuValik.innerHTML = kuud
        .map(k => `<option value="${k}">${k}</option>`)
        .join("");

    kuuValik.onchange = vahetaKuud;
}

async function vahetaKuud() {
    praeguneKuu = kuuValik.value;
    await genereeriKuuTabel();
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);

    // Pärast kuu vahetust määrame lukustuse uuesti vastavalt rollile
    const roll = window.userRole || "vaatleja";
    const onLubatudRoll = (roll === "superadmin" || roll === "admin" || roll === "sisestaja");
    tabelLukus = !onLubatudRoll;
    rakendaLukustusOlek(tabelLukus);
}

// =========================
//  SUPABASE PÄRINGUD
// =========================
async function laeKuuAndmedSupabasest(kuuId) {
    const { data } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("kuupaev");

    return data || [];
}

// =========================
//  TABELI GENEREERIMINE
// =========================
async function genereeriKuuTabel() {
    const head = document.getElementById("tabelHead");
    const foot = document.getElementById("tabelFoot");

    if (head) {
        head.innerHTML = `
            <tr>
                <th>Kuupäev</th>
                ${seaded.veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
            </tr>
        `;
    }

    tbody.innerHTML = "";

    const [aasta, kuu] = praeguneKuu.split("-");
    const paevadeArv = new Date(aasta, kuu, 0).getDate();

    for (let i = 1; i <= paevadeArv; i++) {
        const kuupaev = `${praeguneKuu}-${String(i).padStart(2, "0")}`;
        const tr = document.createElement("tr");
        tr.dataset.date = kuupaev;

        tr.innerHTML = `
            <td>${kuupaev}</td>
            ${seaded.veerud
                .map(v => `<td><input data-veeru-nimi="${v.nimi}" data-veeru-tüüp="${v.tüüp}" /></td>`)
                .join("")}
        `;
        tbody.appendChild(tr);
    }

    if (foot) foot.innerHTML = `<tr><td colspan="${seaded.veerud.length + 1}" id="kuuKokku"></td></tr>`;
}

// =========================
//  TABELI TÄITMINE
// =========================
function täidaTabelSupabaseAndmetega(andmed) {
    if (!andmed || andmed.length === 0) {
        console.warn("Tabeli täitmiseks puuduvad andmed või massiiv on tühi.");
        return;
    }

    andmed.forEach(r => {
        // Kontrollime andmebaasi kuupäeva. Kui see on täispikk "2026-07-01T00:00:00", võtame ainult esimesed 10 sümbolit.
        const puhasKuupaev = r.kuupaev && r.kuupaev.includes("T") 
            ? r.kuupaev.split("T")[0] 
            : r.kuupaev;

        // Otsime rida puhastatud kuupäeva järgi
        const tr = tbody.querySelector(`tr[data-date="${puhasKuupaev}"]`);
        
        if (!tr) {
            console.warn(`Tabelist ei leitud rida kuupäevaga: ${puhasKuupaev} (Andmebaasi algne väärtus: ${r.kuupaev})`);
            return;
        }

        const inputs = tr.querySelectorAll("input");
        inputs.forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            if (r[nimi] !== undefined && r[nimi] !== null) {
                inp.value = r[nimi];
            }
        });
    });
}


function rakendaLukustusOlek(lukus) {
    tbody.querySelectorAll("input").forEach(inp => {
        inp.disabled = lukus;
    });

    if (lukustaNupp) {
        lukustaNupp.textContent = lukus
            ? "Tabel lukus (ava sisestamiseks)"
            : "Tabel avatud (lukusta)";
    }
}

// =========================
//  STATE KOOSTAMINE (UUS)
// =========================
function koostaState() {
    const state = {};
    tbody.querySelectorAll("tr").forEach(tr => {
        const kpv = tr.dataset.date;
        state[kpv] = {};
        tr.querySelectorAll("input").forEach(inp => {
            state[kpv][inp.dataset.veeruNimi] = inp.value;
        });
    });
    return state;
}

// =========================
//  SALVESTA PARANDUS
// =========================
async function salvestaParandatudArhiiv() {
    const state = koostaState();

    const { data: vana, error: viga } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", parandaArhiiviId)
        .single();

    if (viga || !vana) {
        alert("Vana arhiivi kirjet ei leitud.");
        return;
    }

    const uusVersioon = (vana.versioon || 1) + 1;

    const { error } = await sb
        .from("arhiiv")
        .update({
            versioon: uusVersioon,
            paeritolu: "muudetud",
            state: JSON.stringify(state),
            salvestaja: window.userName || "tundmatu"
        })
        .eq("arhiiviId", parandaArhiiviId);

    if (error) {
        console.error(error);
        alert("Arhiivi salvestamine ebaõnnestus.");
        return;
    }

    alert("Arhiiv edukalt parandatud ja salvestatud.");
    window.location = "arhiiv.html";
}

// =========================
//  PRINTIMISE KÄSITLEMINE
// =========================
window.addEventListener("beforeprint", () => {
    const kuu = kuuValik?.value || "";
    const leht = window.location.href.includes("arhiiv") ? "Arhiiv" : "Kassatabel";
    const printTitle = document.getElementById("printTitle");
    if (printTitle) printTitle.textContent = `${kuu} – ${leht}`;

    // Asendame input sisendid ajutiselt span tekstiga, et jooned ja ääred ei prindituks
    document.querySelectorAll("td input").forEach(inp => {
        const span = document.createElement("span");
        span.textContent = inp.value;
        span.classList.add("print-value");
        inp.dataset.wasVisible = "true";
        inp.style.display = "none";
        inp.parentNode.appendChild(span);
    });
});

window.addEventListener("afterprint", () => {
    document.querySelectorAll(".print-value").forEach(span => span.remove());
    document.querySelectorAll("td input").forEach(inp => {
        if (inp.dataset.wasVisible === "true") {
            inp.style.display = "";
        }
    });
});

// Käivita rakendus
initKassatabel();









