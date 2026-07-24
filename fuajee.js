import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll, logout } from "./auth.js";

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Kontrolli sisselogimist
    const { data } = await sb.auth.getUser();
    if (!data?.user) {
        window.location = "index.html";
        return;
    }

    // 2. Kuva nimi päises
    try {
        await kuvaKasutajaNimi();
    } catch (e) {
        console.error("Nime kuvamise viga:", e);
    }

    const email = data.user.email;
    const roll = window.userRole || (await laeRoll(email));

    const toad = document.getElementById("toad");
    if (!toad) return;

    // 3. Kuvame toad vastavalt rollile
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

    // 4. Seome väljalogimise nupu, kui see on lehel olemas
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
});










