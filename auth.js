// auth.js

// Kuvab kasutaja nime ja laeb rolli "kasutajad" tabelist
async function kuvaKasutajaNimi() {
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









