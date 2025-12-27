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
    praeguneKuu = kuuValik.value;

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

salvestaNupp.onclick = () => alert("Salvestamine tuleb järgmises etapis");
arhiiviNupp.onclick = () => alert("Arhiiv tuleb järgmises etapis");
prindiNupp.onclick = () => window.print();
laeAllaNupp.onclick = () => alert("PDF tuleb tulevikus");

// Käivita
initKassatabel();




