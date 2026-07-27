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
function kuvaNupud(kirje) {
    const roll = window.userRole || "vaataja";
    let html = `<button onclick="window.print()" class="btn-small">Prindi vaade</button>`;

    if (roll === "superadmin" || roll === "admin") {
        html += `<button id="taastaArhiivBtn" class="btn-small">✨ Taasta</button>
                 <button onclick="window.location='parandus.html?arhiiviId=${kirje.arhiiviId}'" class="btn-small">🔧 Paranda</button>`;
    }
    if (roll === "superadmin") {
        html += `<button id="kustutaArhiivBtn" class="btn-small">🗑 Kustuta</button>`;
    }
    arhiiviNupud.innerHTML = html;
    SeostaNuppudeTegevused(kirje.arhiiviId, kirje.kuu_id);

    
    // ✅ TOPELTKINNITUSEGA KUSTUTAMINE: Ainult superadminile
    if (roll === "superadmin") {
        html += `
            <button onclick="window.location.href='parandus.html?arhiiviId=${r.arhiiviId}'" class="btn-small">🔧 Paranda</button>
            <button class="admin" id="kustutaArhiivBtn" style="background:#e74c3c; color:white;">Kustuta arhiiv</button>
        `;
    }

    arhiiviNupud.innerHTML = html;
    seoNupudJaModalid();
}

// ==========================================
//  MODALID JA FUNKTSIOONID
// ==========================================


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


// --- TAASTAMISE AKTIVNE PROTSESS ---
// --- TAASTAMISE AKTIIVNE PROTSESS (PARANDATUD JA TAIBUKAS) ---
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

    // Pakime arhiivi andmepaki (state) lahti
    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    // Tuvastame TÄNASE jooksva kalendrikuu (kujul YYYY-MM)
    const jooksevKuup = new Date();
    const jooksevKuuStr = `${jooksevKuup.getFullYear()}-${String(jooksevKuup.getMonth() + 1).padStart(2, '0')}`;

    // Märgime andmebaasis vana kirje staatuse taastatuks (puhtalt statistika jaoks)
    await sb.from("arhiiv").update({ taastatud: true }).eq("arhiiviId", arhiiviId);

    // ✅ Logime tegevuse ametlikult logide tabelisse
    await logiTegevusSupabasse("taasta_aktiivne-kuu", { 
        algne_kuu: kuuId, 
        arhiiviId: arhiiviId, 
        siht_kuu: jooksevKuuStr 
    });

    // 🌟 KRIITILINE SAMM: Salvestame andmed kotti, kuid määrame kuuks JOOKSVA KUU!
    localStorage.setItem("taastatudState", JSON.stringify(state));
    localStorage.setItem("taastatudKuu", jooksevKuuStr);

    // Sulgeme modali visuaalselt
    const taastaModal = document.getElementById("taastaModal");
    if (taastaModal) taastaModal.style.display = "none";

    alert(`Andmed ette valmistatud! Suunan Sind Kassatabeli lehele, kus see seis laetakse jooksva kuu (${jooksevKuuStr}) tabelisse.`);

    // Suuname kasutaja Kassatabeli lehele, kus logic.js võtab andmed vastu ja avab need täitmiseks
    window.location.href = "kassatabel.html";
}


// --- Logout ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}
   // Printimine
window.addEventListener("beforeprint", () => {
    const valitudVariant = kuuValik?.selectedOptions;
    const kuu = valitudVariant && valitudVariant.length > 0 ? valitudVariant[0].dataset.kuu : "";
    
    const leht = window.location.href.includes("arhiiv") ? "Arhiiv" : "Kassatabel";
    const printTitle = document.getElementById("printTitle");
    
    if (printTitle) {
        printTitle.textContent = `${kuu} – ${leht}`;
    }
});
// Näide koodist, mis käivitub arhiivi lehel nupule vajutades:
async function handleTaastaAktiivseksKuuks(valitudArhiivRida) {
    if (!confirm("Kas oled kindel, et soovid selle arhiiviseisu laadida käesoleva kuu aktiivseks tabeliks? See kirjutab praegused sisestused üle.")) return;

    const jooksevKuup = new Date();
    const jooksevKuuStr = `${jooksevKuup.getFullYear()}-${String(jooksevKuup.getMonth() + 1).padStart(2, '0')}`;

    // Paneme arhiivi andmepaki valmis
    localStorage.setItem("taastatudState", JSON.stringify(valitudArhiivRida.state));
    localStorage.setItem("taastatudKuu", jooksevKuuStr);

    // Suuname kasutaja otse peamisele kassalehele, kus meie uus kontroll andmed vastu võtab!
    window.location.href = "kassatabel.html"; 
}

