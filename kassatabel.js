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
if (!onParandusRez && praeguneKuu) {
        await KontrolliJaArhiveeriEelmineKuuAutomaatselt(praeguneKuu);
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
// 🌟 SÜSTEEMI AUTO-KRAAN: Kontrollib ja arhiveerib eelmise kuu automaatselt, kui see on andmebaasist puudu
async function KontrolliJaArhiveeriEelmineKuuAutomaatselt(praeguneKuuId) {
    if (!praeguneKuuId || !praeguneKuuId.includes("-")) return;

    // 1. Tuvastame kalendriliselt eelmise kuu ID (kujul YYYY-MM)
    const [aasta, kuu] = praeguneKuuId.split("-").map(Number);
    let eelmiseKuuObj = new Date(aasta, kuu - 2, 1); // Liigume 1 kuu tagasi
    const eelmiseKuuId = `${eelmiseKuuObj.getFullYear()}-${String(eelmiseKuuObj.getMonth() + 1).padStart(2, '0')}`;

    try {
        // 2. Kontrollime, kas see eelmine kuu on Sinu 'arhiiv' tabelis juba olemas
        const { data: olemasArhiivis } = await sb
            .from("arhiiv")
            .select("arhiiviId")
            .eq("kuu_id", eelmiseKuuId)
            .maybeSingle();

        // Kui on juba arhiivis olemas, siis me midagi üle ei kirjuta ega puutu
        if (olemasArhiivis) return;

        // 3. Küsime andmebaasist eelmise kuu reaalsed kassa andmed
        const { data: vanaKuuAndmed } = await sb
            .from("kassatabel")
            .select("*")
            .eq("kuu_id", eelmiseKuuId)
            .order("kuupaev");

        // Kui vanas kuus polnud üldse andmeid sisestatud, pole midagi arhiveerida
        if (!vanaKuuAndmed || vanaKuuAndmed.length === 0) return;

        console.log(`[AUTOMAATIKA] Tuvastasin sulgemata eelmise kuu: ${eelmiseKuuId}. Alustan arhiveerimist...`);

        // 4. Ehitame Sinu arhiiv.js jaoks vajaliku 'state' objekti struktuuri
        // (Et arhiiv.js suudaks seda tabelina kuvada, peab see sisaldama paise, rows, sumKogus jne)
        const arhiiviState = {
            paise: seaded?.veerud || [], // Võtame jooksvad veerud seadetest
            rows: vanaKuuAndmed.map(r => ({
                kuupäev: r.kuupaev && r.kuupaev.includes("T") ? r.kuupaev.split("T")[0] : r.kuupaev,
                veerud: (seaded?.veerud || []).map(v => r[v.nimi] || 0),
                kokku: 0 // Siia arvutab logic.js või süsteem summad ise
            })),
            sumKogus: [],
            sumHind: [],
            kuuKokku: 0
        };

        const uueArhiiviId = "arh_" + eelmiseKuuId + "_" + Date.now();

        // 5. SAADAME ANDMED SINU AMETLIKKU ARHIIVI TABELISSE
        const { error: arhiivError } = await sb
            .from("arhiiv")
            .insert({
                arhiiviId: uueArhiiviId,
                kuu_id: eelmiseKuuId,
                salvestaja: "Süsteem auto",
                versioon: 1,
                paeritolu: "automaatne", // 🛠️ Sinu arhiiv.js loeb seda märgistust!
                state: JSON.stringify(arhiiviState)
            });

        if (!arhiivError) {
            // 6. 📢 KANNAME TEGEVUSE AUTOMATSELT SINU LOGID TABELISSE!
            await sb.from("logid").insert({
                user_email: "Süsteem auto", // 🛠️ Logis selge ja korrektne tunnus
                tegevus: "auto_kuu_arhiiv",
                detailid: {
                    kuu: eelmiseKuuId,
                    arhiiviId: uueArhiiviId,
                    teade: `Eelmise kuu (${eelmiseKuuId}) andmed arhiveeriti automaatselt uue kuu laadimise esimesel sekundil.`
                }
            });
            console.log(`✅ [AUTO-LOGI] Kuu ${eelmiseKuuId} edukalt arhiveeritud ja logitud.`);
        } else {
            console.error("Automaatse arhiivi tõrge andmebaasis:", arhiivError.message);
        }
    } catch (err) {
        console.error("Süsteemne viga automaatsel kontrollil:", err);
    }
}




















