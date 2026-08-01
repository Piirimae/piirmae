
    

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
    const nädalapäev = nüüd.getDay(); // 0 = pühapäev, 1 = esmaspäev, ..., 6 = laupäev

    // Abifunktsioon kohaliku kuupäeva saamiseks ilma ISO ajatsooni nihketa (YYYY-MM-DD)
    const saaKohalikKpvStr = (kpvObj) => {
        const aasta = kpvObj.getFullYear();
        const kuu = String(kpvObj.getMonth() + 1).padStart(2, '0');
        const paev = String(kpvObj.getDate()).padStart(2, '0');
        return `${aasta}-${kuu}-${paev}`;
    };

    // A. PÄEVAMENÜÜ NIHE (Kell 18:00 hüppab järgmise päeva peale)
    let paevaKuupaevObj = new Date(nüüd);
    if (praeguneTund >= 18) {
        paevaKuupaevObj.setDate(paevaKuupaevObj.getDate() + 1);
    }
    const paevaKuupaev = saaKohalikKpvStr(paevaKuupaevObj);

    // B. NÄDALAMENÜÜ NIHE (Sinu algne loogika)
    const testPäev = new Date(nüüd);
    if (praeguneTund >= 18 && nädalapäev === 5) {
        testPäev.setDate(testPäev.getDate() + 3);
    } else if (nädalapäev === 6) {
        testPäev.setDate(testPäev.getDate() + 2);
    } else if (nädalapäev === 0) {
        testPäev.setDate(testPäev.getDate() + 1);
    }

    // Arvutame leitud testpäeva põhjal esmaspäeva puhta kohaliku aja baasil
    const d = new Date(testPäev);
    const tPaev = d.getDay();
    const nihe = d.getDate() - tPaev + (tPaev === 0 ? -6 : 1);
    
    const esmaspaevaObj = new Date(d.setDate(nihe));
    const esmaspaevaKuupaev = saaKohalikKpvStr(esmaspaevaObj);

    return { paevaKuupaev, esmaspaevaKuupaev };
}


function HangiKuuNimi(kuuStr) {
    const kuud = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
    const kuuIndex = parseInt(kuuStr, 10) - 1;
    return kuud[kuuIndex] || "";
}
// --- 3. ANDMETE KUVAMISE JA JOONISTAMISE MOOTOR ---
async function LaeJaKuvaAvaleheMenyyd() {
    // 1. SEADED JA KUUPÄEVAD (Laetakse ainult siis, kui neid veel pole)
    if (!seaded || !seaded.veerud) seaded = await laeSeaded();
    
    const { paevaKuupaev, esmaspaevaKuupaev } = TuvastaAktiivsedKuupaevad();
    
    // Ajatsooni kindel esmaspäeva objekti loomine ja reede arvutamine
    const [aasta, kuu, paev] = esmaspaevaKuupaev.split("-");
    const esmaspaevObjekt = new Date(aasta, kuu - 1, paev);
    const reedeStr = lisaPaevad(esmaspaevObjekt, 4);

    // Päiste kuupäevade uuendamine
    const pOsad = paevaKuupaev.split("-");
    const eOsad = esmaspaevaKuupaev.split("-");
    const rOsad = reedeStr.split("-");
    const paevaKpvElement = document.getElementById("tekstPaevaKpv");
    if (paevaKpvElement) paevaKpvElement.innerText = `${parseInt(pOsad[2], 10)}. ${HangiKuuNimi(pOsad[1])} ${pOsad[0]}`;
    const nadalaKpvElement = document.getElementById("tekstNadalaKpv");
    if (nadalaKpvElement) nadalaKpvElement.innerText = `${eOsad[2]}.${eOsad[1]} - ${rOsad[2]}.${rOsad[1]}.${rOsad[0]}`;

    // 2. ANDMETE LAADIMINE (Supabase)
    const { data: menyyTekstid } = await sb.from("menyy_tekstid")
        .select("kuupaev, toode_nimi_kood, reaalne_toidu_nimi")
        .gte("kuupaev", esmaspaevaKuupaev).lte("kuupaev", reedeStr);
    const { data: praegusedHinnad } = await sb.from("hinnad")
        .select("nimi, hind").is("kehtiv_kuni", null);

    // 3. INDEKSITE KOOSTAMINE (Andmete kiireks leidmiseks)
    const tekstideIndeks = {};
    menyyTekstid?.forEach(t => tekstideIndeks[`${t.kuupaev}_${t.toode_nimi_kood}`] = t.reaalne_toidu_nimi);
    const hindadeIndeks = {};
    praegusedHinnad?.forEach(h => hindadeIndeks[h.nimi] = h.hind);

    const aktiivsedToidud = seaded?.veerud?.filter(v => v.tüüp === "toit") || [];

    // 4. HTML JOONISTAMINE (Päeva- ja nädalamenüü)
    const paevKast = document.getElementById("paevamenyyTootedKast");
    if (paevKast) {
        let paevHtml = "", lahtreidKuvatud = 0;
        aktiivsedToidud.forEach(toode => {
            const tekst = tekstideIndeks[`${paevaKuupaev}_${toode.nimi}`] || "";
            if (tekst.trim() !== "") {
                const reaalneHind = hindadeIndeks[toode.nimi] !== undefined ? hindadeIndeks[toode.nimi] : toode.hind;
                paevHtml += `<div class="toidu-rida">${tekst} - ${Number(reaalneHind).toFixed(2)} €</div>`;
                lahtreidKuvatud++;
            }
        });
        paevKast.innerHTML = lahtreidKuvatud > 0 ? paevHtml : "<em>Pole lõunapakkumisi.</em>";
    }

    // =========================================================================
    // 📅 POOL B: NÄDALAMENÜÜ
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
                if (koodVäike.includes("šnitsel") || koodVäike.includes("magus") || koodVäike.includes("termo")) {
                    return; 
                }

                const tekst = tekstideIndeks[`${kpvStr}_${toode.nimi}`] || "";
                if (tekst.trim() !== "") {
                    // Võtame hinna tabelist "hinnad"
                    const reaalneHind = hindadeIndeks[toode.nimi] !== undefined ? hindadeIndeks[toode.nimi] : toode.hind;

                    paevaToidudRiad += `
                        <div class="toidu-rida" style="font-size:13px; margin-bottom:8px;">
                            <span class="toidu-nimi">${tekst}</span>
                            <span class="toidu-joon"></span>
                            <span class="toidu-hind">${Number(reaalneHind).toFixed(2)} €</span>
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

// =========================================================================
// 🎨 DÜNAAMILINE TERVITUSVIDIN (Fondi, suuruse ja värvi sünkroon)
// =========================================================================
const tervitusElement = document.getElementById("avalehtDynaamilineTervitus");

if (tervitusElement) {
    // OTSING & RAKENDAMINE: Parandatud võtmed ja stiili tükeldamine
    const dTekst = tekstideIndeks[`${esmaspaevaKuupaev}_AVALEHT_TERVITUS_TEKST`] || "Head isu !";
    const dStiilRaw = tekstideIndeks[`${esmaspaevaKuupaev}_AVALEHT_TERVITUS_STIIL`] || "Brush Script MT;26px;#4a5568";
    const [dFont, dSize, dColor] = dStiilRaw.split(";");

    tervitusElement.innerText = dTekst;
    tervitusElement.style.fontFamily = dFont;
    tervitusElement.style.fontSize = dSize;
    tervitusElement.style.color = dColor;
}

// === UUS LOOGIKA: KUVAME NÄDALA ÜLDTEATE AVALEHEL ===
const avaleheNadalKast = document.getElementById("avalehtNadalaUldTeadeKast");
if (avaleheNadalKast) {
    const dNadalaTeade = tekstideIndeks[`${esmaspaevaKuupaev}_NADALA_TEADE`] || "";
    if (dNadalaTeade.trim() !== "") {
        avaleheNadalKast.innerHTML = `
            <div style="margin-top: 15px; padding: 12px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 14px; color: #78350f; text-align: left;">
                📢 <strong>Nädala teadaanne:</strong> ${dNadalaTeade}
            </div>
        `;
    }
}

} // <--- LaeJaKuvaAvaleheMenyyd LÕPP

// --- 4. ALGSEADISTUS ---
window.addEventListener("DOMContentLoaded", async () => {
    seaded = await laeSeaded();
    await LaeJaKuvaAvaleheMenyyd();
});





