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
// ✅ POMMIKINDEL PRINTIMISE KÄSITLEMINE (Eesti formaadis PP.KK.AAAA jaoks)
// =========================================================================
window.addEventListener("beforeprint", () => {
    const h2Pealkiri = document.querySelector("h2");
    
    if (h2Pealkiri) {
        let kuuJaAastaTekst = "";

        // Otsime tabeli esimest rida, millel on olemas kuupäeva atribuut (data-date)
        const esimeneRida = document.querySelector("tbody tr[data-date]");
        
        // 🔧 LAHENDUS: Kui tabeli data-date või lahtri tekst on Eesti formaadis (nt "01.07.2026")
        if (esimeneRida) {
            // Proovime esmalt rea data-date atribuuti, kui see on seal punktidega, või võtame esimese lahtri teksti
            const kuupaevaTekst = esimeneRida.dataset.date || esimeneRida.querySelector("td")?.textContent || "";
            
            if (kuupaevaTekst && kuupaevaTekst.includes(".")) {
                // Tükeldame punkti järgi: ["01", "07", "2026"]
                const osad = kuupaevaTekst.split(".");
                if (osad.length >= 3) {
                    const kuuNr = parseInt(osad[1], 10); // Teine element on kuu (07)
                    const aastaNr = osad[2];            // Kolmas element on aasta (2026)
                    
                    const kuudeNimed = [
                        "Jaanuar", "Veebruar", "Märts", "Aprill", "Mai", "Juuni", 
                        "Juuli", "August", "September", "Oktoober", "November", "Detsember"
                    ];
                    
                    if (kuuNr >= 1 && kuuNr <= 12) {
                        kuuJaAastaTekst = `${kuudeNimed[kuuNr - 1]} ${aastaNr} – `;
                    }
                }
            } else if (kuupaevaTekst && kuupaevaTekst.includes("-")) {
                // Turvavõrk juhuks, kui andmebaasi kriipsud peaksid kusagile sisse jääma (YYYY-MM-DD)
                const osad = kuupaevaTekst.split("-");
                if (osad.length >= 2) {
                    const aastaNr = osad[0];
                    const kuuNr = parseInt(osad[1], 10);
                    const kuudeNimed = [
                        "Jaanuar", "Veebruar", "Märts", "Aprill", "Mai", "Juuni", 
                        "Juuli", "August", "September", "Oktoober", "November", "Detsember"
                    ];
                    if (kuuNr >= 1 && kuuNr <= 12) {
                        kuuJaAastaTekst = `${kuudeNimed[kuuNr - 1]} ${aastaNr} – `;
                    }
                }
            }
        }

        // Kui tabelist ikka kätte ei saanud (viimane hädavariant), kasutame süsteemset kuupäeva
        if (!kuuJaAastaTekst && typeof praeguneKuu !== "undefined" && praeguneKuu && praeguneKuu.includes("-")) {
            const osad = praeguneKuu.split("-");
            const kuudeNimed = ["Jaanuar", "Veebruar", "Märts", "Aprill", "Mai", "Juuni", "Juuli", "August", "September", "Oktoober", "November", "Detsember"];
            kuuJaAastaTekst = `${kuudeNimed[parseInt(osad[1], 10) - 1]} ${osad[0]} – `;
        }

        // Salvestame algse pealkirja mällu, et see pärast tagasi panna
        h2Pealkiri.dataset.algneTekst = h2Pealkiri.textContent;
        
        // Trükib paberile suurelt ja täpselt: Juuli 2026 – Kassatabel – kuu vaade
        h2Pealkiri.textContent = `${kuuJaAastaTekst}Kassatabel – kuu vaade`;
    }

    // Peidame vaate-režiimi teate kasti prindi ajaks
    const vReziim = document.getElementById("vaateReziim");
    if (vReziim) vReziim.style.display = "none";

    // Muudame kõik sisendkastid prindi ajaks puhtaks tekstiks [1.1]
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
    // Taastame algse h2 pealkirja ekraanile tagasi ("Kassatabel – kuu vaade")
    const h2Pealkiri = document.querySelector("h2");
    if (h2Pealkiri && h2Pealkiri.dataset.algneTekst) {
        h2Pealkiri.textContent = h2Pealkiri.dataset.algneTekst;
        h2Pealkiri.removeAttribute("data-algne-tekst");
    }

    // Toome vaate-režiimi teate kasti ekraanile tagasi
    const vReziim = document.getElementById("vaateReziim");
    if (vReziim && typeof tabelLukus !== "undefined") {
        vReziim.style.display = tabelLukus ? "block" : "none";
    }

    // Taastame sisendkastid ekraanile muutmiseks [1.1]
    document.querySelectorAll(".print-value").forEach(span => span.remove());
    document.querySelectorAll("td input").forEach(inp => {
        if (inp.dataset.wasVisible === "true") {
            inp.style.display = "";
            inp.removeAttribute("data-was-visible");
        }
    });
});


















