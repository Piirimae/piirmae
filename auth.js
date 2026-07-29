// auth.js (MOODUL)
import { sb } from "./supabase.js";

export async function kuvaKasutajaNimi() {
    const { data: userData } = await sb.auth.getUser();
    const user = userData?.user;

    if (!user) {
        window.location = "index.html";
        return;
    }

    const email = user.email.toLowerCase().trim();
    const uid = user.id;
    window.userName = email; 

    try {
        // Küsime andmebaasist nimekirja
        const { data: tulemus, error } = await sb
            .from("kasutajad")
            .select("roll, id")
            .eq("email", email);

        if (error) {
            console.error("Andmebaasi viga:", error);
            window.userRole = "vaatleja";
        } else if (tulemus && tulemus.length > 0) {
            // ✅ LEITUD: Võtame massiivi ESIMESE rea seest rolli [0] indeksiga
            window.userRole = tulemus[0].roll;

            // Kui andmebaasis pole veel selle kasutaja ID-d kirjas, salvestame selle tuleviku jaoks
            if (!tulemus[0].id) {
                await sb.from("kasutajad").update({ id: uid }).eq("email", email);
            }
        } else {
            window.userRole = "vaatleja";
        }
    } catch (e) {
        console.error("Tõrge auth süsteemis:", e);
        window.userRole = "vaatleja";
    }

    console.log(`[AUTH] Kasutaja ${email} rolliks määrati: ${window.userRole}`);

    const elem = document.getElementById("kasutajaNimi");
    if (elem) elem.textContent = email;
}

export async function laeRoll(email) {
    if (!email) return "vaatleja";
    const { data } = await sb
        .from("kasutajad")
        .select("roll")
        .eq("email", email.toLowerCase().trim());
        
    if (data && data.length > 0) return data[0].roll; // ✅ Parandatud massiivi indeks [0]
    return "vaatleja";
}

const { data: tulemus, error: selErr } = await sb
  .from("kasutajad")
  .select("roll, id")
  .eq("email", email);

if (selErr) console.error(selErr);

if (tulemus && tulemus[0] && !tulemus[0].id) {
  const { error: upErr } = await sb
    .from("kasutajad")
    .update({ id: uid })
    .eq("email", email);

  if (upErr) console.error("UPDATE fail:", upErr);
}
const { data: tulemus, error: selErr } = await sb
  .from("kasutajad")
  .select("roll, id")
  .eq("email", email);

console.log("SELECT err", selErr, "rows", tulemus);

if (tulemus?.[0]?.id == null) {
  const { error: upErr } = await sb
    .from("kasutajad")
    .update({ id: uid })
    .eq("email", email);

  console.log("UPDATE err", upErr);
}
export async function logout() {
    await sb.auth.signOut();
    window.location = "index.html";
}
// auth.js (Lisa faili lõppu)
export async function logiTegevus(tegevus, detailid = {}) {
    try {
        const { data: userData } = await sb.auth.getUser();
        const userEmail = userData?.user?.email || "tundmatu";

        const { error } = await sb
            .from("logid")
            .insert({
                tegevus: tegevus,
                detailid: detailid,
                user_email: userEmail,
                timestamp: new Date().toISOString()
            });

        if (error) console.error("Viga tegevuse logimisel Supabasesse:", error);
    } catch (err) {
        console.error("Viga logiTegevus funktsioonis:", err);
    }
}
// =========================================================================
// 📺 GLOBAALNE TÄISEKRAANI NUPUKE (Kõigile 9 lehele)
// =========================================================================
(function() {
    const fsBtn = document.createElement("button");
    fsBtn.id = "globaalneMobiilFullscreenBtn";
    fsBtn.innerHTML = "📺"; 
    
    // Stiilid mittehäirivaks nupuks
    Object.assign(fsBtn.style, {
        position: "fixed", top: "8px", right: "8px", zIndex: "999999",
        padding: "6px", background: "rgba(0,0,0,0.5)", color: "white", 
        border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px"
    });

    document.body.appendChild(fsBtn);

    // Täisekraani loogika
    fsBtn.onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };
})();














