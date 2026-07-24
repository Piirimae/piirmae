// kasutajad.js (Uuendatud ligipääsu loogika)
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

function formatDate(ts) {
    if (!ts) return "Pole veel sisse loginud";
    return new Date(ts).toLocaleString("et-EE");
}

async function initKasutajateLeht() {
    await kuvaKasutajaNimi();

    const accessError = document.getElementById("accessError");
    const sisu = document.getElementById("kasutajateSisu");

    const roll = window.userRole || "vaatleja";

    // ✅ LUBAME LIGIPÄÄSU nii superadminile kui adminile
    if (roll !== "superadmin" && roll !== "admin") {
        if (accessError) accessError.style.display = "block";
        if (sisu) sisu.style.display = "none";
        return;
    }

    if (accessError) accessError.style.display = "none";
    if (sisu) sisu.style.display = "block";

    // Kui sisselogitud on tavaline admin, kohandame uue kasutaja lisamise valikuid
    if (roll === "admin") {
        const uusRollSelect = document.getElementById("uusRoll");
        if (uusRollSelect) {
            // Eemaldame võimaluse adminil luua superadmineid
            const superOpt = uusRollSelect.querySelector('option[value="superadmin"]');
            if (superOpt) superOpt.remove();
        }
    }

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
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Viga laadimisel: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    const praeguneKasutajaRoll = window.userRole;

    data.forEach(u => {
        const tr = document.createElement("tr");

        // ✅ Kui nimekirjas on superadmin, aga sisselogitu on tavaline admin, 
        // siis lukustame valiku, et admin ei saaks superadmini muuta ega kustutada
        const onLukus = praeguneKasutajaRoll === "admin" && u.roll === "superadmin";

        tr.innerHTML = `
            <td>${u.email}</td>
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

        const select = tr.querySelector(".rollSelect");
        if (u.roll && select) select.value = u.roll;
    });

    // Muutmise loogika e-maili põhjal (sest uutel kasutajatel pole veel ID-d!)
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
                alert("Roll edukalt muudetud!");
            }
        };
    });

    // Kustutamise loogika e-maili põhjal
    tbody.querySelectorAll(".kustutaBtn").forEach(btn => {
        btn.onclick = async () => {
            const email = btn.dataset.email;
            if (!confirm(`Kas kustutada kasutaja ${email}?`)) return;

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

function seoNupud() {
    const lisaBtn = document.getElementById("lisaBtn");
    if (!lisaBtn) return;

    lisaBtn.onclick = null;
    lisaBtn.onclick = async () => {
        const emailEl = document.getElementById("uusEmail");
        const rollEl = document.getElementById("uusRoll");

        if (!emailEl || !rollEl) return;

        const email = emailEl.value.trim().toLowerCase();
        const roll = rollEl.value;

        if (!email) {
            alert("Palun sisesta email");
            return;
        }

        // Lisame rea ainult e-maili ja rolliga. ID jääb esialgu nulliks.
        const { error } = await sb
            .from("kasutajad")
            .insert({ email, roll });

        if (error) {
            alert("Viga lisamisel (võimalik, et see email on juba olemas): " + error.message);
        } else {
            emailEl.value = "";
            alert(`Kasutaja ${email} lisatud rolliga ${roll}. Süsteem seob tema konto esimesel sisselogimisel.`);
            laeKasutajad();
        }
    };
}

window.addEventListener("load", initKasutajateLeht);





