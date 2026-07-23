// kasutajad.js (MOODUL)

// ✅ LISATUD: Vajalikud impordid faili algusesse
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

// Väike abifunktsioon: vorminda kuupäev
function formatDate(ts) {
    if (!ts) return "";
    return new Date(ts).toLocaleString("et-EE");
}

// Kontrolli rolli ja lae sisu
async function initKasutajateLeht() {
    // Kuvatakse ühtset päist
    if (typeof kuvaKasutajaNimi === "function") {
        await kuvaKasutajaNimi();
    }

    const accessError = document.getElementById("accessError");
    const sisu = document.getElementById("kasutajateSisu");

    // Hetkel eeldame, et window.userRole on juba määratud kuvaKasutajaNimi() sees.
    // Kui mitte, siis paneme vaikimisi "vaatleja".
    const roll = window.userRole || "vaatleja";

    // Ainult superadmin näeb seda lehte
    if (roll !== "superadmin") {
        if (accessError) accessError.style.display = "block";
        if (sisu) sisu.style.display = "none";
        return;
    }

    // Kui jõudsime siia, on kasutaja superadmin → näita sisu
    if (accessError) accessError.style.display = "none";
    if (sisu) sisu.style.display = "block";

    // Seome nupud ja laadime algandmed
    seoNupud();
    laeKasutajad();
}

async function laeKasutajad() {
    const tbody = document.querySelector("#kasutajaTabel tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "<tr><td colspan='4'>Laen andmeid...</td></tr>";

    const { data, error } = await sb
        .from("kasutajad")
        .select("id, email, roll, created_at")
        .order("email");

    if (error) {
        console.error("Viga kasutajate laadimisel:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Viga kasutajate laadimisel: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">Kasutajaid ei ole</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    data.forEach(u => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${u.email}</td>
            <td>
                <select data-id="${u.id}" class="rollSelect">
                    <option value="super">super</option>
                    <option value="superadmin">superadmin</option>
                    <option value="admin">admin</option>
                    <option value="sisestaja">sisestaja</option>
                    <option value="vaatleja">vaatleja</option>
                </select>
            </td>
            <td>${formatDate(u.created_at)}</td>
            <td>
                <button class="kustutaBtn" data-id="${u.id}">Kustuta</button>
            </td>
        `;

        tbody.appendChild(tr);

        // Määra selecti väärtus
        const select = tr.querySelector(".rollSelect");
        if (u.roll && select) select.value = u.roll;
    });

    // ✅ PARANDATUD: Sündmuste sidumine dünaamiliselt loodud elementidele
    tbody.querySelectorAll(".rollSelect").forEach(sel => {
        sel.onchange = async () => {
            const id = sel.dataset.id;
            const uusRoll = sel.value;

            const { error } = await sb
                .from("kasutajad")
                .update({ roll: uusRoll })
                .eq("id", id);

            if (error) {
                alert("Viga rolli muutmisel: " + error.message);
                console.error(error);
            } else {
                alert("Roll muudetud");
            }
        };
    });

    tbody.querySelectorAll(".kustutaBtn").forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            if (!confirm("Kas kustutada kasutaja?")) return;

            const { error } = await sb
                .from("kasutajad")
                .delete()
                .eq("id", id);

            if (error) {
                alert("Viga kustutamisel: " + error.message);
                console.error(error);
            } else {
                laeKasutajad();
            }
        };
    });
}

function seoNupud() {
    const lisaBtn = document.getElementById("lisaBtn");
    if (!lisaBtn) return;

    // Eemaldame vana kuulaja, et vältida topeltsidumist
    lisaBtn.onclick = null;

    lisaBtn.onclick = async () => {
        const emailEl = document.getElementById("uusEmail");
        const rollEl = document.getElementById("uusRoll");

        if (!emailEl || !rollEl) return;

        const email = emailEl.value.trim();
        const roll = rollEl.value;

        if (!email) {
            alert("Palun sisesta email");
            return;
        }

        const { error } = await sb
            .from("kasutajad")
            .insert({ email, roll });

        if (error) {
            alert("Viga lisamisel: " + error.message);
            console.error(error);
        } else {
            emailEl.value = "";
            laeKasutajad();
        }
    };
}

// Käivitamine
window.addEventListener("load", initKasutajateLeht);





