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
        .select("kuu_id")
        .order("kuu_id", { ascending: false });

    if (error) {
        console.error("Kuu valikute laadimise viga:", error);
        return;
    }

    kuuValik.innerHTML = data
        .map(r => `<option value="${r.kuu_id}">${r.kuu_id}</option>`)
        .join("");

    kuuValik.addEventListener("change", kuvaArhiiv);
}

// --- Lae ja kuva arhiiv ---
async function kuvaArhiiv() {
    const kuuId = kuuValik.value;

    const { data, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("id", { ascending: false })
        .limit(1);

    if (error || !data.length) {
        arhiiviMeta.innerHTML = "<p>Arhiivi ei leitud.</p>";
        arhiiviKuva.innerHTML = "";
        arhiiviNupud.innerHTML = "";
        return;
    }

    const kirje = data[0];
    let state = kirje.state;

    if (typeof state === "string") {
        try {
            state = JSON.parse(state);
        } catch (e) {
            console.error("Arhiivi JSON parse error:", e);
            return;
        }
    }

    kuvaMeta(kirje);
    kuvaTabel(state);
    kuvaNupud();
}

// --- Metaandmed ---
function kuvaMeta(kirje) {
    arhiiviMeta.innerHTML = `
        <p><strong>Kuu:</strong> ${kirje.kuu_id}</p>
        <p><strong>Arhiveeritud:</strong> ${new Date(kirje.created_at).toLocaleString("et-EE")}</p>
        <p><strong>Arhiveeris:</strong> ${kirje.kasutaja || kirje.user_email}</p>
    `;
}

// --- Tabel ---
function kuvaTabel(state) {
    const veerud = Array.isArray(state.veerud) ? state.veerud : [];
    const rows = Array.isArray(state.rows) ? state.rows : [];

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
            <button class="admin">Taasta aktiivseks kuuks</button>
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

// Lisa event listener ainult siis, kui nupp on olemas
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}




