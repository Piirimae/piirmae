// auth.js (MOODUL)

// Supabase ühendus
import { sb } from "./supabase.js";

// --- Kuvab kasutaja nime ja laeb rolli ---
export async function kuvaKasutajaNimi() {
    const { data } = await sb.auth.getUser();
    const user = data?.user;

    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email;

    // LOEME ROLLI KASUTAJAD TABELIST
    const { data: kasutaja, error } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email)
        .single();

    if (error || !kasutaja) {
        window.userRole = "vaatleja";
    } else {
        window.userRole = kasutaja.roll;
    }

    // Kuvame nime
    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}

// --- Lae roll otse ---
export async function laeRoll(email) {
    const { data, error } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email)
        .single();

    return error ? "vaatleja" : data.roll;
}

// --- Logi välja ---
export async function logout() {
    await sb.auth.signOut();
    window.location = "index.html";
}











