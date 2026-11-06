import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

// DOM elemendid
const kuuValik = document.getElementById("kuuValik");
const lukustaNupp = document.getElementById("lukustaNupp");
const salvestaNupp = document.getElementById("salvestaNupp");
const arhiiviNupp = document.getElementById("arhiiviNupp");
const prindiNupp = document.getElementById("prindiNupp");
const laeAllaNupp = document.getElementById("laeAllaNupp");
const tbody = document.getElementById("tbody");

// --- Režiimi tuvastamine ---
const url = new URL(window.location.href);
const parandaKuu = url.searchParams.get("paranda");
const parandaArhiiviId = url.searchParams.get("arhiiviId");
const onParandusRez = Boolean(parandaKuu && parandaArhiiviId);

let tabelLukus = true;
let praeguneKuu = null;

// Kassatabeli laadimine. Kuu lõpu arhiveerimine toimub Supabase'i Cronis,
// mitte brauseris. Siin laetakse ainult aktiivse kuu andmed.
export async function laeAndmedJaLukustus() {
    console.log("KASSATABEL: Alustan andmete laadimist Supabasest...");
    await kuvaKasutajaNimi();

    praeguneKuu = onParandusRez ? parandaKuu : (kuuValik ? kuuValik.value : "");
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);
    seadistaNupudJaLukustus();

    const roll = window.userRole || "vaatleja";
    const lukus = !["superadmin", "admin", "sisestaja"].includes(roll);
    tabelLukus = lukus;
    rakendaLukustusOlek(lukus);

    setTimeout(() => {
        const esimeneInput = tbody?.querySelector("input");
        if (esimeneInput) esimeneInput.dispatchEvent(new Event("input", { bubbles: true }));
    }, 50);
}

function täidaTabelSupabaseAndmetega(andmed) {
    if (!andmed || !tbody) return;
    andmed.forEach(rida => {
        const puhasKuupaev = rida.kuupaev?.includes("T") ? rida.kuupaev.split("T")[0] : rida.kuupaev;
        const tr = tbody.querySelector(`tr[data-date="${puhasKuupaev}"]`);
        if (!tr) return;
        tr.querySelectorAll("input").forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            if (nimi && rida[nimi] !== undefined && rida[nimi] !== null) inp.value = rida[nimi];
        });
    });
}

async function laeKuuAndmedSupabasest(kuuId) {
    const { data, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("kuupaev", { ascending: true });
    if (error) console.error("Viga andmete laadimisel:", error);
    return data || [];
}

function rakendaLukustusOlek(lukus) {
    tbody?.querySelectorAll("input").forEach(inp => { inp.disabled = lukus; });
    if (lukustaNupp) lukustaNupp.textContent = lukus ? "Tabel lukus (ava sisestamiseks)" : "Tabel avatud (lukusta)";
}

function seadistaNupudJaLukustus() {
    // Kassatabeli tegelik salvestus ja arhiivimine on logic.js-i vastutusalas.
    // Siin ei kirjutata nupule uusi käsitlejaid, et moodulid ei võistleks.
    if (lukustaNupp) {
        lukustaNupp.onclick = () => {
            tabelLukus = !tabelLukus;
            rakendaLukustusOlek(tabelLukus);
        };
    }
    if (prindiNupp) prindiNupp.onclick = () => window.print();
    if (laeAllaNupp) laeAllaNupp.onclick = () => alert("PDF raporti allalaadimine on arenduses.");
}
