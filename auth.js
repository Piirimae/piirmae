// auth.js (MOODUL)
import { sb } from "./supabase.js";

// --- Kuvab kasutaja nime ja laeb rolli kõigi lehtede jaoks ---
export async function kuvaKasutajaNimi() {
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email.toLowerCase().trim();
    window.userName = email; 

    try {
        const { data: tulemus, error } = await sb
            .from("kasutajad")
            .select("roll")
            .eq("email", email);

        if (error) {
            console.error("Viga andmebaasist rolli lugemisel:", error);
            window.userRole = "vaatleja";
        } else if (tulemus && tulemus.length > 0) {
            // ✅ PARANDATUD: Võtame massiivi ESIMESE rea seest rolli [0]
            window.userRole = tulemus[0].roll;
        } else {
            window.userRole = "vaatleja";
        }
    } catch (e) {
        console.error("Viga auth süsteemis:", e);
        window.userRole = "vaatleja";
    }

    console.log(`[AUTH] Kasutaja ${email} rolliks määrati: ${window.userRole}`);

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
        
    // ✅ PARANDATUD: Võtame massiivi ESIMESE rea seest rolli [0]
    if (data && data.length > 0) return data[0].roll; 
    return "vaatleja";
}

// --- Logi välja ---
export async function logout() {
    await sb.auth.signOut();
    window.location = "index.html";
}














