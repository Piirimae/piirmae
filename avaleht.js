console.log("AVALEHT.JS ON LAETUD!");
import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";

let seaded = null;

function lisaPaevad(algKpv, paevadeArv) {
    const kpv = new Date(algKpv);
    kpv.setDate(kpv.getDate() + paevadeArv);
    return kpv.toISOString().split('T')[0];
}

function TuvastaAktiivsedKuupaevad() {
    const nüüd = new Date();
    const praeguneTund = nüüd.getHours();
    const nädalapäev = nüüd.getDay(); // 0 = pühapäev, 1 = esmaspäev...

    // 1. Päevamenüü kuupäev (pärast kl 18 lülitab homse peale)
    let paevaKuupaevObj = new Date(nüüd);
    if (praeguneTund >= 18) {
        paevaKuupaevObj.setDate(paevaKuupaevObj.getDate() + 1);
    }
    const paevaKuupaev = paevaKuupaevObj.toISOString().split('T')[0];

    // 2. Tuvastame, millise nädala esmaspäeva meil vaja on
    let sihtPaev = new Date(nüüd);
    
    // Kui on reede õhtu (kl 18+) või laupäev või pühapäev, nihutame sihtpäeva uude nädalasse
    if ((nädalapäev === 5 && praeguneTund >= 18) || nädalapäev === 6 || nädalapäev === 0) {
        // Nihutame sihtpäeva järgmisesse nädalasse (lisame 3, 2 või 1 päeva, et jõuda esmaspäevani)
        const paeviEsmaspaevani = nädalapäev === 5 ? 3 : (nädalapäev === 6 ? 2 : 1);
        sihtPaev.setDate(sihtPaev.getDate() + paeviEsmaspaevani);
    } else {
        // Tööpäevadel enne reede õhtut liigume jooksva nädala esmaspäevale
        const nihe = nädalapäev === 0 ? -6 : 1 - nädalapäev;
        sihtPaev.setDate(sihtPaev.getDate() + nihe);
    }

    const esmaspaevaKuupaev = sihtPaev.toISOString().split('T')[0];

    return { paevaKuupaev, esmaspaevaKuupaev };
}


function HangiKuuNimi(kuuStr) {
    const kuud = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
    const kuuIndex = parseInt(kuuStr, 10) - 1;
    return kuud[kuuIndex] || "";
}

async function LaeJaKuvaAvaleheMenyyd() {
    const { paevaKuupaev, esmaspaevaKuupaev } = TuvastaAktiivsedKuupaevad();
    const reedeStr = lisaPaevad(new Date(esmaspaevaKuupaev), 4);

    const pOsad = paevaKuupaev.split("-");
    const eOsad = esmaspaevaKuupaev.split("-");
    const rOsad = reedeStr.split("-");

    const paevaKpvElement = document.getElementById("tekstPaevaKpv");
    if (paevaKpvElement) {
        paevaKpvElement.innerText = `${parseInt(pOsad[2], 10)}. ${HangiKuuNimi(pOsad[1])} ${pOsad[0]}`;
    }

    const nadalaKpvElement = document.getElementById("tekstNadalaKpv");
    if (nadalaKpvElement) {
        nadalaKpvElement.innerText = `${eOsad[2]}.${eOsad[1]} - ${rOsad[2]}.${rOsad[1]}.${rOsad[0]}`;
    }

    const { data: menyyTekstid } = await sb
        .from("menyy_tekstid")
        .select("kuupaev, toode_nimi_kood, reaalne_toidu_nimi")
        .gte("kuupaev", esmaspaevaKuupaev)
        .lte("kuupaev", reedeStr);

    const tekstideIndeks = {};
    menyyTekstid?.forEach(t => {
        tekstideIndeks[`${t.kuupaev}_${t.toode_nimi_kood}`] = t.reaalne_toidu_nimi;
    });

    const aktiivsedToidud = seaded.veerud.filter(v => v.tüüp === "toit");

    // =========================================================================
    // 🥣 POOL A: PÄEVAMENÜÜ (Kuvab kõike, mis on sisestatud!)
    // =========================================================================
    const paevKast = document.getElementById("paevamenyyTootedKast");
    if (paevKast) {
        let paevHtml = "";
        let lahtreidKuvatud = 0;

        aktiivsedToidud.forEach(toode => {
            const tekst = tekstideIndeks[`${paevaKuupaev}_${toode.nimi}`] || "";
            if (tekst.trim() !== "") {
                paevHtml += `
                    <div class="toidu-rida">
                        <span class="toidu-nimi">${tekst}</span>
                        <span class="toidu-joon"></span>
                        <span class="toidu-hind">${Number(toode.hind).toFixed(2)} €</span>
                    </div>
                `;
                lahtreidKuvatud++;
            }
        });
        paevKast.innerHTML = lahtreidKuvatud > 0 ? paevHtml : "<p style='color:#718096; font-style:italic;'>Selleks päevaks pole lõunapakkumisi sisestatud.</p>";
    }

    // =========================================================================
    // 📅 POOL B: NÄDALAMENÜÜ (🌟 DÜNAAMILINE LÜHENDAMINE!)
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
                const koodVäike = toode.nimi.toLowerCase();
                
                // 🌟 REEGEL: Nädalaosast lõigatakse Šnitsel, Magus ja Termo täielikult välja! [1.1]
                if (koodVäike.includes("šnitsel") || koodVäike.includes("magus") || koodVäike.includes("termo")) {
                    return; 
                }

                const tekst = tekstideIndeks[`${kpvStr}_${toode.nimi}`] || "";
                if (tekst.trim() !== "") {
                    paevaToidudRiad += `
                        <div class="toidu-rida" style="font-size:13px; margin-bottom:8px;">
                            <span class="toidu-nimi">${tekst}</span>
                            <span class="toidu-joon"></span>
                            <span class="toidu-hind">${Number(toode.hind).toFixed(2)} €</span>
                        </div>
                    `;
                }
            });

            if (paevaToidudRiad !== "") {
                nadalHtml += `
                    <div style="margin-bottom: 12px; text-align: left;">
                        <div class="nadala-paev-pealkiri" style="margin: 10px 0 5px 0; font-size:12px;">${p.nimi} (${kOsad[2]}.${kOsad[1]})</div>
                        ${paevaToidudRiad}
                    </div>
                `;
            }
        });
        nadalKast.innerHTML = nadalHtml !== "" ? nadalHtml : "<p style='color:#718096; font-style:italic; text-align:center;'>Menüüd pole sisestatud.</p>";
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    try {
        seaded = await laeSeaded();
        await LaeJaKuvaAvaleheMenyyd();
    } catch (viga) {
        console.error("Viga menüü laadimisel:", viga);
    }
});

