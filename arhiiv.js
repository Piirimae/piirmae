import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll, logout } from "./auth.js";

// --- DOM elemendid ---
const kuuValik = document.getElementById("kuuValik");
const arhiiviMeta = document.getElementById("arhiiviMeta");
const arhiiviKuva = document.getElementById("arhiiviKuva");
const arhiiviNupud = document.getElementById("arhiiviNupud");

console.log("arhiiv.js laaditud");

// --- Kohalik logimise funktsioon (sünkroniseeritud teiste lehtedega) ---
async function logiTegevusSupabasse(tegevus, detailid = {}) {
    const { data: userData } = await sb.auth.getUser();
    const userEmail = userData?.user?.email || null;
    await sb.from("logid").insert({ tegevus, detailid, user_email: userEmail });
}

// --- INIT ---
window.addEventListener("DOMContentLoaded", async () => {
    try {
        await kuvaKasutajaNimi();
    } catch (authError) {
        console.error("Kasutajanime kuvamise viga (auth.js):", authError);
    }
    await laeKuuValikud();
    await kuvaArhiiv();
});

// --- Lae kuude loetelu ---
async function laeKuuValikud() {
    const { data, error } = await sb
        .from("arhiiv")
        .select("arhiiviId, kuu_id, created_at, salvestaja, versioon, paeritolu")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Kuu valikute laadimise viga:", error);
        return;
    }

    kuuValik.innerHTML = data.map(r => {
        let versiooniMärgistus = r.paeritolu === "automaatne" ? "(automaatika)" : `(v${r.versioon})`;
        const label = `${r.kuu_id} ${versiooniMärgistus}`;

        return `
            <option 
                value="${r.arhiiviId}"
                data-kuu="${r.kuu_id}"
                data-created="${r.created_at}"
                data-salvestaja="${r.salvestaja}"
                data-versioon="${r.versioon}"
                data-paeritolu="${r.paeritolu || ''}"
            >
                ${label}
            </option>
        `;
    }).join("");

    kuuValik.addEventListener("change", kuvaArhiiv);
}

// --- Lae ja kuva arhiiv ---
async function kuvaArhiiv() {
    const arhiiviId = kuuValik.value;
    if (!arhiiviId) return;

    const { data, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .single();

    if (error || !data) {
        arhiiviMeta.innerHTML = "<p>Arhiivi ei leitud.</p>";
        arhiiviKuva.innerHTML = "";
        arhiiviNupud.innerHTML = "";
        return;
    }

    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    kuvaMeta(data);
    kuvaTabel(state);
    kuvaNupud();
}

// --- Metaandmed ---
function kuvaMeta(kirje) {
    const d = new Date(kirje.created_at);
    const kuup = d.toLocaleDateString("et-EE");
    const aeg = d.toLocaleTimeString("et-EE");

    let arhiveerijaTekst = kirje.paeritolu === "automaatne" ? "(automaatika)" : kirje.salvestaja;
    let versiooniTekst = kirje.paeritolu === "automaatne" ? "(automaatika)" : kirje.versioon;

    arhiiviMeta.innerHTML = `
        <p><strong>Kuu:</strong> ${kirje.kuu_id}</p>
        <p><strong>Arhiveeritud:</strong> ${kuup}, ${aeg}</p>
        <p><strong>Arhiveeris:</strong> ${arhiveerijaTekst}</p>
        <p><strong>Versioon:</strong> ${versiooniTekst}</p>
    `;
}

// --- Tabel ---
function kuvaTabel(state) {
    if (!state.paise || !state.rows) {
        arhiiviKuva.innerHTML = "<p>Arhiivi formaat tundmatu või vigane.</p>";
        return;
    }

    const paise = state.paise;
    const rows = state.rows;

    const thead = `
        <thead>
            <tr>
                <th>Kuupäev</th>
                ${paise.map(v => v.tüüp === "toit" ? `<th>${v.pealkiri}<br><small>${Number(v.hind).toFixed(2)} €</small></th>` : `<th>${v.pealkiri}</th>`).join("")}
                <th>Kokku</th>
            </tr>
        </thead>
    `;

    const tbody = `
        <tbody>
            ${rows.map(r => `
                <tr>
                    <td>${r.kuupäev}</td>
                    ${r.veerud.map(v => `<td>${v}</td>`).join("")}
                    <td>${r.kokku}</td>
                </tr>
            `).join("")}
        </tbody>
    `;

    const tfoot = `
        <tfoot>
            <tr>
                <td>Kogus kokku</td>
                ${state.sumKogus.map(v => `<td>${v}</td>`).join("")}
                <td></td>
            </tr>
            <tr>
                <td>Kogus × hind</td>
                ${state.sumHind.map(v => `<td>${v}</td>`).join("")}
                <td>${state.kuuKokku}</td>
            </tr>
        </tfoot>
    `;

    arhiiviKuva.innerHTML = `<table class="arhiivi-tabel">${thead}${tbody}${tfoot}</table>`;
}

// --- Nupud ---
function kuvaNupud() {
    const roll = window.userRole || "vaataja";
    const arhiiviId = kuuValik.value;

    let html = `
        <button onclick="window.print()">Prindi</button>
        <button disabled>Lae alla PDF (tulekul)</button>
        <button onclick="window.location='fuajee.html'">Tagasi</button>
    `;

    if (roll === "superadmin" || roll === "admin") {
        html += `
            <button class="admin" id="parandaArhiiviBtn">Paranda arhiivi</button>
            <button class="admin taasta-btn" id="taastaArhiivBtn">Taasta aktiivseks kuuks</button>
        `;
    }
    
    // ✅ TOPELTKINNITUSEGA KUSTUTAMINE: Ainult superadminile
    if (roll === "superadmin") {
        html += `
            <button class="admin" id="kustutaArhiivBtn" style="background:#e74c3c; color:white;">Kustuta arhiiv</button>
        `;
    }

    arhiiviNupud.innerHTML = html;
    seoNupudJaModalid();
}

// ==========================================
//  MODALID JA FUNKTSIOONID
// ==========================================
function seoNupudJaModalid() {
    const opt = kuuValik.selectedOptions[0];
    if (!opt) return;

    const kuu = opt.dataset.kuu;
    const arhiiviId = opt.value;

    // --- PARANDAMINE ---
    const parandaBtn = document.getElementById("parandaArhiiviBtn");
    const parandusModal = document.getElementById("parandusModal");
    const parandusKinnita = document.getElementById("parandusKinnita");
    const parandusLoobu = document.getElementById("parandusLoobu");

    if (parandaBtn && parandusModal) {
        parandaBtn.onclick = () => parandusModal.style.display = "flex";
        parandusLoobu.onclick = () => parandusModal.style.display = "none";
        parandusKinnita.onclick = async () => {
            // ✅ Logime tegevuse enne suunamist
            await logiTegevusSupabasse("paranda_arhiiv", { kuu: kuu, arhiiviId: arhiiviId });
            window.location = `kassatabel.html?paranda=${kuu}&arhiiviId=${arhiiviId}`;
        };
    }

    // --- TAASTAMINE ---
    const taastaBtn = document.getElementById("taastaArhiivBtn");
    const taastaModal = document.getElementById("taastaModal");
    const taastaKinnita = document.getElementById("taastaKinnita");
    const taastaLoobu = document.getElementById("taastaLoobu");
    const taastaInfo = document.getElementById("taastaInfo");

    if (taastaBtn && taastaModal) {
        if (taastaInfo) taastaInfo.textContent = `Kuu: ${kuu} (${arhiiviId})`;
        taastaBtn.onclick = () => taastaModal.style.display = "flex";
        taastaLoobu.onclick = () => taastaModal.style.display = "none";
        taastaKinnita.onclick = async () => {
            await taastaArhiivLoogika(arhiiviId, kuu);
        };
    }

    // --- KUSTUTAMINE (TOPELTKINNITUS) ---
    const kustutaBtn = document.getElementById("kustutaArhiivBtn");
    if (kustutaBtn) {
        kustutaBtn.onclick = async () => {
            if (!confirm(`Kas oled täiesti kindel, et soovid arhiivi ${arhiiviId} kustutada?`)) return;
            if (!confirm("⚠️ HOIATUS: See kustutab arhiivi andmebaasist jäädavalt! Kas jätkata?")) return;

            const { error } = await sb.from("arhiiv").delete().eq("arhiiviId", arhiiviId);
            if (!error) {
                // ✅ Logime kustutamise tegevuse
                await logiTegevusSupabasse("kustuta_arhiiv", { arhiiviId: arhiiviId, kuu: kuu });
                alert("Arhiiv edukalt kustutatud.");
                window.location.reload();
            } else {
                alert("Kustutamine ebaõnnestus: " + error.message);
            }
        };
    }
}

// --- TAASTAMISE AKTIVNE PROTSESS ---
async function taastaArhiivLoogika(arhiiviId, kuuId) {
    const { data, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .single();

    if (error || !data) {
        alert("Arhiivi laadimine ebaõnnestus.");
        return;
    }

    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    // Märgime andmebaasis staatuse taastatuks
    await sb.from("arhiiv").update({ taastatud: true }).eq("arhiiviId", arhiiviId);

    // ✅ Logime tegevuse
    await logiTegevusSupabasse("taasta_aktiivne-kuu", { kuu: kuuId, arhiiviId: arhiiviId });

    localStorage.setItem("taastatudState", JSON.stringify(state));
    localStorage.setItem("taastatudKuu", data.kuu_id);
    window.location = `kassatabel.html?taastatud=${data.kuu_id}`;
}

// --- Logout ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}

window.addEventListener("beforeprint", () => {
    const opt = kuuValik.selectedOptions[0];
    const kuu = opt ? opt.dataset.kuu : "";
    const leht = window.location.href.includes("arhiiv") ? "Arhiiv" : "Kassatabel";
    const printTitle = document.getElementById("printTitle");
    if (printTitle) printTitle.textContent = `${kuu} – ${leht}`;
});

