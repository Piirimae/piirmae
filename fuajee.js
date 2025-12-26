import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll, logout } from "./logic.js";

(async () => {
    // Kontrollime, kas kasutaja on sisse logitud
    const { data: userData } = await sb.auth.getUser();

    if (!userData?.user) {
        window.location = "index.html";
        return;
    }

    // Kuvame kasutaja nime päises
    await kuvaKasutajaNimi();

    const email = userData.user.email;
    const roll = window.userRole || (await laeRoll(email));

    const toad = document.getElementById("toad");
    if (!toad) return;

    // SUPERADMIN
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

    // SUPER
    if (roll === "super") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
            <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
            <div class="room-card" onclick="location='kasutajad.html'">👥 Kasutajate haldus</div>
        `;
        return;
    }

    // ADMIN
    if (roll === "admin") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
            <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
        `;
        return;
    }

    // SISESTAJA
    if (roll === "sisestaja") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
        `;
        return;
    }

    // VAATLEJA (või tundmatu roll)
    toad.innerHTML = `
        <div class="room-card" onclick="location='kuuvaated.html'">📄 Kuuvaated</div>
    `;
})();






