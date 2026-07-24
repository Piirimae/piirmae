import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Kontrolli, kas kasutaja on üldse Supabases sisse loginud
    const { data } = await sb.auth.getUser();
    if (!data?.user) {
        window.location = "index.html";
        return;
    }

    const email = data.user.email.toLowerCase().trim();

    // 2. Kuvame nime päises (ootame selle ära)
    await kuvaKasutajaNimi();

    // 3. TUVASTAME ROLLI: Küsime otse andmebaasist tabelist "kasutajad" värske info
    console.log("Küsin fuajee jaoks andmebaasist rolli kasutajale:", email);
    
    const { data: kasutajaKirje, error: dbError } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email)
        .maybeSingle(); // Turvalisem kui .single(), ei krahhi kui struktuur muutub

    if (dbError) {
        console.error("Viga andmebaasist rolli lugemisel fuajees:", dbError);
    }

    // Kui andmebaasist saadi roll, kasutame seda. Kui mitte, paneme vaatleja.
    const roll = kasutajaKirje ? kasutajaKirje.roll : "vaatleja";
    console.log("Fuajees tuvastatud rolliks sai:", roll);

    const toad = document.getElementById("toad");
    if (!toad) return;

    // 4. Joonistame toad vastavalt tuvastatud reaalsele rollile
    if (roll === "superadmin") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
            <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
            <div class="room-card" onclick="location='kasutajad.html'">👥 Kasutajate haldus</div>
        `;
    } else if (roll === "admin") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
            <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
        `;
    } else if (roll === "sisestaja") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
        `;
    } else {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kuuvaated.html'">📄 Kuuvaated</div>
        `;
    }

    // 5. Seome väljalogimise nupu
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
});










