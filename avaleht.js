import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";

let seaded = null;

// --- 1. ABIINFO: Leiab kuupäeva nihke järgi ---
function lisaPaevad(algKpv, paevadeArv) {
    const kpv = new Date(algKpv);
    kpv.setDate(kpv.getDate() + paevadeArv);
    return kpv.toISOString().split('T')[0];
}


// --- 1.1. TÄIELIK LIrequestPÜHADE, TÄHTPÄEVADE JA KUUDE MOOTOR ---
function ArvutaEestiPühad(aasta) {
    // --- 1. Liikuvad pühad (Lihavõtte baasil Gaussi algoritm) ---
    const a = aasta % 19;
    const b = aasta % 4;
    const c = aasta % 7;
    const d = (19 * a + 24) % 30;
    const e = (2 * b + 4 * c + 6 * d + 5) % 7;
    
    let paevad = 22 + d + e;
    let kuu = 3; // Märts
    if (paevad > 31) {
        paevad = paevad - 31;
        kuu = 4; // Aprill
    }
    const ylestousmisPyha = new Date(aasta, kuu - 1, paevad);
    
    const kpvStr = (kpvObj) => {
        return `${kpvObj.getFullYear()}-${String(kpvObj.getMonth() + 1).padStart(2, '0')}-${String(kpvObj.getDate()).padStart(2, '0')}`;
    };

    // Liikuvate pühade tuletamine
    const vastlapaev = new Date(ylestousmisPyha);
    vastlapaev.setDate(vastlapaev.getDate() - 47);

    const suurReede = new Date(ylestousmisPyha);
    suurReede.setDate(suurReede.getDate() - 2);

    const nelipyhad = new Date(ylestousmisPyha);
    nelipyhad.setDate(nelipyhad.getDate() + 49);

    // --- 2. Muutuva kuupäevaga pühad (nädalapäeva baasil) ---
    // Emadepäev: mai teine pühapäev
    let emadapaev = new Date(aasta, 4, 1);
    while (emadapaev.getDay() !== 0) emadapaev.setDate(emadapaev.getDate() + 1);
    emadapaev.setDate(emadapaev.getDate() + 7);

    // Vanavanemate päev: septembri teine pühapäev
    let vanavanemad = new Date(aasta, 8, 1);
    while (vanavanemad.getDay() !== 0) vanavanemad.setDate(vanavanemad.getDate() + 1);
    vanavanemad.setDate(vanavanemad.getDate() + 7);

    // Hõimupäev: oktoobri kolmas laupäev
    let hoimupaev = new Date(aasta, 9, 1);
    let laupaevi = 0;
    while (laupaevi < 3) {
        if (hoimupaev.getDay() === 6) laupaevi++;
        if (laupaevi < 3) hoimupaev.setDate(hoimupaev.getDate() + 1);
    }

    // Isadepäev: novembri teine pühapäev
    let isadapaev = new Date(aasta, 10, 1);
    while (isadapaev.getDay() !== 0) isadapaev.setDate(isadapaev.getDate() + 1);
    isadapaev.setDate(isadapaev.getDate() + 7);

    // --- 3. Kogu pühade register (Riiklikud tähistatud 'isRiiklik: true') ---
    return {
        // Jaanuar
        [`${aasta}-01-01`]: { id: "uusaasta", nimi: "Uusaasta", isRiiklik: true },
        [`${aasta}-01-03`]: { id: "vabadussoda", nimi: "Vabadussõjas võidelnute mälestuspäev" },
        [`${aasta}-01-06`]: { id: "kolmekuningas", nimi: "Kolmekuningapäev" },
        [`${aasta}-01-30`]: { id: "kirjanduspaev", nimi: "Eesti kirjanduse päev" },
        
        // Veebruar
        [`${aasta}-02-02`]: { id: "tarturahul", nimi: "Tartu rahulepingu aastapäev" },
        [`${aasta}-02-09`]: { id: "luuvalu", nimi: "Luuvalupäev" },
        [`${aasta}-02-14`]: { id: "valentin", nimi: "Sõbrapäev" },
        [`${aasta}-02-16`]: { id: "leedu-vabariik", nimi: "Leedu riigi taastamise päev" },
        [kpvStr(vastlapaev)]: { id: "vastlapaev", nimi: "Vastlapäev" },
        [`${aasta}-02-24`]: { id: "iseseisvuspaev", nimi: "Eesti Vabariigi aastapäev", isRiiklik: true },
        
        // Märts
        [`${aasta}-03-14`]: { id: "emakeel", nimi: "Emakeelepäev" },
        
        // Aprill
        [`${aasta}-04-01`]: { id: "naljapaev", nimi: "Naljapäev" },
        [kpvStr(suurReede)]: { id: "suur-reede", nimi: "Suur Reede", isRiiklik: true },
        [kpvStr(ylestousmisPyha)]: { id: "ylestousmispyhad", nimi: "Ülestõusmispühade 1. püha", isRiiklik: true },
        [`${aasta}-04-14`]: { id: "kunnipaev", nimi: "Künnipäev" },
        [`${aasta}-04-23`]: { id: "juripaev", nimi: "Jüripäev / Veteranipäev" },
        
        // Mai
        [`${aasta}-05-01`]: { id: "kevadpyha", nimi: "Kevadpüha / Volbripäev", isRiiklik: true },
        [`${aasta}-05-09`]: { id: "euroopa-paev", nimi: "Euroopa päev" },
        [kpvStr(emadapaev)]: { id: "emadapaev", nimi: "Emadepäev" },
        [kpvStr(nelipyhad)]: { id: "nelipyhad", nimi: "Nelipühade 1. püha", isRiiklik: true },
        
        // Juuni
        [`${aasta}-06-01`]: { id: "lastekaitse", nimi: "Lastekaitsepäev" },
        [`${aasta}-06-04`]: { id: "lipupaev", nimi: "Eesti lipu päev" },
        [`${aasta}-06-14`]: { id: "leinapaev", nimi: "Leinapäev" },
        [`${aasta}-06-23`]: { id: "voidupyha", nimi: "Võidupüha", isRiiklik: true },
        [`${aasta}-06-24`]: { id: "jaanipaev", nimi: "Jaanipäev", isRiiklik: true },
        
        // Juuli
        [`${aasta}-07-10`]: { id: "seitsmevenna", nimi: "Seitsmevennapäev" },
        
        // August
        [`${aasta}-08-20`]: { id: "taasiseseisvumine", nimi: "Taasiseseisvumispäev", isRiiklik: true },
        
        // September
        [`${aasta}-09-01`]: { id: "teadmistepaev", nimi: "Teadmistepäev" },
        [kpvStr(vanavanemad)]: { id: "vanavanemad", nimi: "Vanavanemate päev" },
        [`${aasta}-09-21`]: { id: "madisepaev", nimi: "Sügisene madisepäev" },
        [`${aasta}-09-29`]: { id: "mihklipaev", nimi: "Mihklipäev" },
        
        // Oktoober
        [`${aasta}-10-01`]: { id: "omavalitsus", nimi: "Omavalitsuspäev" },
        [kpvStr(hoimupaev)]: { id: "hoimupaev", nimi: "Hõimupäev" },
        
        // November
        [`${aasta}-11-02`]: { id: "hingedepaev", nimi: "Hingedepäev" },
        [kpvStr(isadapaev)]: { id: "isadapaev", nimi: "Isadepäev" },
        [`${aasta}-11-10`]: { id: "mardipaev", nimi: "Mardipäev" },
        [`${aasta}-11-16`]: { id: "taassund", nimi: "Taassunni päev" },
        [`${aasta}-11-18`]: { id: "lati-vabariik", nimi: "Läti Vabariigi väljakuulutamise päev" },
        [`${aasta}-11-25`]: { id: "kadripaev", nimi: "Kadripäev" },
        
        // Detsember
        [`${aasta}-12-06`]: { id: "soome-iseseisvus", nimi: "Soome iseseisvuspäev" },
        [`${aasta}-12-13`]: { id: "luutsipaev", nimi: "Luutsipäev" },
        [`${aasta}-12-24`]: { id: "jouluohtu", nimi: "Jõululaupäev", isRiiklik: true },
        [`${aasta}-12-25`]: { id: "joulupaha1", nimi: "Esimene jõulupüha", isRiiklik: true },
        [`${aasta}-12-26`]: { id: "joulupaha2", nimi: "Teine jõulupüha", isRiiklik: true },
        [`${aasta}-12-31`]: { id: "naarid", nimi: "Näärid" }
    };
}


// --- 2. TARGA KELLA JA KUUPÄEVA TUVASTAMISE MOOTOR ---
function TuvastaAktiivsedKuupaevad() {
    const nüüd = new Date();
    const praeguneTund = nüüd.getHours();
    const nädalapäev = nüüd.getDay();

    const saaKohalikKpvStr = (kpvObj) => {
        const aasta = kpvObj.getFullYear();
        const kuu = String(kpvObj.getMonth() + 1).padStart(2, '0');
        const paev = String(kpvObj.getDate()).padStart(2, '0');
        return `${aasta}-${kuu}-${paev}`;
    };

    let paevaKuupaevObj = new Date(nüüd);
    if (praeguneTund >= 18) {
        paevaKuupaevObj.setDate(paevaKuupaevObj.getDate() + 1);
    }
    const paevaKuupaev = saaKohalikKpvStr(paevaKuupaevObj);

    const testPäev = new Date(nüüd);
    if (praeguneTund >= 18 && nädalapäev === 5) {
        testPäev.setDate(testPäev.getDate() + 3);
    } else if (nädalapäev === 6) {
        testPäev.setDate(testPäev.getDate() + 2);
    } else if (nädalapäev === 0) {
        testPäev.setDate(testPäev.getDate() + 1);
    }

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
    console.log("KONTROLL -> Kuupäevad:", TuvastaAktiivsedKuupaevad(), "Seaded:", seaded); 
    if (!seaded || !seaded.veerud) {
        seaded = await laeSeaded();
    }

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

    // 1. LAHEMME TOIDUD (menyy_tekstid)
    const { data: menyyTekstid } = await sb
        .from("menyy_tekstid")
        .select("kuupaev, toode_nimi_kood, reaalne_toidu_nimi")
        .gte("kuupaev", esmaspaevaKuupaev)
        .lte("kuupaev", reedeStr);

    const tekstideIndeks = {};
    menyyTekstid?.forEach(t => {
        tekstideIndeks[`${t.kuupaev}_${t.toode_nimi_kood}`] = t.reaalne_toidu_nimi;
    });

    // 2. Küsime tabelist "hinnad" praegu kehtivad hinnad
    const { data: praegusedHinnad } = await sb
        .from("hinnad")
        .select("nimi, hind")
        .is("kehtiv_kuni", null);

    const hindadeIndeks = {};
    praegusedHinnad?.forEach(h => {
        hindadeIndeks[h.nimi] = h.hind;
    });

    const veerudMassiiv = seaded?.veerud || [];
    const aktiivsedToidud = veerudMassiiv.filter(v => v.tüüp === "toit");

    // =========================================================================
    // 🥣 POOL A: PÄEVAMENÜÜ KUVAMINE
    // =========================================================================
    const paevKast = document.getElementById("paevamenyyTootedKast");
    if (paevKast) {
        let paevHtml = "";
        let lahtreidKuvatud = 0;

        aktiivsedToidud.forEach(toode => {
            const tekst = tekstideIndeks[`${paevaKuupaev}_${toode.nimi}`] || "";
            if (tekst.trim() !== "") {
                const reaalneHind = hindadeIndeks[toode.nimi] !== undefined ? hindadeIndeks[toode.nimi] : toode.hind;
                
                paevHtml += `
                    <div class="toidu-rida">
                        <span class="toidu-nimi">${tekst}</span>
                        <span class="toidu-joon"></span>
                        <span class="toidu-hind">${Number(reaalneHind).toFixed(2)} €</span>
                    </div>
                `;
                lahtreidKuvatud++;
            }
        });
        paevKast.innerHTML = lahtreidKuvatud > 0 ? paevHtml : "<p style='color:#718096; font-style:italic;'>Selleks päevaks pole lõunapakkumisi sisestatud.</p>";
    }

    // --- Päeva Teade ---
    const kuvaTeadeDiv = document.getElementById("kuvaPaevaTeade");
    if (kuvaTeadeDiv) {
        const teateTekst = tekstideIndeks[`${paevaKuupaev}_PAEVA_TEADE`] || "";
        if (teateTekst.trim() !== "") {
            kuvaTeadeDiv.innerText = teateTekst;
            kuvaTeadeDiv.style.display = "block";
        } else {
            kuvaTeadeDiv.innerText = "";
            kuvaTeadeDiv.style.display = "none";
        }
    }
} 
    // =========================================================================
    // 🌟 AUTOMAATNE PÜHADE TUVASTAMINE JA CSS DISAINI LÜLITAMINE
    // =========================================================================
   
    const praeguneAasta = parseInt(pOsad[0], 10);
    const pühadeRegister = ArvutaEestiPühad(praeguneAasta);
    
    // Tuvastame kuu nime massiivist klassi nime jaoks
    const kuudeKlassid = ["jaanuar", "veebruar", "marts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
    const kuuIndex = parseInt(pOsad[1], 10) - 1;
    const praeguseKuuKlass = `kuu-${kuudeKlassid[kuuIndex]}`;

    // 1. Puhastame body kõigist dünaamilistest klassidest
    document.body.className = document.body.className.replace(/\b(puha-|kuu-|riiklik-)\S+/g, '').trim();

    // 2. Vaatame, kas tänaseks on määratud spetsiifiline püha
    const leitudPüha = pühadeRegister[paevaKuupaev];

    if (leitudPüha) {
        // Kui on püha, lisame püha klassi (nt puha-sober)
        document.body.classList.add(`puha-${leitudPüha.id}`);
    }    
        // Kui see on riiklik püha (punane ruut), lisame ka ühise abi-klassi
        if (leitudPüha.isRiiklik) {
            document.body.classList.add("riiklik-puha");
        
        console.log(`Aktiivne disain -> PÜHA: puha-${leitudPüha.id}`);
    } else {
        // Kui püha pole, rakendame tavalise kuu vesipildi/stiili (nt kuu-veebruar)
        document.body.classList.add(praeguseKuuKlass);
        console.log(`Aktiivne disain -> KUU: ${praeguseKuuKlass}`);
    }
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
    const dStiilRaw = tekstideIndeks[`${esmaspaevaKuupaev}_AVALEHT_TERVITUS_STIIL`] || "Comic Sans;40px;#c22e24";
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
            </div>`;
    }
}

} // <--- LaeJaKuvaAvaleheMenyyd LÕPP

// --- 4. ALGSEADISTUS ---
window.addEventListener("DOMContentLoaded", async () => {
    seaded = await laeSeaded();
    await LaeJaKuvaAvaleheMenyyd();
});





