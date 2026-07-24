// kuuvaated.js (MOODUL)
import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

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

    // 2. Laeme dünaamilised veerud seadetest ja read kassatabelist
    const seaded = await laeSeaded();
    const { data: andmed, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", jooksevKuu)
        .order("kuupaev", { ascending: true });

    if (error) {
        console.error("Viga andmete laadimisel:", error);
        laud.innerHTML = "<tr><td style='color:red; padding:20px;'>Viga andmete laadimisel andmebaasist.</td></tr>";
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

    // Massiivid jaluse summade jaoks
    const veergudeSummad = seaded.veerud.map(() => 0);
    let kuuKogusumma = 0;

    // --- HTML TABELI KOOSTAMINE ---
    // Päis
    const thead = `
        <tr>
            <th>Kuupäev</th>
            ${seaded.veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
            <th>Kokku</th>
        </tr>
    `;

    // Sisu read (Kõik väärtused kuvatakse puhta tekstina td sees, ei mingeid sisendvälju!)
    let tbodyRows = "";
    for (let i = 1; i <= paevadeArv; i++) {
        const kuupaev = `${jooksevKuu}-${String(i).padStart(2, "0")}`;
        const ridaAndmed = andmeIndex[kuupaev] || {};
        
        let reaKokku = 0;
        let veergudeHtml = "";

        seaded.veerud.forEach((v, vIdx) => {
            const väärtus = Number(ridaAndmed[v.nimi]) || 0;
            veergudeSummad[vIdx] += väärtus;
            
            if (v.tüüp === "toit" && v.hind) {
                const reaToiduSumma = väärtus * Number(v.hind);
                reaKokku += reaToiduSumma;
            } else {
                reaKokku += väärtus;
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

    // Jalus (Summad arvutatakse reaalajas samamoodi nagu peatabelis)
    const tfoot = `
        <tr>
            <td><strong>Kogus kokku</strong></td>
            ${veergudeSummad.map(s => `<td style="font-weight:bold;">${s}</td>`).join("")}
            <td></td>
        </tr>
        <tr>
            <td><strong>Kogus × hind</strong></td>
            ${seaded.veerud.map((v, vIdx) => {
                const s = veergudeSummad[vIdx];
                const summaTekst = (v.tüüp === "toit" && v.hind) ? (s * Number(v.hind)).toFixed(2) + " €" : s.toFixed(2) + " €";
                return `<td style="font-weight:bold; color:#2c3e50;">${summaTekst}</td>`;
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


