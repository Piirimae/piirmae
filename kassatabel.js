import { sb } from "./supabase.js";
import { kuvaKasutajaNimi } from "./auth.js";

// DOM elemendid
const kuuValik = document.getElementById("kuuValik");
const lukustaNupp = document.getElementById("lukustaNupp");
const salvestaNupp = document.getElementById("salvestaNupp");
const arhiiviNupp = document.getElementById("arhiiviNupp");
const prindiNupp = document.getElementById("prindiNupp");
const laeAllaNupp = document.getElementById("laeAllaNupp");
const vaateReziim = document.getElementById("vaateReziim");
const tbody = document.getElementById("tbody");

// --- Režiimi tuvastamine ---
const url = new URL(window.location.href);
const parandaKuu = url.searchParams.get("paranda");
const parandaArhiiviId = url.searchParams.get("arhiiviId");
const onParandusRez = parandaKuu && parandaArhiiviId;

let tabelLukus = true;
let praeguneKuu = null;

// =========================
//  INIT KASSATABEL (Kutsutakse välja logic.js seest!)
// =========================
export async function laeAndmedJaLukustus() {
    console.log("KASSATABEL: logic.js lõpetas tabeli ehituse. Alustan andmete laadimist Supabasest...");

    // 1. Laeme kasutaja nime ja tuvastame rolli
    await kuvaKasutajaNimi();

    if (onParandusRez) {
        praeguneKuu = parandaKuu;
    } else {
        praeguneKuu = kuuValik ? kuuValik.value : "";
    }

    // 2. Laeme andmed Supabasest valitud kuu kohta
    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    console.log("KASSATABEL: Supabasest laetud andmed:", andmed);
    
    // 3. Täidame logic.js poolt valmis ehitatud tabeli sisendid andmetega
    täidaTabelSupabaseAndmetega(andmed);

    // 4. Seadistame nupud
    seadistaNupudJaLukustus();

    // 5. Kontrollime rolli õiguseid ja määrame lukustuse oleku
    const roll = window.userRole || "vaatleja";
    console.log("KASSATABEL: Kontrollin rolli õiguseid:", roll);

    if (roll === "superadmin" || roll === "admin" || roll === "sisestaja") {
        tabelLukus = false;
        rakendaLukustusOlek(false); // Avame tabeli superadminile/adminile/sisestajale
    } else {
        tabelLukus = true;
        rakendaLukustusOlek(true);  // Vaatlejale jääb lukku
    }

    // Sunnime logic.js-i summasid korraks üle arvutama laetud andmete põhjal
    setTimeout(() => {
        const esimeneInput = tbody.querySelector("input");
        if (esimeneInput) {
            esimeneInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }, 50);
}

// =========================
//  TABELI TÄITMINE
// =========================
function täidaTabelSupabaseAndmetega(andmed) {
    if (!andmed || andmed.length === 0) return;

    andmed.forEach(r => {
        const puhasKuupaev = r.kuupaev && r.kuupaev.includes("T") ? r.kuupaev.split("T")[0] : r.kuupaev;
        const tr = tbody.querySelector(`tr[data-date="${puhasKuupaev}"]`);
        if (!tr) return;

        const inputs = tr.querySelectorAll("input");
        inputs.forEach(inp => {
            const nimi = inp.dataset.veeruNimi;
            if (r[nimi] !== undefined && r[nimi] !== null) {
                inp.value = r[nimi];
            }
        });
    });
}

// =========================
//  SUPABASE PÄRINGUD
// =========================
async function laeKuuAndmedSupabasest(kuuId) {
    const { data, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("kuupaev");

    if (error) console.error("Viga andmete laadimisel:", error);
    return data || [];
}

function rakendaLukustusOlek(lukus) {
    tbody.querySelectorAll("input").forEach(inp => {
        inp.disabled = lukus;
    });

    if (lukustaNupp) {
        lukustaNupp.textContent = lukus ? "Tabel lukus (ava sisestamiseks)" : "Tabel avatud (lukusta)";
    }
}

// ✅ UUENDATUD JA PUHASTATUD FUNKTSIOON KASSATABEL.JS SEES:
function seadistaNupudJaLukustus() {
    // 1. Tavaline reaalne salvestamine (Ei mingeid paranduse modaleid!)
    if (salvestaNupp) {
        salvestaNupp.onclick = async () => {
            // Siia läheb Sinu reaalne elava kuu andmete salvestamise käsk Supabasse,
            // mille me saame vajadusel järgmisena korda teha!
            alert("Käivitan elava kuu andmete salvestamise põhitabelisse...");
        };
    }

    // 2. Lukustamise nupu loogika jääb samaks
    if (lukustaNupp) {
        lukustaNupp.onclick = () => {
            tabelLukus = !tabelLukus;
            rakendaLukustusOlek(tabelLukus);
        };
    }

    // 3. Prindi nupp töötab alati
    if (prindiNupp) prindiNupp.onclick = () => window.print();
    
    // 4. Teised nupud, mis on ootel
    if (laeAllaNupp) laeAllaNupp.onclick = () => alert("PDF raporti allalaadimine on arenduses.");
}


async function salvestaParandatudArhiiv() {
    // Teie olemasolev salvestamise loogika...
}

// =========================================================================
// ✅ SÜNKRONISEERITUD PRINTIMISE KÄSITLEMINE (Ühildatud logic.js-i täitmisega)
// =========================================================================
window.addEventListener("beforeprint", () => {
    let valitudTekst = "";
    
    // 🔧 LAHENDUS: Kuna logic.js loob lennult üheainsa option elemendi, loeme teksti otse sealt seest!
    if (kuuValik && kuuValik.firstElementChild) {
        valitudTekst = kuuValik.firstElementChild.textContent; // See saab kätte puhtalt nt "juuli 2026"
    }
    
    // Kui option on mingil põhjusel veel tühi, teeme ilusa varuvariandi globaalsest muutujast
    if (!valitudTekst && praeguneKuu) {
        valitudTekst = `Kuu ${praeguneKuu}`;
    }
    
    const printTitle = document.getElementById("printTitle");
    if (printTitle && valitudTekst) {
        // Tagab pealkirja täpselt Sinu soovitud formaadis: juuli 2026 – Kassatabel
        printTitle.textContent = `${valitudTekst} – Kassatabel`;
    }

    // Peidame ekraaniteated ja vaaterežiimi kasti, et nad paberil ruumi ei raiskaks
    const vReziim = document.getElementById("vaateReziim");
    const rTeade = document.getElementById("reziimiTeade");
    if (vReziim) vReziim.style.display = "none";
    if (rTeade) rTeade.style.display = "none";

    // Muudame kõik sisendkastid prindi ajaks puhtaks tekstiks
    document.querySelectorAll("td input").forEach(inp => {
        const span = document.createElement("span");
        span.textContent = inp.value;
        span.classList.add("print-value");
        inp.dataset.wasVisible = "true";
        inp.style.display = "none";
        inp.parentNode.appendChild(span);
    });
});

window.addEventListener("afterprint", () => {
    // Toome ekraaniteated ja vaaterežiimid pärast printimist ekraanile tagasi
    const vReziim = document.getElementById("vaateReziim");
    const rTeade = document.getElementById("reziimiTeade");
    if (vReziim) vReziim.style.display = "block";
    if (rTeade) rTeade.style.display = "block";

    // Taastame algsed muudetavad sisendkastid täpselt samasse kohta
    document.querySelectorAll(".print-value").forEach(span => span.remove());
    document.querySelectorAll("td input").forEach(inp => {
        if (inp.dataset.wasVisible === "true") {
            inp.style.display = "";
            inp.removeAttribute("data-was-visible");
        }
    });
});













