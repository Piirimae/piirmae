// kuuvaated.js (MOODUL)
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Kontrollime kasutajat ja kuvame nime päises
    await kuvaKasutajaNimi();

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    // Tuvastame käesoleva kuu dünaamiliselt (kujul YYYY-MM, nt "2026-07")
    const jooksevKuup = new Date();
    const jooksevKuu = `${jooksevKuup.getFullYear()}-${String(jooksevKuup.getMonth() + 1).padStart(2, '0')}`;

    const laud = document.getElementById("kuuvaadeTabeliKoht");
    if (!laud) return;

    laud.innerHTML = "<tr><td style='padding:20px;'>Laen viimast kinnitatud aruandevaadet...</td></tr>";

    // 2. Küsime andmebaasist külmutatud andmete pakki
    const { data, error } = await sb
        .from("kuuvaated_snapshot")
        .select("*")
        .eq("kuu_id", jooksevKuu)
        .maybeSingle();

    if (error || !data) {
        laud.innerHTML = `
            <div class="error-box" style="padding: 20px; background: #fff5f5; color: #cc0000; border: 1px solid #ffcccc; border-radius: 4px; margin-top:20px;">
                Kuu <strong>${jooksevKuu}</strong> kohta pole administraator veel ühtegi ametlikku külmvaadet salvestanud. 
                <br><br><small>Vaade tekkib automaatselt, kui administraator vajutab kassatabelis nuppu "Salvesta arhiivi".</small>
            </div>
        `;
        return;
    }

    // 3. Parsime andmebaasist saadud andmed lahti
    const seis = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    // 4. TABELI JOONISTAMINE PUHTA TEKSTINA (NAGU PDF) ILMA INPUTIDETA
    // --- Päise read ---
    const thead = `
        <tr>
            <th>Kuupäev</th>
            ${seis.paise.map(v => {
                if (v.tüüp === "toit") {
                    return `<th>${v.pealkiri}<br><small>${Number(v.hind).toFixed(2)} €</small></th>`;
                }
                return `<th>${v.pealkiri}</th>`;
            }).join("")}
            <th>Kokku</th>
        </tr>
    `;

    // --- Sisu read (Asendame input väljad tavalise tekstiga td sees!) ---
    const tbody = seis.rows.map(r => `
        <tr>
            <td><strong>${r.kuupäev}</strong></td>
            ${r.veerud.map(v => `<td>${v || "-"}</td>`).join("")}
            <td class="kokku-cell" style="font-weight:bold;">${r.kokku}</td>
        </tr>
    `).join("");

    // --- Jaluse summad ---
    const tfoot = `
        <tr>
            <td><strong>Kogus kokku</strong></td>
            ${seis.sumKogus.map(v => `<td style="font-weight:bold;">${v}</td>`).join("")}
            <td></td>
        </tr>
        <tr>
            <td><strong>Kogus × hind</strong></td>
            ${seis.sumHind.map(v => `<td style="font-weight:bold; color:#2c3e50;">${v}</td>`).join("")}
            <td style="font-weight:bold; background:#f1c40f; color:#000; font-size:1.1em; padding:8px;">${seis.kuuKokku}</td>
        </tr>
    `;

    // Joonistame valmis tabeli kesta sisse
    laud.innerHTML = `
        <table class="tabel vaatleja-tabel" style="width:100%; border-collapse:collapse; margin-top:20px;">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
            <tfoot>${tfoot}</tfoot>
        </table>
        
        <div style="margin-top: 15px; font-size: 11px; color: #7f8c8d; font-style: italic; text-align: right;">
            * Kinnitatud aruandevaade. Viimati arhiveeritud: ${new Date(data.uuendatud_at).toLocaleString("et-EE")} | Kinnitas: ${data.uuendaja}
        </div>
    `;
});

