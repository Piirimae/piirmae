import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll, logout } from "./auth.js";

(async () => {
    const { data } = await sb.auth.getUser();
    if (!data?.user) {
        window.location = "index.html";
        return;
    }

    await kuvaKasutajaNimi();

    const email = data.user.email;
    const roll = window.userRole || (await laeRoll(email));

    const toad = document.getElementById("toad");

    if (roll === "superadmin") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
            <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
            <div class="room-card" onclick="location='kasutajad.html'">👥 Kasutajate haldus</div>
        `;
        return;
    }

    if (roll === "admin") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
            <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
        `;
        return;
    }

    if (roll === "sisestaja") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
        `;
        return;
    }

    toad.innerHTML = `
        <div class="room-card" onclick="location='kuuvaated.html'">📄 Kuuvaated</div>
    `;
})();










