import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

// --- DOM elemendid ---
const kuuValik = document.getElementById("kuuValik");
const arhiiviMeta = document.getElementById("arhiiviMeta");
const arhiiviKuva = document.getElementById("arhiiviKuva");
const arhiiviNupud = document.getElementById("arhiiviNupud");

console.log("arhiiv.js laaditud");

async function logiTegevusSupabasse(tegevus, detailid = {}) {
    const { data: userData } = await sb.auth.getUser();
    const userEmail = userData?.user?.email || null;
    const { error } = await sb.from("logid").insert({ tegevus, detailid, user_email: userEmail });
    if (error) console.error("Logimise viga:", error);
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        await kuvaKasutajaNimi();
    } catch (authError) {
        console.error("Kasutajanime kuvamise viga (auth.js):", authError);
    }
    await laeKuuValikud();
    await kuvaArhiiv();
});

async function laeKuuValikud() {
    const { data, error } = await sb
        .from("arhiiv")
        .select("arhiiviId, kuu_id, created_at, salvestaja, versioon, paeritolu")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Kuu valikute laadimise viga:", error);
        return;
    }

    kuuValik.innerHTML = (data || []).map(r => {
        const versiooniMärgistus = r.paeritolu === "automaatne" ? "(automaatika)" : `(v${r.versioon})`;
        return `
            <option value="${r.arhiiviId}"
                data-kuu="${r.kuu_id}"
                data-created="${r.created_at}"
                data-salvestaja="${r.salvestaja}"
                data-versioon="${r.versioon}"
                data-paeritolu="${r.paeritolu || ''}">
                ${r.kuu_id} ${versiooniMärgistus}
            </option>
        `;
    }).join("");

    kuuValik.addEventListener("change", kuvaArhiiv);
}

async function kuvaArhiiv() {
    const arhiiviId = kuuValik.value;
    if (!arhiiviId) return;

    const { data: arhiivList, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .order("versioon", { ascending: false })
        .limit(1);

    if (error || !arhiivList?.length) {
        arhiiviMeta.innerHTML = "<p>Arhiivi ei leitud.</p>";
        arhiiviKuva.innerHTML = "";
        arhiiviNupud.innerHTML = "";
        return;
    }

    const kirje = arhiivList[0];
    let state;
    try {
        state = typeof kirje.state === "string" ? JSON.parse(kirje.state) : kirje.state;
    } catch (parseError) {
        console.error("Arhiivi state JSON-i lugemine ebaõnnestus:", parseError);
        arhiiviKuva.innerHTML = "<p>Arhiivi andmed on vigased või mitteloetavad.</p>";
        return;
    }

    kuvaMeta(kirje);
    kuvaTabel(state);
    kuvaNupud(kirje);
}

function kuvaMeta(kirje) {
    const d = kirje.created_at ? new Date(kirje.created_at) : null;
    const kuup = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("et-EE") : "Kuupäev puudub";
    const aeg = d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("et-EE") : "Kellaaeg puudub";
    const arhiveerija = kirje.paeritolu === "automaatne" ? "Automaatne kuulõpu arhiiv" : (kirje.salvestaja || "Teadmata");

    arhiiviMeta.innerHTML = `
        <p><strong>Kuu:</strong> ${kirje.kuu_id || "Teadmata"}</p>
        <p><strong>Arhiveeritud:</strong> ${kuup}, ${aeg}</p>
        <p><strong>Arhiveeris:</strong> ${arhiveerija}</p>
        <p><strong>Versioon:</strong> ${kirje.versioon ?? "—"}</p>
    `;
}

function kuvaTabel(state) {
    if (!state || !Array.isArray(state.paise) || !Array.isArray(state.rows)) {
        arhiiviKuva.innerHTML = "<p>Arhiivi formaat tundmatu või vigane.</p>";
        return;
    }

    const paise = state.paise;
    const rows = state.rows;
    const sumKogus = Array.isArray(state.sumKogus) ? state.sumKogus : [];
    const sumHind = Array.isArray(state.sumHind) ? state.sumHind : [];

    const thead = `
        <thead><tr>
            <th>Kuupäev</th>
            ${paise.map(v => v.tüüp === "toit"
                ? `<th>${v.pealkiri}<br><small>${Number(v.hind).toFixed(2)} €</small></th>`
                : `<th>${v.pealkiri}</th>`).join("")}
            <th>Kokku</th>
        </tr></thead>
    `;
    const tbodyHtml = `
        <tbody>${rows.map(r => `
            <tr>
                <td>${r.kuupäev ?? ""}</td>
                ${(Array.isArray(r.veerud) ? r.veerud : []).map(v => `<td>${v ?? ""}</td>`).join("")}
                <td>${r.kokku ?? ""}</td>
            </tr>
        `).join("")}</tbody>
    `;
    const tfoot = `
        <tfoot>
            <tr><td>Kogus kokku</td>${paise.map((_, i) => `<td>${sumKogus[i] ?? "-"}</td>`).join("")}<td></td></tr>
            <tr><td>Kogus × hind</td>${paise.map((_, i) => `<td>${sumHind[i] ?? "-"}</td>`).join("")}<td>${state.kuuKokku ?? "-"}</td></tr>
        </tfoot>
    `;

    arhiiviKuva.innerHTML = `<table class="arhiivi-tabel">${thead}${tbodyHtml}${tfoot}</table>`;
}

function kuvaNupud(kirje) {
    const roll = window.userRole || "vaataja";
    let html = `
        <button onclick="window.print()" class="btn-small">Prindi vaade</button>
        <button disabled class="btn-small">Lae alla PDF (tulekul)</button>
        <button onclick="window.location='fuajee.html'" class="btn-small">⬅ Fuajee</button>
    `;

    if (["admin", "superadmin"].includes(roll)) {
        html += `<button id="taastaArhiivBtn" class="btn-small" style="background:#2ecc71; color:white; font-weight:bold;">Taasta aktiivseks kuuks</button>`;
    }
    if (roll === "superadmin") {
        html += `
            <button onclick="window.location.href='parandus.html?arhiiviId=${encodeURIComponent(kirje.arhiiviId)}'" class="btn-small" style="background:#3498db; color:white;">🔧 Paranda arhiivi</button>
            <button class="admin" id="kustutaArhiivBtn" style="background:#e74c3c; color:white;">🗑 Kustuta arhiiv</button>
        `;
    }

    arhiiviNupud.innerHTML = html;
    SeostaNuppudeKlikid(kirje);
}

function SeostaNuppudeKlikid(kirje) {
    const taastaBtn = document.getElementById("taastaArhiivBtn");
    if (taastaBtn) taastaBtn.onclick = () => taastaArhiivLoogika(kirje.arhiiviId, kirje.kuu_id);

    const kustutaBtn = document.getElementById("kustutaArhiivBtn");
    if (kustutaBtn) {
        kustutaBtn.onclick = async () => {
            if (!confirm(`Kas oled täiesti kindel, et soovid arhiivi ${kirje.arhiiviId} kustutada?`)) return;
            if (!confirm("⚠️ HOIATUS: See kustutab arhiivi andmebaasist jäädavalt! Kas jätkata?")) return;

            const { error } = await sb.from("arhiiv").delete().eq("arhiiviId", kirje.arhiiviId);
            if (!error) {
                await logiTegevusSupabasse("kustuta_arhiiv", { arhiiviId: kirje.arhiiviId, kuu: kirje.kuu_id });
                alert("Arhiiv edukalt kustutatud.");
                window.location.reload();
            } else {
                alert("Kustutamine ebaõnnestus: " + error.message);
            }
        };
    }
}

async function taastaArhiivLoogika(arhiiviId, kuuId) {
    if (!confirm("Kas oled kindel, et soovid selle arhiiviseisu laadida käesoleva kuu aktiivseks tabeliks? See kirjutab praegused sisestused üle.")) return;

    const { data, error } = await sb.from("arhiiv").select("*").eq("arhiiviId", arhiiviId).single();
    if (error || !data) {
        alert("Arhiivi laadimine ebaõnnestus.");
        return;
    }

    let state;
    try {
        state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;
    } catch (parseError) {
        console.error("Taastatava arhiivi lugemine ebaõnnestus:", parseError);
        alert("Arhiivi andmed on vigased; taastamist ei tehtud.");
        return;
    }

    const now = new Date();
    const jooksevKuu = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { error: updateError } = await sb.from("arhiiv").update({ taastatud: true }).eq("arhiiviId", arhiiviId);
    if (updateError) {
        console.error("Arhiivi taastamise märkimine ebaõnnestus:", updateError);
        alert("Arhiivi taastamise märkimine ebaõnnestus.");
        return;
    }

    await logiTegevusSupabasse("taasta_aktiivne-kuu", { algne_kuu: kuuId, arhiiviId, siht_kuu: jooksevKuu });
    localStorage.setItem("taastatudState", JSON.stringify(state));
    localStorage.setItem("taastatudKuu", jooksevKuu);

    alert(`Andmed ette valmistatud! Suunan Sind Kassatabeli lehele, kus see seis laetakse jooksva kuu (${jooksevKuu}) tabelisse.`);
    window.location.href = "kassatabel.html";
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) logoutBtn.addEventListener("click", logout);

window.addEventListener("beforeprint", () => {
    const variant = kuuValik?.selectedOptions;
    const kuu = variant && variant.length > 0 ? variant[0].dataset.kuu : "";
    const printTitle = document.getElementById("printTitle");
    if (printTitle) printTitle.textContent = `${kuu} – Arhiiv`;
});

// Kuulõpu automaatarhiveerimine toimub ainult Supabase'i taustatöö kaudu.
// See leht kuvab, taastab ja prindib arhiive; automaatset salvestust siin ei käivitata.
