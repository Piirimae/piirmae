import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";

let seaded = null;

// --- 1. ABIINFO: Leiab kuupäeva nihke järgi ---
function lisaPaevad(algKpv, paevadeArv) {
    const kpv = new Date(algKpv);
    kpv.setDate(kpv.getDate() + paevadeArv);
    return kpv.toISOString().split('T')[0];
}

// --- 2. TARGA KELLA JA KUUPÄEVA TUVASTAMISE MOOTOR ---
function TuvastaAktiivsedKuupaevad() {
    const nüüd = new Date();
    const praeguneTund = nüüd.getHours();
    const nädalapäev = nüüd.getDay(); // 0 = pühapäev, 1 = esmaspäev, ..., 5 = reede, 6 = laupäev

    let paevaKuupaev = nüüd.toISOString().split('T')[0];
    let esmaspaevaKuupaev = null;

    // A. PÄEVAMENÜÜ NIHE (Kell 18:00 hüppab ise järgmise päeva peale!) [1.1]
    if (praeguneTund >= 18) {
        const homme = new Date();
        homme.setDate(homme.getDate() + 1);
        paevaKuupaev = homme.toISOString().split('T')[0];
    }

    // B. NÄDALAMENÜÜ NIHE (Pärast reede 18:00 või nädalavahetusel näitab tulevat nädalat) [1.1]
    const testPäev = new Date();
    if (praeguneTund >= 18 && nädalapäev === 5) {
        // Reede õhtu -> nihutame testpäeva esmaspäevaks (+3 päeva)
        testPäev.setDate(testPäev.getDate() + 3);
    } else if (nädalapäev === 6) {
        // Laupäev -> nihutame esmaspäevaks (+2 päeva)
        testPäev.setDate(testPäev.getDate() + 2);
    } else if (nädalapäev === 0) {
        // Pühapäev -> nihutame esmaspäevaks (+1 päev)
        testPäev.setDate(testPäev.getDate() + 1);
    }

    // Arvutame leitud testpäeva baasil selle nädala esmaspäeva
    const d = new Date(testPäev);
    const day = d.getDay();
    const nihe = d.getDate() - day + (day === 0 ? -6 : 1);
    esmaspaevaKuupaev = new Date(d.setDate(nihe)).toISOString().split('T')[0];

    return { paevaKuupaev, esmaspaevaKuupaev };
}

function HangiKuuNimi(kuuStr) {
    const kuud = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
    const kuuIndex = parseInt(kuuStr, 10) - 1;
    return kuud[kuuIndex] || "";
}
// --- 3. ANDMETE KUVAMISE JA JOONISTAMISE MOOTOR ---
async function LaeJaKuvaAvaleheMenyyd() {
    const { paevaKuupaev, esmaspaevaKuupaev } = TuvastaAktiivsedKuupaevad();
    
    // Uuendame päiste kuupäevade tekstilised tiitlid ekraanil
    const pOsad = paevaKuupaev.split("-");
    const eOsad = esmaspaevaKuupaev.split("-");
    const reedeStr = lisaPaevad(new Date(esmaspaevaKuupaev), 4);
    const rOsad = reedeStr.split("-");

    const paevaKpvElement = document.getElementById("tekstPaevaKpv");
    if (paevaKpvElement) {
        paevaKpvElement.innerText = `${pOsad[2]}. ${HangiKuuNimi(pOsad[1])} ${pOsad[0]}`;
    }

    const nadalaKpvElement = document.getElementById("tekstNadalaKpv");
    if (nadalaKpvElement) {
        nadalaKpvElement.innerText = `${eOsad[2]}.${eOsad[1]} - ${rOsad[2]}.${rOsad[1]}.${rOsad[0]}`;
    }

    // Tõmbame andmebaasist korraga ära kogu selle nädala tekstid
    const { data: menyyTekstid, error } = await sb
        .from("menyy_tekstid")
        .select("kuupaev, toode_nimi_kood, reaalne_toidu_nimi")
        .gte("kuupaev", esmaspaevaKuupaev)
        .lte("kuupaev", reedeStr);

    if (error) return console.error("Viga avalehe menüüde laadimisel:", error);

    // Teeme otsinguindeksi: "kuupaev_kood" -> "Tekst"
    const tekstideIndeks = {};
    menyyTekstid?.forEach(t => {
        tekstideIndeks[`${t.kuupaev}_${t.toode_nimi_kood}`] = t.reaalne_toidu_nimi;
    });

    const aktiivsedToidud = seaded.veerud.filter(v => v.tüüp === "toit");

    // =========================================================================
    // 🥣 OSAMUUTUJA A: PÄEVAMENÜÜ JOONISTAMINE
    // =========================================================================
    const paevKast = document.getElementById("paevamenyyTootedKast");
    if (paevKast) {
        let paevHtml = "";
        let lahtreidKuvatud = 0;

        aktiivsedToidud.forEach(toode => {
            const tekst = tekstideIndeks[`${paevaKuupaev}_${toode.nimi}`] || "";
            
            // 🌟 SINKROONIS REEGEL: Kui lahtris on midagi (kasvõi kriips _), kuvame!
            if (tekst.trim() !== "") {
                const hind = toode.hind || 0;
                paevHtml += `
                    <div class="toidu-rida">
                        <span class="toidu-nimi">${tekst}</span>
                        <span class="toidu-joon"></span>
                        <span class="toidu-hind">${Number(hind).toFixed(2)} €</span>
                    </div>
                `;
                lahtreidKuvatud++;
            }
        });

        paevKast.innerHTML = lahtreidKuvatud > 0 ? paevHtml : "<p style='color:#718096; font-style:italic;'>Selleks päevaks pole lõunapakkumisi sisestatud.</p>";
    }

    // =========================================================================
    // 📅 OSAMUUTUJA B: NÄDALAMENÜÜ JOONISTAMINE
    // =========================================================================
    const nadalKast = document.getElementById("nadalamenyyTootedKast");
    if (nadalKast) {
        let nadalHtml = "";
        const TOOPAEVAD = [
            { nimi: "ESMASPÄEV", nihe: 0 },
            { nimi: "TEISIPÄEV", nihe: 1 },
            { nimi: "KOLMAPÄEV", nihe: 2 },
            { nimi: "NELJAPÄEV", nihe: 3 },
            { nimi: "REEDE", nihe: 4 }
        ];

        TOOPAEVAD.forEach(p => {
            const kpvStr = lisaPaevad(new Date(esmaspaevaKuupaev), p.nihe);
            const kOsad = kpvStr.split("-");
            
            let paevaToidudRiad = "";

            aktiivsedToidud.forEach(toode => {
                const tekst = tekstideIndeks[`${kpvStr}_${toode.nimi}`] || "";
                
                // 🌟 SINKROONIS REEGEL: Kui lahtris on midagi, kuvame ka nädalas!
                if (tekst.trim() !== "") {
                    const hind = toode.hind || 0;
                    paevaToidudRiad += `
                        <div class="toidu-rida">
                            <span class="toidu-nimi">${tekst}</span>
                            <span class="toidu-joon"></span>
                            <span class="toidu-hind">${Number(hind).toFixed(2)} €</span>
                        </div>
                    `;
                }
            });

            // Kui sel päeval oli vähemalt üks toit kirjas, kuvame selle päeva bloki
            if (paevaToidudRiad !== "") {
                nadalHtml += `
                    <div style="margin-bottom: 15px; text-align: left;">
                        <div class="nadala-paev-pealkiri">${p.nimi} (${kOsad[2]}.${kOsad[1]})</div>
                        ${paevaToidudRiad}
                    </div>
                `;
            }
        });

        nadalKast.innerHTML = nadalHtml !== "" ? nadalHtml : "<p style='color:#718096; font-style:italic; text-align:center;'>Selle nädala menüüd pole veel sisestatud.</p>";
    }
}

// --- 4. ALGSEADISTUS ---
window.addEventListener("DOMContentLoaded", async () => {
    // Laeme dünaamilised seaded hindade jaoks
    seaded = await laeSeaded();
    
    // Käivitame menüüde automaatse kuvamise
    await LaeJaKuvaAvaleheMenyyd();
});




