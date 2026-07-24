// kasutajad.js (MOODUL)
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

// Abifunktsioon kuupäeva vormindamiseks
function formatDate(ts) {
    if (!ts) return "Pole sisse loginud";
    return new Date(ts).toLocaleString("et-EE");
}

// ==========================================
//  INIT
// ==========================================
async function initKasutajateLeht() {
    // 1. Laeme sisselogitud kasutaja ja tema rolli (window.userRole)
    await kuvaKasutajaNimi();

    const accessError = document.getElementById("accessError");
    const sisu = document.getElementById("kasutajateSisu");
    const roll = window.userRole || "vaatleja";

    // ✅ LUBAME LIGIPÄÄSU nii superadminile kui tavalisele adminile
    if (roll !== "superadmin" && roll !== "admin") {
        if (accessError) accessError.style.display = "block";
        if (sisu) sisu.style.display = "none";
        return;
    }

    if (accessError) accessError.style.display = "none";
    if (sisu) sisu.style.display = "block";

    // ✅ KOHANDAME LISAMISE VALIKUID: Kui sisselogitu on tavaline admin, 
    // siis eemaldame uue kasutaja vormist valiku "superadmin"
    if (roll === "admin") {
        const uusRollSelect = document.getElementById("uusRoll");
        if (uusRollSelect) {
            const superOpt = uusRollSelect.querySelector('option[value="superadmin"]');
            if (superOpt) superOpt.remove();
        }
    }

    seoNupud();
    laeKasutajad();
}

// ==========================================
//  LAE KASUTAJAD NIMEKIRI
// ==========================================
async function laeKasutajad() {
    const tbody = document.querySelector("#kasutajaTabel tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "<tr><td colspan='4'>Laen kasutajaid...</td></tr>";

    // Küsime andmebaasist kasutajate nimekirja
    const { data, error } = await sb
        .from("kasutajad")
        .select("*")
        .order("email");

    if (error) {
        console.error("Viga kasutajate laadimisel:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Tõrge andmebaasist lugemisel: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    const praeguneKasutajaRoll = window.userRole;

    data.forEach(u => {
        const tr = document.createElement("tr");

        // ✅ TURVALISUSE REEGEL: Kui nimekirjas on superadmin, aga sisselogitu on tavaline admin,
        // siis lukustame selle rea, et admin ei saaks superadmini muuta ega kustutada!
        const onLukus = (praeguneKasutajaRoll === "admin" && u.roll === "superadmin");

        tr.innerHTML = `
            <td><strong>${u.email}</strong></td>
            <td>
                <select data-email="${u.email}" class="rollSelect" ${onLukus ? "disabled" : ""}>
                    ${praeguneKasutajaRoll === "superadmin" ? '<option value="superadmin">superadmin</option>' : ''}
                    <option value="admin">admin</option>
                    <option value="sisestaja">sisestaja</option>
                    <option value="vaatleja">vaatleja</option>
                </select>
            </td>
            <td>${formatDate(u.created_at)}</td>
            <td>
                <button class="kustutaBtn" data-email="${u.email}" ${onLukus ? "disabled" : ""}>Kustuta</button>
            </td>
        `;

        tbody.appendChild(tr);

        // Määrame rippmenüü vaikeväärtuseks andmebaasis oleva rolli
        const select = tr.querySelector(".rollSelect");
        if (u.roll && select) select.value = u.roll;
    });

    // --- SÜNDMUS: ROLLI MUUTMINE ---
    tbody.querySelectorAll(".rollSelect").forEach(sel => {
        sel.onchange = async () => {
            const email = sel.dataset.email;
            const uusRoll = sel.value;

            const { error } = await sb
                .from("kasutajad")
                .update({ roll: uusRoll })
                .eq("email", email);

            if (error) {
                alert("Viga rolli muutmisel: " + error.message);
            } else {
                alert(`Kasutaja ${email} rolliks on nüüd ${uusRoll}`);
            }
        };
    });

    // --- SÜNDMUS: KASUTAJA KUSTUTAMINE ---
    tbody.querySelectorAll(".kustutaBtn").forEach(btn => {
        btn.onclick = async () => {
            const email = btn.dataset.email;
            if (!confirm(`Kas kindlasti kustutada kasutaja ${email}?`)) return;

            const { error } = await sb
                .from("kasutajad")
                .delete()
                .eq("email", email);

            if (error) {
                alert("Viga kustutamisel: " + error.message);
            } else {
                laeKasutajad();
            }
        };
    });
}

// ==========================================
//  UUE KASUTAJA LISAMINE
// ==========================================
function seoNupud() {
    const lisaBtn = document.getElementById("lisaBtn");
    if (!lisaBtn) return;

    lisaBtn.onclick = null; // Eemaldame vana sündmused, et vältida topeltsidumist
    lisaBtn.onclick = async () => {
        const emailEl = document.getElementById("uusEmail");
        const rollEl = document.getElementById("uusRoll");

        if (!emailEl || !rollEl) return;

        const email = emailEl.value.trim().toLowerCase();
        const roll = rollEl.value;

        if (!email) {
            alert("Palun sisesta e-posti aadress!");
            return;
        }

        // Kirjutame uue rea ainult e-maili ja rolliga tabelisse "kasutajad"
        const { error } = await sb
            .from("kasutajad")
            .insert({ email, roll });

        if (error) {
            alert("Viga kasutaja lisamisel (võimalik, et see e-mail on juba nimekirjas): " + error.message);
        } else {
            emailEl.value = "";
            alert(`Kasutaja ${email} edukalt eelregistreeritud rolliga: ${roll}.`);
            laeKasutajad();
        }
    };
}

// Käivitamine
window.addEventListener("load", initKasutajateLeht);






