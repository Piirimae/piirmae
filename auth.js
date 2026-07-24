// auth.js (MOODUL)
import { sb } from "./supabase.js";

// --- Kuvab kasutaja nime ja laeb rolli kõigi lehtede jaoks ---
export async function kuvaKasutajaNimi() {
    // 1. Küsime Supabaselt sisselogitud kasutaja infot
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    // Kui kasutaja pole sisse loginud, suuname kohe esilehele
    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email.toLowerCase().trim();
    window.userName = email; // Vajalik salvestamisteks

    try {
        // 2. Küsime tabelist "kasutajad" massiivi (nimekirja) selle e-maili kohta
        const { data: tulemus, error } = await sb
            .from("kasutajad")
            .select("roll")
            .eq("email", email);

        if (error) {
            console.error("Viga andmebaasist rolli lugemisel:", error);
            window.userRole = "vaatleja";
        } else if (tulemus && tulemus.length > 0) {
            // ✅ LEITUD: Määrame akna mällu andmebaasis oleva tegeliku rolli
            window.userRole = tulemus[0].roll;
        } else {
            // Kui e-maili andmebaasis pole, on ta vaikimisi vaatleja
            window.userRole = "vaatleja";
        }
    } catch (e) {
        console.error("Viga auth süsteemis:", e);
        window.userRole = "vaatleja";
    }

    console.log(`[AUTH] Kasutaja ${email} rolliks määrati: ${window.userRole}`);

    // Kuvame e-maili veebilehe päises asuvasse kasti
    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}

// --- Abifunktsioon otse laadimiseks ---
export async function laeRoll(email) {
    if (!email) return "vaatleja";
    const { data } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email.toLowerCase().trim());
        
    if (data && data.length > 0) return data[0].roll;
    return "vaatleja";
}

// --- Logi välja ---
export async function logout() {
    await sb.auth.signOut();
    window.location = "index.html";
}














