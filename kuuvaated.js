// kuuvaated.js (MOODUL) - PARANDATUD DÜNAAMILISTE HINDADE TUGEVUS
import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

// Globaalne muutuja hindade ajaloo hoidmiseks
let hinnadAjalugu = [];
let seaded = null;

// --- Abifunktsioon hinna leidmiseks finantsajaloost konkreetse kuupäeva järgi ---
function leiaHinnaAjaloost(tooteNimi, kuupaevStr) {
    const targetTime = new Date(`${kuupaevStr}T00:00:00`).getTime();

    // Otsime ajaloo massiivist rida, mis klapib nimega ja jääb õigesse ajavahemikku
    const leitud = hinnadAjalugu.find(h => {
        if (h.nimi !== tooteNimi) return false;
        
        const alates = new Date(h.kehtiv_alates).getTime();
        const kuni = h.kehtiv_kuni ? new Date(h.kehtiv_kuni).getTime() : Infinity;
        
        return targetTime >= alates && targetTime <= kuni;
    });

    if (leitud) return Number(leitud.hind);
    
    // Kui ajaloost mingil põhjusel ei leidnud, võtame seadete vaikimisi hinna
    const v = seaded.veerud.find(i => i.nimi === tooteNimi);
    return v ? Number(v.hind) || 0 : 0;
}

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Tuvastame kasutaja ja seome väljalogimise
    await kuvaKasutajaNimi();
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    // Tuvastame jooksva kuu (kujul YYYY-MM)
    const jooksevKuup = new Date();
    const jooksevKuu = `${jooksevKuup.getFullYear()}-${String(jooksevKuup.getMonth() + 1).padStart(2, '0')}`;

    const laud = document.getElementById("kuuvaadeTabeliKoht");
    if (!laud) return;

    laud.innerHTML = "<tr><td style='padding:20px;'>Laen kassatabeli viimast salvestatud seisu...</td></tr>";

    // 2. LAEME SEADED JA HINDADE FINANTSAJALOO (UUS!)
    seaded = await laeSeaded();
    const { data: hist } = await sb.from("hinnad").select("*");
    hinnadAjalugu = hist || [];

    // Laeme read kassatabelist
    const { data: andmed, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", jooksevKuu)
        .order("kuupaev", { ascending: true });

    if (error || !andmed || andmed.length === 0) {
        console.error("Viga või andmed puuduvad:", error);
        laud.innerHTML = `
            <div style="padding: 20px; background: #fff5f5; color: #cc0000; border: 1px solid #ffcccc; border-radius: 4px;">
                Hetkel aktiivseid kassatabeli ridu ei leitud või tekkis andmebaasi ühenduse tõrge.
            </div>
        `;
        return;
    }

    // Teeme andmetest kiire otsinguindeksi kuupäeva järgi
    const andmeIndex = {};
    andmed?.forEach(r => {
        const kpv = r.kuupaev && r.kuupaev.includes("T") ? r.kuupaev.split("T")[0] : r.kuupaev;
        andmeIndex[kpv] = r;
    });

    // 3. Arvutame kuu päevade arvu
    const [aasta, kuu] = jooksevKuu.split("-");
    const paevadeArv = new Date(aasta, kuu, 0).getDate();

    // Massiivid jaluse summade jaoks (kogused ja rahalised summad eraldi veerupõhiselt)
    const veergudeKogusummad = seaded.veerud.map(() => 0);
    const veergudeRahalisedSummad = seaded.veerud.map(() => 0);
    let kuuKogusumma = 0;

    // --- HTML TABELI KOOSTAMINE ---
    // Päis (Nüüd on puhas ja ilma fikseeritud hinnata, sest hinnad on dünaamilised!)
    const thead = `
        <tr>
            <th>Kuupäev</th>
            ${seaded.veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
            <th>Kokku</th>
        </tr>
    `;

    // Sisu read
    let tbodyRows = "";
    for (let i = 1; i <= paevadeArv; i++) {
        const kuupaev = `${jooksevKuu}-${String(i).padStart(2, "0")}`;
        const ridaAndmed = andmeIndex[kuupaev] || {};
        
        let reaKokku = 0;
        let veergudeHtml = "";

        seaded.veerud.forEach((v, vIdx) => {
            const väärtus = Number(ridaAndmed[v.nimi]) || 0;
            veergudeKogusummad[vIdx] += väärtus;
            
            if (v.tüüp === "toit") {
                // PARANDATUD: Arvutame rea toidusumma kasutades kuupäevapõhist hinda!
                const paevaHind = leiaHinnaAjaloost(v.nimi, kuupaev);
                const reaToiduSumma = väärtus * paevaHind;
                reaKokku += reaToiduSumma;
                veergudeRahalisedSummad[vIdx] += reaToiduSumma;
            } else {
                reaKokku += väärtus;
                veergudeRahalisedSummad[vIdx] += väärtus;
            }

            veergudeHtml += `<td>${väärtus || "-"}</td>`;
        });

        kuuKogusumma += reaKokku;
        tbodyRows += `
            <tr>
                <td><strong>${kuupaev}</strong></td>
                ${veergudeHtml}
                <td style="font-weight:bold;">${reaKokku.toFixed(2)} €</td>
            </tr>
        `;
    }

    // Jalus (Arvutab summad dünaamiliselt kokku veergude rahaliste summade põhjalt)
    const tfoot = `
        <tr>
            <td><strong>Kogus kokku</strong></td>
            ${veergudeKogusummad.map(s => `<td style="font-weight:bold;">${s}</td>`).join("")}
            <td></td>
        </tr>
        <tr>
            <td><strong>Käive kokku</strong></td>
            ${seaded.veerud.map((v, vIdx) => {
                const sRahaline = veergudeRahalisedSummad[vIdx];
                return `<td style="font-weight:bold; color:#2c3e50;">${sRahaline.toFixed(2)} €</td>`;
            }).join("")}
            <td style="font-weight:bold; background:#f1c40f; color:#000; padding:8px;">${kuuKogusumma.toFixed(2)} €</td>
        </tr>
    `;

    // Joonistame tulemuse ekraanile
    laud.innerHTML = `
        <table class="tabel" style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead>${thead}</thead>
            <tbody>${tbodyRows}</tbody>
            <tfoot>${tfoot}</tfoot>
        </table>
    `;
});



