import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Kontrolli sisselogimist Supabases
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) {
        window.location = "index.html";
        return;
    }

    const email = userData.user.email.toLowerCase().trim();
    console.log("1. Fuajee tuvastas e-maili:", email);

    // 2. Kuva nimi päises
    await kuvaKasutajaNimi();

    // 3. PÄRING ANDMEBAASI
    const { data: kasutajadMassiiv, error: dbError } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email);

    if (dbError) {
        console.error("KRIITILINE VIGA: Andmebaas keeldus vastamast:", dbError);
    }

    console.log("2. Andmebaasist saabus otse selline massiiv:", kasutajadMassiiv);

    // 4. ✅ PARANDATUD: Võtame massiivi ESIMESE elemendi [0] seest rolli
    let roll = "vaatleja";
    if (kasutajadMassiiv && kasutajadMassiiv.length > 0) {
        roll = kasutajadMassiiv[0].roll; // Enne oli siin viga (puudus [0])
    }

    console.log("3. Fuajees kasutusele võetav roll:", roll);

    const toad = document.getElementById("toad");
    if (!toad) return;

    // 5. Joonistame toad vastavalt rollile
    // fuajee.js täiendus superadminile ja adminile:
if (roll === "superadmin") {
    toad.innerHTML = `
        <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
        <div class="room-card" onclick="location='pulss.html'">📈 Piirimäe Pulss</div> <!-- ✅ LISATUD -->
        <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
        <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
        <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
        <div class="room-card" onclick="location='kasutajad.html'">👥 Kasutajate haldus</div>
    `;
} else if (roll === "admin") {
    toad.innerHTML = `
        <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
        <div class="room-card" onclick="location='pulss.html'">📈 Piirimäe Pulss</div> <!-- ✅ LISATUD -->
        <div class="room-card" onclick="location='arhiiv.html'">📁 Arhiiv</div>
        <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
        <div class="room-card" onclick="location='seaded.html'">🔧 Seaded</div>
    `;
    } else if (roll === "sisestaja") {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kassatabel.html'">📊 Kassatabel</div>
            <div class="room-card" onclick="location='pulss.html'">📈 Piirimäe Pulss</div>
            <div class="room-card" onclick="location='logid.html'">🧾 Logid</div>
        `;
    } else {
        toad.innerHTML = `
            <div class="room-card" onclick="location='kuuvaated.html'">📄 Kuuvaated</div>
        `;
    }
// ✅ TURVALUKK FUAJEES: Avaneb uks ainult juhtkonnale
if (roll === "superadmin" || roll === "admin") {
    const menyyBtn = document.getElementById("menyyHaldusBtn");
    if (menyyBtn) menyyBtn.style.display = "block"; // või "inline-block", olenevalt Teie stiilist
}

    // 6. Seome väljalogimise nupu
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
});










