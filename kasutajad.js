// kasutajad.js (MOODUL)
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

function formatDate(ts) {
    if (!ts) return "Pole veel sisse loginud";
    return new Date(ts).toLocaleString("et-EE");
}

// ==========================================
//  INIT
// ==========================================
async function initKasutajateLeht() {
    // 1. Laeme sisselogitud kasutaja ja tuvastame rolli
    await kuvaKasutajaNimi();

    const accessError = document.getElementById("accessError");
    const sisu = document.getElementById("kasutajateSisu");
    const roll = window.userRole || "vaatleja";

    // Lubame ligipääsu ainult superadminile ja adminile
    if (roll !== "superadmin" && roll !== "admin") {
        if (accessError) accessError.style.display = "block";
        if (sisu) sisu.style.display = "none";
        return;
    }

    if (accessError) accessError.style.display = "none";
    if (sisu) sisu.style.display = "block";

    // ✅ TURVALISUS: Kui sisselogitu on tavaline admin, peidame rippmenüüst valiku "superadmin"
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
    
    tbody.innerHTML = "<tr><td colspan='4'>Laen kasutajate nimekirja...</td></tr>";

    // Küsime andmebaasist kasutajate nimekirja e-maili järgi järjekorras
    const { data, error } = await sb
        .from("kasutajad")
        .select("*")
        .order("email");

    if (error) {
        console.error("Viga kasutajate laadimisel:", error);
        tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Viga andmebaasist lugemisel: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">Kasutajaid ei ole registreeritud.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    const praeguneKasutajaRoll = window.userRole;

    data.forEach(u => {
        const tr = document.createElement("tr");

        // ✅ TURVALISUSE REEGEL: Tavaline admin ei tohi superadmini rida muuta ega kustutada
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

        const select = tr.querySelector(".rollSelect");
        if (u.roll && select) select.value = u.roll;
    });

    // --- ROLLI MUUTMISE KUULAJA ---
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
                alert(`Kasutaja ${email} uueks rolliks määrati: ${uusRoll}`);
            }
        };
    });

    // --- KUSTUTAMISE KUULAJA ---
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
                // lisaBtn.onclick sisse pärast edukat inserti:
await logiTegevus("+kasutaja", { email: email, roll: roll });

            }
        };
    });
}

// ==========================================
//  NUPPUDE SIDUMINE (LISAMINE)
// ==========================================
function seoNupud() {
    const lisaBtn = document.getElementById("lisaBtn");
    if (!lisaBtn) return;

    lisaBtn.onclick = null; // Eemaldame vana onclick sündmuse
    lisaBtn.onclick = async () => {
        const emailEl = document.getElementById("uusEmail");
        const rollEl = document.getElementById("uusRoll");

        if (!emailEl || !rollEl) {
            console.error("Viga: HTML-is puuduvad sisendväljad id-ga uusEmail või uusRoll!");
            return;
        }

        const email = emailEl.value.trim().toLowerCase();
        const roll = rollEl.value;

        if (!email) {
            alert("Palun sisesta e-posti aadress!");
            return;
        }

        // Saadame andmed otse Supabase tabelisse "kasutajad"
        const { error } = await sb
            .from("kasutajad")
            .insert({ email, roll });

        if (error) {
            alert("Viga lisamisel (võimalik, et see email on juba nimekirjas): " + error.message);
            console.error(error);
        } else {
            emailEl.value = ""; // Tühjendame kasti pärast edukat lisamist
            alert(`Kasutaja ${email} edukalt eelregistreeritud rolliga ${roll}!`);
            laeKasutajad(); // Värskendame tabelit automaatselt, et uus kasutaja ilmuks ritta
           // lisaBtn.onclick sisse pärast edukat inserti:
await logiTegevus("+kasutaja", { email: email, roll: roll });
 
        }
    };
}

window.addEventListener("load", initKasutajateLeht);







