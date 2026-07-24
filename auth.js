// auth.js (Katkend funktsioonist kuvaKasutajaNimi)
export async function kuvaKasutajaNimi() {
    const { data } = await sb.auth.getUser();
    const user = data?.user;

    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email;
    const uid = user.id; // Supabase süsteemne UUID
    window.userName = email;

    try {
        // 1. Otsime kasutajat e-maili järgi
        let { data: kasutaja, error } = await sb
            .from("kasutajad")
            .select("*")
            .eq("email", email)
            .maybeSingle(); // maybeSingle ei viska viga, kui rida pole

        // 2. KUI KASUTAJA ON ADMINI POOLT LISATUD, AGA ID ON TÜHI -> SEOME ID ÄRA
        if (kasutaja && !kasutaja.id) {
            await sb
                .from("kasutajad")
                .update({ id: uid })
                .eq("email", email);
            kasutaja.id = uid; // Uuendame objekti mälus
        }

        // 3. Kui kasutajat pole üldse tabelis, teeme temast automaatselt vaatleja
        if (!kasutaja) {
            const { data: uusKasutaja } = await sb
                .from("kasutajad")
                .insert({ id: uid, email: email, roll: "vaatleja" })
                .select()
                .single();
            kasutaja = uusKasutaja;
        }

        window.userRole = kasutaja ? kasutaja.roll : "vaatleja";

    } catch (dbError) {
        console.error("Viga rolli kontrollimisel:", dbError);
        window.userRole = "vaatleja";
    }

    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}














