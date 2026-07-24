// auth.js (MOODUL)
import { sb } from "./supabase.js";

export async function kuvaKasutajaNimi() {
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email.toLowerCase().trim();
    const uid = user.id;
    window.userName = email; 

    try {
        // Küsime andmebaasist nimekirja
        const { data: tulemus, error } = await sb
            .from("kasutajad")
            .select("roll, id")
            .eq("email", email);

        if (error) {
            console.error("Andmebaasi viga:", error);
            window.userRole = "vaatleja";
        } else if (tulemus && tulemus.length > 0) {
            // ✅ LEITUD: Võtame massiivi ESIMESE rea seest rolli [0] indeksiga
            window.userRole = tulemus[0].roll;

            // Kui andmebaasis pole veel selle kasutaja ID-d kirjas, salvestame selle tuleviku jaoks
            if (!tulemus[0].id) {
                await sb.from("kasutajad").update({ id: uid }).eq("email", email);
            }
        } else {
            window.userRole = "vaatleja";
        }
    } catch (e) {
        console.error("Tõrge auth süsteemis:", e);
        window.userRole = "vaatleja";
    }

    console.log(`[AUTH] Kasutaja ${email} rolliks määrati: ${window.userRole}`);

    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}

export async function laeRoll(email) {
    if (!email) return "vaatleja";
    const { data } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email.toLowerCase().trim());
        
    if (data && data.length > 0) return data[0].roll; // ✅ Parandatud massiivi indeks [0]
    return "vaatleja";
}

export async function logout() {
    await sb.auth.signOut();
    window.location = "index.html";
}














