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

// =========================
//  INIT
// =========================

async function initKassatabel() {
    await kuvaKasutajaNimi();

    seaded = await laeSeaded();

    await laeKuuValikud();

if (onParandusRez) {
    praeguneKuu = parandaKuu;
    kuuValik.value = parandaKuu;
    kuuValik.disabled = true;
} else {
    praeguneKuu = kuuValik.value;
}


    await genereeriKuuTabel();
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);

    rakendaLukustusOlek(true);
}


// =========================
//  KUU VALIKUD
// =========================

async function laeKuuValikud() {
    const { data } = await sb.from("kassatabel").select("kuu_id").order("kuu_id");

    const kuud = [...new Set(data.map(r => r.kuu_id))];

    kuuValik.innerHTML = kuud
        .map(k => `<option value="${k}">${k}</option>`)
        .join("");

    kuuValik.onchange = vahetaKuud;
}

// =========================
//  KUU VAHETUS
// =========================

async function vahetaKuud() {
    praeguneKuu = kuuValik.value;

    await genereeriKuuTabel();
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);

    tabelLukus = false;
    rakendaLukustusOlek(false);
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

    head.innerHTML = `
        <tr>
            <th>Kuupäev</th>
            ${seaded.veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
        </tr>
    `;

    tbody.innerHTML = "";

    for (let i = 1; i <= 31; i++) {
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

    foot.innerHTML = `<tr><td colspan="${seaded.veerud.length + 1}" id="kuuKokku"></td></tr>`;
}

// =========================
//  TABELI TÄITMINE
// =========================

function täidaTabelSupabaseAndmetega(andmed) {
    andmed.forEach(r => {
        const tr = tbody.querySelector(`tr[data-date="${r.kuupaev}"]`);
        if (!tr) return;

        const inputs = tr.querySelectorAll("input");
        inputs.forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            if (r[nimi] !== undefined) inp.value = r[nimi];
        });
    });
}
if (onParandusRez) {
    vaateReziim.textContent = `Režiim: arhiivist parandamine (${parandaKuu})`;
    tabelLukus = false;
    rakendaLukustusOlek(false);
}

// =========================
//  LUKUSTUS
// =========================

function rakendaLukustusOlek(lukus) {
    tbody.querySelectorAll("input").forEach(inp => {
        inp.disabled = lukus;
    });

    lukustaNupp.textContent = lukus
        ? "Tabel lukus (ava sisestamiseks)"
        : "Tabel avatud (lukusta)";
}

// =========================
//  NUPUD
// =========================

lukustaNupp.onclick = () => {
    tabelLukus = !tabelLukus;
    rakendaLukustusOlek(tabelLukus);
};

if (onParandusRez) {
    // Peida tavalised salvestusnupud
    salvestaNupp.style.display = "none";
    arhiiviNupp.style.display = "none";

    // Lisa parandusnupp
    const salvestaParandusBtn = document.createElement("button");
    salvestaParandusBtn.textContent = "Salvesta arhiivi (parandus)";
    salvestaParandusBtn.id = "salvestaParandus";
    salvestaParandusBtn.onclick = salvestaParandatudArhiiv;

    arhiiviNupp.parentNode.appendChild(salvestaParandusBtn);

    // Prindinupp peab jääma
    prindiNupp.onclick = () => window.print();
    laeAllaNupp.onclick = () => alert("PDF tuleb tulevikus");}

 else {
    // Tavaline režiim
    salvestaNupp.onclick = () => alert("Salvestamine tuleb järgmises etapis");
    arhiiviNupp.onclick = () => alert("Arhiiv tuleb järgmises etapis");
    prindiNupp.onclick = () => window.print();
    laeAllaNupp.onclick = () => alert("PDF tuleb tulevikus");
}


// Käivita
initKassatabel();

window.addEventListener("beforeprint", () => {
    const kuu = document.getElementById("kuuValik")?.selectedOptions[0]?.dataset?.kuu || "";
    const leht = window.location.href.includes("arhiiv") ? "Arhiiv" : "Kassatabel";
    document.getElementById("printTitle").textContent = `${kuu} – ${leht}`;
});
// --- INPUTIDE ASENDAMINE PRINTIMISE AJAL ---
window.addEventListener("beforeprint", () => {
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

async function salvestaParandatudArhiiv() {
    // Koosta state (kasutan sinu olemasolevat loogikat)
    const state = koostaState(); // kui nimi on teine, ütle mulle ja ma kohandan

    // Lae vana arhiivi kirje
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

    // Ülekirjutamine
    const { error } = await sb
        .from("arhiiv")
        .update({
            arhiiviId: new Date().toISOString(),
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

    alert("Arhiiv salvestatud.");
    window.location = "arhiiv.html";
}








