
// kasutajad.js (MOODUL)
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll } from "./auth.js"; // 👈 LISATUD: laeRoll siia juurde


function formatDate(ts) {
    if (!ts) return "Pole veel sisse loginud";
    return new Date(ts).toLocaleString("et-EE");
}

// --- Kohalik logimise funktsioon (sünkroniseeritud teiste lehtedega) ---
async function logiTegevusSupabasse(tegevus, detailid = {}) {
    const { data: userData } = await sb.auth.getUser();
    const userEmail = userData?.user?.email || null;
    await sb.from("logid").insert({ tegevus, detailid, user_email: userEmail });
}

// ==========================================
//  INIT
// ==========================================
async function initKasutajateLeht() {
    await kuvaKasutajaNimi(); // See paneb window.userName paika

    const accessError = document.getElementById("accessError");
    const sisu = document.getElementById("kasutajateSisu");
    
    // 🔒 PÄRIME ROLLI OTSE ANDMEBAASIST, et vältida konsoolis petmist
    const roll = await laeRoll(window.userName);
    window.userRole = roll; // Uuendame igaks juhuks ka akna muutujat

    if (roll !== "superadmin" && roll !== "admin") {
        if (accessError) accessError.style.display = "block";
        if (sisu) sisu.style.display = "none";
        return;
    }
   


    if (accessError) accessError.style.display = "none";
    if (sisu) sisu.style.display = "block";

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
    // 🔒 TURVAKONTROLL: Kui pole admin või superadmin, ära hakka andmeid laadimagi
    const roll = window.userRole || "vaatleja";
    if (roll !== "superadmin" && roll !== "admin") {
        console.error("Blokeeritud: Puuduvad õigused andmete laadimiseks.");
        return;
    }
    const tbody = document.querySelector("#kasutajaTabel tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "<tr><td colspan='4'>Laen kasutajate nimekirja...</td></tr>";

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
                // ✅ LISATUD: Logime rolli muutuse tegevuse (nt superadmin muutis teise kasutaja rolli)
                await logiTegevusSupabasse("muuda_kasutajaroll", { email: email, uusRoll: uusRoll });
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
                // ✅ PARANDATUD: Logime õige tegevuse "-kasutaja"
                await logiTegevusSupabasse("-kasutaja", { email: email });
                laeKasutajad();
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

    lisaBtn.onclick = null;
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

        const { error } = await sb
            .from("kasutajad")
            .insert({ email, roll });

        if (error) {
            alert("Viga lisamisel (võimalik, et see email on juba nimekirjas): " + error.message);
            console.error(error);
        } else {
            emailEl.value = "";
            
            // ✅ PARANDATUD: Logime õige tegevuse "+kasutaja" korrektsete muutujatega
            await logiTegevusSupabasse("+kasutaja", { email: email, roll: roll });
            
            alert(`Kasutaja ${email} edukalt eelregistreeritud rolliga ${roll}!`);
            laeKasutajad();
        }
    };
}

window.addEventListener("load", initKasutajateLeht);








