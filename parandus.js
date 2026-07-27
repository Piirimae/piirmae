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
// 🔧 PARANDATUD JA TURVALINE PÄRING (asenda .single() -> .limit(1))
async function LaeAndmedArhiivist(arhiiviId) {
    const { data: arhiivList, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .order("versioon", { ascending: false })
        .limit(1); // Mõistlik piirang, mis ei tekita 406 viga

    if (error || !arhiivList || arhiivList.length === 0) {
        return alert("Seda arhiivi ei leitud andmebaasist või on andmed veel salvestamata.");
    }

    const data = arhiivList[0]; // Võtame massiivist esimese rea
    praeguneKuuId = data.kuu_id;
    sisestusTyyp = data.sisestus_tyyp || "veeb_kassa";

    document.getElementById("lehePealkiri").innerText = `🔧 Paranda arhiivi: ${praeguneKuuId}`;
    
    // Pakime andmepaki lahti
    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;
    
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
            const väärtus = vanaReaMassiiv[vIdx] !== undefined ? vanaReaMassiiv[vIdx] : "";
            // Muutsime sündmuse kuulaja lokaalseks, et moodul seda ei blokeeriks
            html += `<td><input type="number" class="inp-artikkel" data-veerg="${v.nimi}" data-idx="${vIdx}" value="${väärtus}"></td>`;
        });

        html += `<td class="rea-summa" style="font-weight:bold; background:#f8f9fa;">0.00 €</td>`;
        html += "</tr>";
    }
    tbody.innerHTML = html;

    // Seome kuulajad otse sisendite külge turvaliselt
    tbody.querySelectorAll(".inp-artikkel").forEach(inp => {
        inp.addEventListener("input", () => {
            ArvutaReaKogusumma(inp.closest(".parandus-rida"));
        });
    });

    // Sunnime korraks kõigi ridade summad käima
    tbody.querySelectorAll(".parandus-rida").forEach(tr => ArvutaReaKogusumma(tr));
}

// Teeme funktsiooni kättesaadavaks nii sees- kui väljaspool
function ArvutaReaKogusumma(tr) {
    const kuupaev = tr.dataset.date;
    let reaKassaSumma = 0;

    tr.querySelectorAll("input").forEach(inp => {
        const kogus = Number(inp.value) || 0;
        const veeruNimi = inp.dataset.veerg;
        const vIdx = Number(inp.dataset.idx);
        const vSeade = seaded.veerud[vIdx];

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
}

// --- 3. SALVESTAMISE KLOONIMISMOOTOR ---
// --- TÄIELIK JA KORRASTATUD KASSATABELI SALVESTAMISE MOOTOR ---
async function SalvestaKoguTabel() {
    if (!praeguneKuuId) return alert("Andmeid pole genereeritud!");
    if (!confirm("Kas soovid andmed salvestada? See teeb muudatused aktiivseks ja loob arhiivi uue seisu.")) return;

    const rows = document.querySelectorAll(".parandus-rida");
    const arhiivRowsMassiiv = [];
    const kassaTabeliRead = [];
    
    const veergudeKogusedKokku = seaded.veerud.map(() => 0);
    const veergudeRahadKokku = seaded.veerud.map(() => 0);
    let terveKuuKogusumma = 0;

    // Tuvastame aktiivse kasutaja ID, et täita user_id väli
    const { data: userData } = await sb.auth.getUser();
    const sisselogitudUserId = userData?.user?.id || null;

    // 1. Käime läbi tabeli read ja kogume andmed kokku ilma "id" veeruta!
    rows.forEach(tr => {
        const kuupaev = tr.dataset.date;
        const veergudeVäärtusedStr = [];
        
        // Ehitame kassaobjekti (MÄRKUS: "id" on siit täielikult välja jäetud, et andmebaas ei protestiks!)
        const kassaObjekt = { 
            kuu_id: praeguneKuuId,
            kuupaev: kuupaev,
            kokku: "0.00", 
            user_id: sisselogitudUserId,
            updated_at: new Date().toISOString()
        };

        let paevaKogusummaRahalises = 0;

        tr.querySelectorAll("input").forEach(inp => {
            const valStr = inp.value === "" ? "" : inp.value;
            const valNum = inp.value === "" ? 0 : Number(inp.value); // Puhta int4 numbri tagamine
            const veeruNimi = inp.dataset.veerg;
            const vIdx = Number(inp.dataset.idx);

            veergudeVäärtusedStr.push(valStr);
            kassaObjekt[veeruNimi] = valNum; 

            const vSeade = seaded.veerud[vIdx];
            if (vSeade) {
                veergudeKogusedKokku[vIdx] += valNum;
                if (vSeade.tüüp === "toit") {
                    const ajaloolineHind = leiaHindAjaloost(veeruNimi, kuupaev);
                    const reaToiduOsa = valNum * ajaloolineHind;
                    paevaKogusummaRahalises += reaToiduOsa;
                    veergudeRahadKokku[vIdx] += reaToiduOsa;
                } else if (vSeade.tüüp === "number") {
                    paevaKogusummaRahalises += valNum;
                    veergudeRahadKokku[vIdx] += valNum;
                }
            }
        });

        terveKuuKogusumma += paevaKogusummaRahalises;
        arhiivRowsMassiiv.push({
            kuupäev: kuupaev,
            veerud: veergudeVäärtusedStr,
            kokku: `${paevaKogusummaRahalises.toFixed(2)} €`
        });

        kassaTabeliRead.push(kassaObjekt);
    });

    // 2. Ehitame JSONb state paki arhiivi jaoks
    const andmepakettState = {
        paise: seaded.veerud.map(v => ({ nimi: v.nimi, pealkiri: v.pealkiri, hind: Number(v.hind) || 0, tüüp: v.tüüp })),
        rows: arhiivRowsMassiiv,
        sumKogus: veergudeKogusedKokku.map(k => String(k)),
        sumHind: veergudeRahadKokku.map(r => `${r.toFixed(2)} €`),
        kuuKokku: `${terveKuuKogusumma.toFixed(2)} €`
    };

       // ==========================================
    // 4. SALVESTAMINE SAMM A: Arhiivi rea loomine versiooniga
    // ==========================================
    let uusVersiooniNumber = 1;
    let sihtArhiiviId = praeguneArhiiviId;

    if (praeguneArhiiviId) {
        const { data: vanaArhiiv } = await sb.from("arhiiv").select("versioon").eq("arhiiviId", praeguneArhiiviId).order("versioon", { ascending: false }).limit(1);
        if (vanaArhiiv && vanaArhiiv.length > 0) {
            uusVersiooniNumber = Number(vanaArhiiv.versioon || 1) + 1;
        }
    } else {
        sihtArhiiviId = `${praeguneKuuId}-kasitsi-${Date.now()}`;
    }

    const { error: arhiivErr } = await sb.from("arhiiv").insert({
        arhiiviId: sihtArhiiviId,
        kuu_id: praeguneKuuId,
        versioon: uusVersiooniNumber,
        state: andmepakettState,
        salvestaja: "piirimaeinge@gmail.com",
        paeritolu: praeguneArhiiviId ? "muudetud" : "kasitsi",
        taastatud: false,
        created_at: new Date().toISOString()
    });

    if (arhiivErr) return alert("Viga arhiivi salvestamisel: " + arhiivErr.message);

    // ==========================================
    // 5. SALVESTAMINE SAMM B: PÕHITABELI (KASSATABEL) PUHASTAMINE JA SISESTAMINE
    // ==========================================
    console.log("PARANDUS: Puhastan duplikaatide vältimiseks selle kuu vanad read kassatabelist...");
    
    // Võtame kuu esimene ja viimane kuupäev massiivist
    const kuupaevadMassiiv = kassaTabeliRead.map(r => r.kuupaev).sort();
    const kuuEsimenePaev = kuupaevadMassiiv[0];
    const kuuViimanePaev = kuupaevadMassiiv[kuupaevadMassiiv.length - 1];

    // Samm B1: Kustutame selle vahemiku read kassatabelist jäädavalt ära [1.1]
    const { error: deleteErr } = await sb
        .from("kassatabel")
        .delete()
        .gte("kuupaev", kuuEsimenePaev)
        .lte("kuupaev", kuuViimanePaev);

    if (deleteErr) {
        console.error("Viga kassatabeli eelneval puhastamisel:", deleteErr);
        return alert("Kassatabeli puhastamine ebaõnnestus: " + deleteErr.message);
    }

    // Samm B2: Kuna plats on puhas, teeme .insert() käsu ilma "id" veergu puutumata [1.1]
    console.log("PARANDUS: Sisestan uued ja värsked kirjed kassatabelisse...");
    const { error: kassaErr } = await sb
        .from("kassatabel")
        .insert(kassaTabeliRead); // 🔧 LAHENDUS: .insert() on vaba 'id' konflikti probleemidest! [1.1]

    if (kassaErr) {
        console.error("Viga kassatabeli kirjutamisel:", kassaErr);
        return alert("Viga kassatabeli uuendamisel: " + kassaErr.message);
    }

    // ==========================================
    // 6. SALVESTAMINE SAMM C: Logime tegevuse logide tabelisse
    // ==========================================
    await sb.from("logid").insert({
        tegevus: praeguneArhiiviId ? "arhiiv_parandus_versioon" : "kasitsi_kuu_loomine",
        detailid: { kuu: praeguneKuuId, arhiiviId: sihtArhiiviId, versioon: uusVersiooniNumber },
        user_email: "piirimaeinge@gmail.com"
    });

    alert(`Andmed edukalt salvestatud! Loodi arhiivi versioon v_${uusVersiooniNumber} ja uuendati põhitabelit.`);
    window.location.href = "arhiiv.html"; 
}
