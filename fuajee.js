// fuajee.js
// Fuajee loogika, mis kasutab rolli kasutajate tabelist

(async () => {
    const { data } = await sb.auth.getUser();
    if (!data?.user) {
        window.location = "index.html";
        return;
    }

    // Kuvame päises kasutaja nime + rolli ja seame window.userRole
    await kuvaKasutajaNimi();

    const email = data.user.email;
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

    // SUPER (kui soovid seda rolli kasutada)
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




