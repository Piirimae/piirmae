// auth.js (MOODUL)

// Supabase ühendus
import { sb } from "./supabase.js";

// --- Kuvab kasutaja nime ja laeb rolli ---
export async function kuvaKasutajaNimi() {
    let user = null;
    
    try {
        const { data, error } = await sb.auth.getUser();
        if (error) throw error;
        user = data?.user;
    } catch (authError) {
        console.error("Autentimise andmete hankimine ebaõnnestus:", authError);
        window.location = "index.html";
        return;
    }

    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email;
    window.userName = email; // Vajalik kassatabel.html paranduse salvestamiseks

    // LOEME ROLLI KASUTAJAD TABELIST (Turvatud try-catch plokiga)
    try {
        const { data: kasutaja, error } = await sb
            .from("kasutajad")
            .select("roll")
            .eq("email", email)
            .single();

        // Kui andmebaasist tuli loogiline viga (nt kasutajat pole)
        if (error || !kasutaja) {
            console.warn("Kasutaja rolli ei leitud, määratakse 'vaatleja':", error);
            window.userRole = "vaatleja";
        } else {
            window.userRole = kasutaja.roll;
        }
    } catch (dbError) {
        // Püüab kinni HTTP 500 serverivead ja hoiab ära koodi krahhi
        console.error("Kriitiline Supabase andmebaasi viga (HTTP 500) rolli laadimisel:", dbError);
        window.userRole = "vaatleja"; 
    }

    // Kuvame nime liideses
    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}

// --- Lae roll otse ---
export async function laeRoll(email) {
    try {
        const { data, error } = await sb
            .from("kasutajad")
            .select("roll")
            .eq("email", email)
            .single();

        if (error || !data) return "vaatleja";
        return data.roll;
    } catch (e) {
        console.error("Viga laeRoll funktsioonis:", e);
        return "vaatleja";
    }
}

// --- Logi välja ---
export async function logout() {
    try {
        await sb.auth.signOut();
    } catch (e) {
        console.error("Väljalogimise viga:", e);
    }
    window.location = "index.html";
}

// Lisa event listener ainult siis, kui nupp on olemas
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}














