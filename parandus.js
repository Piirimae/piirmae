import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

let seaded = null;
let hinnadAjalugu = [];
let praeguneKuuId = null;
let praeguneArhiiviId = null;
let sisestusTyyp = "veeb_kassa"; // Vaikimisi, muudetakse "kasitsi" peale kui luuakse käsitsi

const urlParams = new URLSearchParams(window.location.search);
const paramArhiiviId = urlParams.get("arhiiviId");

window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    document.getElementById("logoutBtn").onclick = logout;
    
    seaded = await laeSeaded();
    const { data: hist } = await sb.from("hinnad").select("*");
    hinnadAjalugu = hist || [];

    document.getElementById("btnLooKuu").onclick = AlgataUusKuuKasitsi;
    document.getElementById("btnSalvestaParandus").onclick = SalvestaKoguTabel;

    if (paramArhiiviId) {
        // REŽIIM 1: Parandame olemasolevat arhiivi
        praeguneArhiiviId = paramArhiiviId;
        await LaeAndmedArhiivist(paramArhiiviId);
    } else {
        // REŽIIM 2: Puhas leht, ootab uue kuu loomist
        document.getElementById("reziimiTeade").style.display = "block";
        document.getElementById("reziimiTeade").innerText = "💡 Süsteem ootab puuduva kuu valikut. Sisesta jooksev või ajalooline kuu ja vajuta 'Loo kuu tabel'.";
    }
});

// --- Abifunktsioon: Otsib täpse hinna, mis kehtis SEL kuupäeval ---
function leiaHindAjaloost(tooteNimi, kuupaevStr) {
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

// --- REŽIIM 2: Puuduva kuu genereerimine lennult ---
function AlgataUusKuuKasitsi() {
    const kuuSisend = document.getElementById("uusKuuSisend").value;
    if (!kuuSisend) return alert("Palun vali esmalt kuu!");

    praeguneKuuId = kuuSisend;
    praeguneArhiiviId = null; // Uus sisestus, pole vana ID-d
    sisestusTyyp = "kasitsi"; // 🌟 MÄRGE: Sisestatud käsitsi tagantjärele

    document.getElementById("lehePealkiri").innerText = `✨ Puuduva kuu sisestamine: ${praeguneKuuId}`;
    document.getElementById("reziimiTeade").style.display = "block";
    document.getElementById("reziimiTeade").innerHTML = `⚠️ <strong>KÄSITSI SISESTUS:</strong> See tabel salvestatakse märkega 'Käsitsi sisestatud'. Arvutused tehakse <strong>${praeguneKuuId}</strong> ajaloo hindadega.`;

    EhitaTabeliStruktuur();
    GenereeriKuuPaevadTabelisse(praeguneKuuId, {});
}

// --- REŽIIM 1: Arhiivi laadimine parandamiseks ---
async function LaeAndmedArhiivist(arhiiviId) {
    const { data, error } = await sb.from("arhiiv").select("*").eq("arhiiviId", arhiiviId).order("versioon", { ascending: false }).limit(1).single();
    if (error || !data) return alert("Arhiivi andmete laadimine ebaõnnestus.");

    praeguneKuuId = data.kuu_id;
    sisestusTyyp = data.sisestus_tyyp || "veeb_kassa";

    document.getElementById("lehePealkiri").innerText = `🔧 Paranda arhiivi: ${praeguneKuuId} (Id: ${arhiiviId})`;
    document.getElementById("reziimiTeade").style.display = "block";
    document.getElementById("reziimiTeade").innerHTML = `🔧 <strong>PARANDUSREŽIIM:</strong> Muudad arhiivi viimast seisu. Salvestamisel luuakse sellest uus versioon (v_${Number(data.versioon || 1) + 1}).`;

    // Pakime andmepaki lahti
    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;
    
    // Teeme kuupäevapõhise otsinguindeksi
    const andmeIndex = {};
    state.rows?.forEach(r => {
        andmeIndex[r.kuupäev] = r.veerud;
    });

    EhitaTabeliStruktuur();
    GenereeriKuuPaevadTabelisse(praeguneKuuId, andmeIndex);
}

// --- TABELI EHITAMISE VISUAALNE MOOTOR ---
function EhitaTabeliStruktuur() {
    const head = document.getElementById("parandusHead");
    let html = "<tr><th>Kuupäev</th>";
    seaded.veerud.forEach(v => {
        html += `<th>${v.pealkiri}</th>`;
    });
    html += "<th>KOKKU (€)</th></tr>";
    head.innerHTML = html;
}

function GenereeriKuuPaevadTabelisse(kuuId, laetudAndmedIndex) {
    const tbody = document.getElementById("parandusBody");
    const [aasta, kuu] = kuuId.split("-");
    const paevadeArv = new Date(aasta, kuu, 0).getDate();

    let html = "";
    for (let i = 1; i <= paevadeArv; i++) {
        const kuupaevStr = `${kuuId}-${String(i).padStart(2, "0")}`;
        const vanaReaMassiiv = laetudAndmedIndex[kuupaevStr] || [];

        html += `<tr class="parandus-rida" data-date="${kuupaevStr}">`;
        html += `<td><strong>${kuupaevStr}</strong></td>`;

        seaded.veerud.forEach((v, vIdx) => {
            // Võtame kas arhiivist laetud väärtuse või vaikimisi tühja (null)
            const väärtus = vanaReaMassiiv[vIdx] !== undefined ? vanaReaMassiiv[vIdx] : "";
            html += `<td><input type="number" class="inp-artikkel" data-veerg="${v.nimi}" data-idx="${vIdx}" value="${väärtus}" oninput="ArvutaReaKogusumma(this.parentNode.parentNode)"></td>`;
        });

        html += `<td class="rea-summa" style="font-weight:bold; background:#f8f9fa;">0.00 €</td>`;
        html += "</tr>";
    }
    tbody.innerHTML = html;

    // Sunnime korraks kõigi ridade summad käima
    document.querySelectorAll(".parandus-rida").forEach(tr => ArvutaReaKogusumma(tr));
}

// --- REAALAAJAS SUMMADE ARVUTAMINE PERIOODI HINDADEGA ---
window.ArvutaReaKogusumma = function(tr) {
    const kuupaev = tr.dataset.date;
    let reaKassaSumma = 0;

    tr.querySelectorAll("input").forEach(inp => {
        const kogus = Number(inp.value) || 0;
        const veeruNimi = inp.dataset.veerg;
        const vSeade = seaded.veerud.find(v => v.nimi === veeruNimi);

        if (vSeade) {
            if (vSeade.tüüp === "toit") {
                const ajaloolineHind = leiaHindAjaloost(veeruNimi, kuupaev);
                reaKassaSumma += kogus * ajaloolineHind;
            } else if (vSeade.tüüp === "number") {
                reaKassaSumma += kogus;
            }
        }
    });

    tr.querySelector(".rea-summa").innerText = `${reaKassaSumma.toFixed(2)} €`;
    UuendaKoguTabeliKokkuvõte();
};

function UuendaKoguTabeliKokkuvõte() {
    // Siin saab teha soovi korral jaluse veergude kokkuvõtteid
}

// --- 3. TÄIELIK SALVESTAMISE KLOONIMISMOOTOR (VERSIDONIMINE + KASSATABELI UPSERT) [1.1] ---
async function SalvestaKoguTabel() {
    if (!praeguneKuuId) return alert("Andmeid pole genereeritud!");

    if (!confirm("Kas soovid andmed salvestada? See teeb muudatused aktiivseks ja loob arhiivi uue seisu.")) return;

    const rows = document.querySelectorAll(".parandus-rida");
    const arhiivRowsMassiiv = [];
    const kassaTabeliRead = [];

    rows.forEach(tr => {
        const kuupaev = tr.dataset.date;
        const veergudeVäärtused = [];
        const kassaObjekt = { kuupaev: kuupaev, kuu_id: praeguneKuuId };

        tr.querySelectorAll("input").forEach(inp => {
            const val = inp.value === "" ? null : Number(inp.value);
            veergudeVäärtused.push(val);
            kassaObjekt[inp.dataset.veerg] = val;
        });

        arhiivRowsMassiiv.push({
            kuupäev: kuupaev,
            veerud: veergudeVäärtused
        });

        kassaTabeliRead.push(kassaObjekt);
    });

    const andmepakettState = { rows: arhiivRowsMassiiv };

    // SAMM A: Tuvastame versiooni arhiivis [1.1]
    let uusVersiooniNumber = 1;
    let sihtArhiiviId = praeguneArhiiviId;

    if (praeguneArhiiviId) {
        // Küsime mis oli selle ID eelmine suurim versioon
        const { data: vanaArhiiv } = await sb.from("arhiiv").select("versioon").eq("arhiiviId", praeguneArhiiviId).order("versioon", { ascending: false }).limit(1);
        if (vanaArhiiv && vanaArhiiv.length > 0) {
            uusVersiooniNumber = Number(vanaArhiiv[0].versioon || 1) + 1;
        }
    } else {
        // Luuakse uus kuu käsitsi -> genereerime talle uue unikaalse arhiiviId
        sihtArhiiviId = `${praeguneKuuId}-kasitsi-${Date.now()}`;
    }

    // SAMM B: Kirjutame uue versiooni rea otse arhiivi tabelisse [1.1]
    const { error: arhiivErr } = await sb.from("arhiiv").insert({
        arhiiviId: sihtArhiiviId,
        kuu_id: praeguneKuuId,
        versioon: uusVersiooniNumber,
        state: andmepakettState,
        sisestus_tyyp: sisestusTyyp,
        loodud_by: "piirimaeinge@gmail.com"
    });

    if (arhiivErr) return alert("Viga arhiivi loomisel: " + arhiivErr.message);

    // SAMM C: Teeme UPSERT-i põhitabelisse (kassatabel), et kõik lehed näeksid andmeid [1.1]
    const { error: kassaErr } = await sb.from("kassatabel").upsert(kassaTabeliRead, { onConflict: "kuupaev" });
    if (kassaErr) return alert("Viga kassatabeli uuendamisel: " + kassaErr.message);

    // SAMM D: Logime tegevuse ametlikult logide tabelisse [1.1]
    await sb.from("logid").insert({
        tegevus: praeguneArhiiviId ? "arhiiv_parandus_versioon" : "kasitsi_kuu_loomine",
        andmed: { kuu: praeguneKuuId, arhiiviId: sihtArhiiviId, versioon: uusVersiooniNumber },
        kasutaja: "piirimaeinge@gmail.com"
    });

    alert(`Andmed edukalt salvestatud! Loodi arhiivi versioon v_${uusVersiooniNumber} ja uuendati põhitabelit.`);
    window.location.href = "arhiiv.html"; // Viime kasutaja tagasi arhiivi lehele
}
