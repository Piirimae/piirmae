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
        toad.innerHTML = `...`;
        return;
    }

    if (roll === "admin") {
        toad.innerHTML = `...`;
        return;
    }

    if (roll === "sisestaja") {
        toad.innerHTML = `...`;
        return;
    }

    toad.innerHTML = `<div class="room-card" onclick="location='kuuvaated.html'">📄 Kuuvaated</div>`;
})();








