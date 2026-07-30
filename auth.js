// auth.js (MOODUL) - RAUDNE LUKK VÕÕRASTELE JA USER ROLLILE
import { sb } from "./supabase.js";

export async function kuvaKasutajaNimi() {
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    // Kui üldse sisse logitud pole, kohe minema avalehele
    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email.toLowerCase().trim();
    const uid = user.id;
    window.userName = email; 

    try {
        // Küsime andmebaasist selle meili rida
        const { data: tulemus, error } = await sb
            .from("kasutajad")
            .select("roll, id")
            .eq("email", email);

        if (error) {
            console.error("Andmebaasi viga:", error);
            window.userRole = "blokeeritud";
            await vigaJaValja("Andmebaasi tõrge! Ligipääs keelatud.");
            return;
        } 
        
        // 🔒 KONTROLL 1: Kui seda meili pole üldse administraatori nimekirjas olemaski
        if (!tulemus || tulemus.length === 0) {
            console.warn(`[TURVALISUS] Tundmatu meil püüdis sisse ronida: ${email}`);
            window.userRole = "blokeeritud";
            await vigaJaValja("Sinu e-posti aadress ei ole süsteemis registreeritud! Ligipääs rangelt keelatud.");
            return;
        }

        const leitudRoll = tulemus[0].roll;

        // 🔒 KONTROLL 2: Sinu mure koht! Kui roll on "user" või tühi, siis EI LASE edasi!
        // Süsteemi pääsevad AINULT lubatud sisemised rollid.
        if (leitudRoll === "user" || leitudRoll === "vaatleja" || !leitudRoll) {
            console.warn(`[TURVALISUS] Kasutaja ${email} rolliga '${leitudRoll}' blokeeriti sisenemisel.`);
            window.userRole = "blokeeritud";
            await vigaJaValja(`Sul on roll '${leitudRoll || 'puudub'}'. Sul puudub õigus sellesse süsteemi siseneda!`);
            return;
        }

        // ✅ KUI JÕUAB SIIA, on tegu õige inimesega (superadmin, admin, sisestaja vms)
        window.userRole = leitudRoll;

        // Kui andmebaasis pole veel selle kasutaja ID-d kirjas, salvestame selle tuleviku jaoks
        if (!tulemus[0].id) {
            await sb.from("kasutajad").update({ id: uid }).eq("email", email);
        }

    } catch (e) {
        console.error("Tõrge auth süsteemis:", e);
        window.userRole = "blokeeritud";
        await vigaJaValja("Süsteemne tõrge! Sind suunatakse välja.");
        return;
    }

    console.log(`[AUTH] Kasutaja ${email} rolliks määrati: ${window.userRole}`);

    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}

// 🛑 ABIFUNKTSIOON: Puhastab sessiooni ja viskab tondi minema
async function vigaJaValja(teade) {
    alert(teade);
    await sb.auth.signOut(); // Kustutab sisselogimise tokeni Supabase'ist
    window.location = "https://index.html"; // Võid siia panna ka google.com või mis iganes suvalise lehe linki
}

export async function laeRoll(email) {
    if (!email) return "blokeeritud";
    const { data } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email.toLowerCase().trim());
        
    if (data && data.length > 0) {
        const r = data[0].roll;
        if (r === "user" || r === "vaatleja") return "blokeeritud";
        return r;
    }
    return "blokeeritud";
}

export async function logout() {
    await sb.auth.signOut();
    window.location = "index.html";
}

export async function logiTegevus(tegevus, detailid = {}) {
    try {
        const { data: userData } = await sb.auth.getUser();
        const userEmail = userData?.user?.email || "tundmatu";

        await sb.from("logid").insert({
            tegevus: tegevus,
            detailid: detailid,
            user_email: userEmail,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Viga logiTegevus funktsioonis:", err);
    }
}

// =========================================================================
// 📺 GLOBAALNE TÄISEKRAANI NUPUKE
// =========================================================================
(function() {
    if (document.getElementById("globaalneMobiilFullscreenBtn")) return;
    const fsBtn = document.createElement("button");
    fsBtn.id = "globaalneMobiilFullscreenBtn";
    fsBtn.innerHTML = "📺"; 
    Object.assign(fsBtn.style, {
        position: "fixed", top: "8px", right: "8px", zIndex: "999999",
        padding: "6px", background: "rgba(0,0,0,0.5)", color: "white", 
        border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px"
    });
    document.body.appendChild(fsBtn);
    fsBtn.onclick = () => {
        if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); } 
        else { document.exitFullscreen(); }
    };
})();
















