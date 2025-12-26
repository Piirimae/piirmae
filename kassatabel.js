// =========================
//  KASSATABEL.JS — AKTIIVNE KUU
// =========================

// DOM elemendid
const kuuValik = document.getElementById("kuuValik");
const lukustaNupp = document.getElementById("lukustaNupp");
const salvestaNupp = document.getElementById("salvestaNupp");
const arhiiviNupp = document.getElementById("arhiiviNupp");
const prindiNupp = document.getElementById("prindiNupp");
const laeAllaNupp = document.getElementById("laeAllaNupp");
const vaateReziim = document.getElementById("vaateReziim");

let tabelLukus = true;
let praeguneKuu = null;
let reaalneKuu = null;
let roll = null;

// =========================
//  ROLLIKONTROLL
// =========================

async function kontrolliLigipaasu() {
    const { data } = await sb.auth.getUser();
    const user = data?.user;

    if (!user) {
        window.location = "index.html";
        return;
    }

    // Laeme rolli kasutajad tabelist
    await kuvaKasutajaNimi();
    roll = window.userRole;

    // Ainult admin, sisestaja ja superadmin
    if (roll !== "admin" && roll !== "sisestaja" && roll !== "superadmin") {
        window.location = "fuajee.html";
        return;
    }
}

// =========================
//  SUPABASE PÄRINGUD
// =========================

async function laeKuuAndmedSupabasest(kuuId) {
    const { data, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("kuupaev", { ascending: true });

    return error ? [] : data;
}

async function salvestaSupabasse(rida) {
    await sb.from("kassatabel").upsert(rida, { onConflict: "kuu_id,kuupaev" });
}

async function arhiiviSupabasse(kuuId, stateJson) {
    await sb.from("arhiiv").insert({ kuu_id: kuuId, state: stateJson });
}

async function logiTegevusSupabasse(tegevus, detailid = {}) {
    const { data } = await sb.auth.getUser();
    const email = data?.user?.email || null;

    await sb.from("logid").insert({
        tegevus,
        detailid,
        user_email: email
    });
}

// =========================
//  LUKUSTUS
// =========================

function toggleLukustus() {
    tabelLukus = !tabelLukus;
    rakendaLukustusOlek(tabelLukus);
    näitaTeadet(tabelLukus ? "Tabel lukustatud." : "Tabel avatud.");
}

// =========================
//  SALVESTAMINE
// =========================

async function salvestaAktiivneKuu() {
    if (tabelLukus) return alert("Tabel on lukus!");

    const kuuId = kuuValik.value;
    const rows = tbody.querySelectorAll("tr");

    for (let row of rows) {
        const kuupaev = row.dataset.date;
        const inputs = row.querySelectorAll("input");

        const rida = { kuu_id: kuuId, kuupaev };

        inputs.forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            const tüüp = inp.dataset.veeruTüüp;

            if (!nimi) return;

            if (tüüp === "toit" || tüüp === "number") {
                rida[nimi] = Number(inp.value) || 0;
            } else {
                rida[nimi] = inp.value || "";
            }
        });

        await salvestaSupabasse(rida);
    }

    await logiTegevusSupabasse("salvestus", { kuu: kuuId });

    tabelLukus = true;
    rakendaLukustusOlek(true);
    näitaTeadet("Salvestatud ja lukustatud.");
}

// =========================
//  ARHIIV
// =========================

async function salvestaArhiivi() {
    if (tabelLukus) return alert("Tabel on lukus!");

    const kuuId = kuuValik.value;

    const state = {
        kuu: kuuId,
        veerud: seaded.veerud,
        rows: [],
        kuuKokku: document.getElementById("kuuKokku").textContent
    };

    tbody.querySelectorAll("tr").forEach(row => {
        const inputs = row.querySelectorAll("input");
        const rida = { kuupaev: row.dataset.date };

        inputs.forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            const tüüp = inp.dataset.veeruTüüp;

            if (!nimi) return;

            if (tüüp === "toit" || tüüp === "number") {
                rida[nimi] = Number(inp.value) || 0;
            } else {
                rida[nimi] = inp.value || "";
            }
        });

        state.rows.push(rida);
    });

    await arhiiviSupabasse(kuuId, JSON.stringify(state));
    await logiTegevusSupabasse("arhiiv", { kuu: kuuId });

    tabelLukus = true;
    rakendaLukustusOlek(true);
    näitaTeadet("Arhiivi salvestatud.");
}

// =========================
//  KUU VAHETUS
// =========================

async function vahetaKuud() {
    praeguneKuu = kuuValik.value;

    await genereeriKuuTabel();

    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);

    uuendaVaateReziim();

    tabelLukus = false;
    rakendaLukustusOlek(false);

    await logiTegevusSupabasse("kuu_vahetus", { kuu: praeguneKuu });
}

// =========================
//  INIT
// =========================

async function initKassatabel() {
    await kontrolliLigipaasu();

    reaalneKuu = kuuValik.value;
    praeguneKuu = kuuValik.value;

    await genereeriKuuTabel();

    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);

    uuendaVaateReziim();
    rakendaLukustusOlek(true);
}

// =========================
//  NUPUD
// =========================

lukustaNupp.onclick = toggleLukustus;
salvestaNupp.onclick = salvestaAktiivneKuu;
arhiiviNupp.onclick = salvestaArhiivi;
prindiNupp.onclick = () => window.print();
laeAllaNupp.onclick = () => näitaTeadet("Allalaadimine (tulevikus PDF).");
kuuValik.onchange = vahetaKuud;

// Käivita
initKassatabel();

