import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll, logout } from "./auth.js";

// --- DOM elemendid ---
const kuuValik = document.getElementById("kuuValik");
const arhiiviMeta = document.getElementById("arhiiviMeta");
const arhiiviKuva = document.getElementById("arhiiviKuva");
const arhiiviNupud = document.getElementById("arhiiviNupud");

console.log("arhiiv.js laaditud");

// --- INIT ---
window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    await laeKuuValikud();
    await kuvaArhiiv();
});

// --- Lae kuude loetelu ---
async function laeKuuValikud() {
    const { data, error } = await sb
        .from("arhiiv")
        .select("arhiiviId, kuu_id, created_at, salvestaja, versioon")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Kuu valikute laadimise viga:", error);
        return;
    }

    kuuValik.innerHTML = data.map(r => {
        const d = new Date(r.created_at);
        const kuup = d.toLocaleDateString("et-EE");
        const aeg = d.toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" });

        return `
            <option 
                value="${r.arhiiviId}"
                data-kuu="${r.kuu_id}"
                data-created="${r.created_at}"
                data-salvestaja="${r.salvestaja}"
                data-versioon="${r.versioon}"
            >
                ${kuup} ${aeg} (v${r.versioon})
            </option>
        `;
    }).join("");

    kuuValik.addEventListener("change", kuvaArhiiv);
}

// --- Lae ja kuva arhiiv ---
async function kuvaArhiiv() {
    const arhiiviId = kuuValik.value;

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

    const state = JSON.parse(data.state);

    kuvaMeta(data);
    kuvaTabel(state);
    kuvaNupud();
}

// --- Metaandmed ---
function kuvaMeta(kirje) {
    const d = new Date(kirje.created_at);
    const kuup = d.toLocaleDateString("et-EE");
    const aeg = d.toLocaleTimeString("et-EE");

    arhiiviMeta.innerHTML = `
        <p><strong>Kuu:</strong> ${kirje.kuu_id}</p>
        <p><strong>Arhiveeritud:</strong> ${kuup}, ${aeg}</p>
        <p><strong>Arhiveeris:</strong> ${kirje.salvestaja}</p>
        <p><strong>Versioon:</strong> ${kirje.versioon}</p>
    `;
}

// --- Tabel ---
function kuvaTabel(state) {

    // --- UUS FORMAAT ---
    if (state.paise && state.rows) {

        const paise = state.paise;
        const rows = state.rows;

        const thead = `
            <thead>
                <tr>
                    <th>Kuupäev</th>
                    ${paise.map(v => {
                        if (v.tüüp === "toit") {
                            return `<th>${v.pealkiri}<br><small>${Number(v.hind).toFixed(2)} €</small></th>`;
                        }
                        return `<th>${v.pealkiri}</th>`;
                    }).join("")}
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

        arhiiviKuva.innerHTML = `
            <table class="arhiivi-tabel">
                ${thead}
                ${tbody}
                ${tfoot}
            </table>
        `;
        return;
    }

    // --- VANA FORMAAT ---
    arhiiviKuva.innerHTML = "<p>Vana arhiivi formaat — ei toetata täielikult.</p>";
}


    // --- VANA FORMAAT: objekt ---
    if (state && typeof state === "object") {

        const veerud = state.veerud ?? [];
        const rows = state.rows ?? [];

        const thead = `
            <thead>
                <tr>
                    <th>Kuupäev</th>
                    ${veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
                </tr>
            </thead>
        `;

        const tbody = `
            <tbody>
                ${rows.map(r => `
                    <tr>
                        <td>${r.kuupaev ?? ""}</td>
                        ${veerud.map(v => `<td>${r[v.nimi] ?? ""}</td>`).join("")}
                    </tr>
                `).join("")}
            </tbody>
        `;

        arhiiviKuva.innerHTML = `
            <table class="arhiivi-tabel">
                ${thead}
                ${tbody}
            </table>
            <p><strong>Kuu kokku:</strong> ${state.kuuKokku ?? ""}</p>
        `;
        return;
    }

    // --- Kui ei vasta kummalegi ---
    arhiiviKuva.innerHTML = "<p>Arhiivi formaat tundmatu.</p>";
}


// --- Nupud ---
function kuvaNupud() {
    const roll = window.userRole || "vaataja";

    let html = `
        <button onclick="window.print()">Prindi</button>
        <button disabled>Lae alla PDF (tulekul)</button>
        <button onclick="window.location='fuajee.html'">Tagasi</button>
    `;

    if (roll === "superadmin") {
        html += `
            <button class="admin">Paranda arhiivi</button>
            <button class="admin taasta-btn">Taasta aktiivseks kuuks</button>
            <button class="admin">Kustuta arhiiv</button>
        `;
    }

    arhiiviNupud.innerHTML = html;
}

// --- MODAL ---
let parandusModal, parandusKinnita, parandusLoobu;

window.addEventListener("DOMContentLoaded", () => {
    parandusModal = document.getElementById("parandusModal");
    parandusKinnita = document.getElementById("parandusKinnita");
    parandusLoobu = document.getElementById("parandusLoobu");

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("admin") && e.target.textContent.includes("Paranda arhiivi")) {
            parandusModal.style.display = "flex";
        }
    });

    parandusLoobu.addEventListener("click", () => {
        parandusModal.style.display = "none";
    });

    parandusKinnita.addEventListener("click", () => {
        const kuuId = kuuValik.value;
        window.location = `kassatabel.html?paranda=${kuuId}`;
    });
});

// --- Taasta arhiiv ---
async function taastaArhiiv(arhiiviId) {
    const { data, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .single();

    if (error || !data) {
        alert("Arhiivi laadimine ebaõnnestus.");
        return;
    }

    const state = JSON.parse(data.state);

    await sb
        .from("arhiiv")
        .update({ taastatud: true })
        .eq("arhiiviId", arhiiviId);

    localStorage.setItem("taastatudState", JSON.stringify(state));
    localStorage.setItem("taastatudKuu", data.kuu_id);

    window.location = `kassatabel.html?taastatud=${data.kuu_id}`;
}

// --- Logout ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}








