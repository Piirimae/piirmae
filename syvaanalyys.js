// syvaanalyys.js (MOODUL) - Piirimäe Täielik Ristanalüüs ja Süvaanalüüs
import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

// Globaalsed muutujad graafikute ja andmete jaoks
let uuringuGraafik = null, uuringuSektorGraafik = null;
let seaded = null, hinnadAjalugu = [], baasKassaAndmed = [];

// --- 1. Alglaadimine ja andmete laadimine ---
window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    document.getElementById("logoutBtn").onclick = logout;
    seaded = await laeSeaded();
    const { data: hist } = await sb.from("hinnad").select("*");
    hinnadAjalugu = hist || [];

    // Kuupäevade vaikeväärtused
    const tana = new Date();
    document.getElementById("analyysKuni").value = tana.toISOString().split('T')[0];
    const aastaTagasi = new Date();
    aastaTagasi.setFullYear(tana.getFullYear() - 1);
    document.getElementById("analyysAlates").value = aastaTagasi.toISOString().split('T')[0];

    SeadistaFiltriKuulajad();
    await LaeBaasAndmedSupabasest();
});

// --- 2. Filtri ja dünaamilise UI haldus ---
// --- Uuendatud Filtrikuulajad ahelfiltri jaoks ---
function SeadistaFiltriKuulajad() {
    document.getElementById("uuendaUuringBtn").onclick = K2ivitaRistanalyys;
    document.getElementById("chkKoikTooted").onchange = (e) => {
        document.getElementById("gruppTooted").style.display = e.target.checked ? "none" : "flex";
    };

    // Kuupäeva vahemiku muutmisel laeme andmed uuesti
    document.getElementById("laeBaasAndmedBtn").onclick = LaeBaasAndmedSupabasest;
}

// See funktsioon käivitub ALATI, kui keegi klikib aastat või kuud, et uuendada nädalate valikuid!
function UuendaAhelFiltreid() {
    const aktiivsedAastad = Array.from(document.querySelectorAll(".chk-aasta:checked")).map(c => Number(c.value));
    const aktiivsedKuud = Array.from(document.querySelectorAll(".chk-kuu:checked")).map(c => Number(c.value));

    const lubatudNadalad = new Set();
    const lubatudTooted = new Set();

    baasKassaAndmed.forEach(r => {
        if (!r.kuupaev) return;
        const d = new Date(r.kuupaev);
        const rAasta = d.getFullYear();
        const rKuu = d.getMonth() + 1;

        // Kontrollime, kas see rida sobib hetkel valitud aastate ja kuudega
        if (aktiivsedAastad.includes(rAasta) && aktiivsedKuud.includes(rKuu)) {
            lubatudNadalad.add(TuvastaNadalaNumber(d));
            seaded.veerud.forEach(v => {
                if (v.tüüp === "toit" && Number(r[v.nimi]) > 0) lubatudTooted.add(v.nimi);
            });
        }
    });

    // Uuendame nädalate checkbokse ekraanil - peidame need, mis valikusse ei kuulu!
    document.querySelectorAll(".chk-nadal").forEach(chk => {
        const nadalaNr = Number(chk.value);
        const lapsevanemLabel = chk.parentNode;
        if (lubatudNadalad.has(nadalaNr)) {
            lapsevanemLabel.style.opacity = "1";
            chk.disabled = false;
        } else {
            lapsevanemLabel.style.opacity = "0.3"; // Teeme halliks
            chk.disabled = true;
            chk.checked = false; // Võtame linnukese ära, kuna pole aktiivses kuus
        }
    });
}

function GenerreeriDunaamilisedLinnukesed() {
    const sets = { aastad: new Set(), kuud: new Set(), nadalad: new Set(), tooted: new Set() };
    
    baasKassaAndmed.forEach(r => {
        if (!r.kuupaev) return;
        const d = new Date(r.kuupaev);
        sets.aastad.add(d.getFullYear());
        sets.kuud.add(d.getMonth() + 1);
        sets.nadalad.add(TuvastaNadalaNumber(d));
        seaded.veerud.forEach(v => {
            if (v.tüüp === "toit" && Number(r[v.nimi]) > 0) sets.tooted.add(v.nimi);
        });
    });
    
    const sünkroonAastad = Array.from(sets.aastad).sort((a, b) => a - b);
    const sünkroonKuud = Array.from(sets.kuud).sort((a, b) => a - b);
    const sünkroonNadalad = Array.from(sets.nadalad).sort((a, b) => a - b);
    const sünkroonTooted = Array.from(sets.tooted).map(n => seaded.veerud.find(v => v.nimi === n)).filter(Boolean);

    EhitaLinnukesteHtml("gruppAastad", sünkroonAastad, "chk-aasta", (val) => `${val}. aasta`);
    EhitaLinnukesteHtml("gruppKuud", sünkroonKuud, "chk-kuu", (val) => ["Jaan", "Veebr", "Märts", "Apr", "Mai", "Juuni", "Juuli", "Aug", "Sept", "Okt", "Nov", "Dets"][val - 1]);
    EhitaLinnukesteHtml("gruppNadalad", sünkroonNadalad, "chk-nadal", (val) => `Näd ${val}`);
    EhitaLinnukesteHtmlObjektidega("gruppTooted", sünkroonTooted, "chk-toode");

    // Sleme sisse dünaamilise ahelfiltri kuulamise!
    document.querySelectorAll(".chk-aasta, .chk-kuu").forEach(el => {
        el.addEventListener("change", UuendaAhelFiltreid);
    });
    
    // Kui vajutatakse "Vali kõik" aastate või kuude juures
    const aastadAll = document.getElementById("gruppAastad-all");
    const kuudAll = document.getElementById("gruppKuud-all");
    if(aastadAll) aastadAll.addEventListener("change", () => setTimeout(UuendaAhelFiltreid, 10));
    if(kuudAll) kuudAll.addEventListener("change", () => setTimeout(UuendaAhelFiltreid, 10));
}

// --- 3. Ristanalüüsi mootor ja Chart.js ---
async function LaeBaasAndmedSupabasest() {
    const alates = document.getElementById("analyysAlates").value;
    const kuni = document.getElementById("analyysKuni").value;
    const { data } = await sb.from("kassatabel").select("*").gte("kuupaev", alates).lte("kuupaev", kuni);
    baasKassaAndmed = data || [];
    GenerreeriDunaamilisedLinnukesed();
    K2ivitaRistanalyys();
}

function leiaHindAjaloost(tooteNimi, kuupaevStr) {
    const target = new Date(kuupaevStr).getTime();
    const leitud = hinnadAjalugu.find(h => h.nimi === tooteNimi && target >= new Date(h.kehtiv_alates).getTime() && (!h.kehtiv_kuni || target <= new Date(h.kehtiv_kuni).getTime()));
    return leitud ? Number(leitud.hind) : (seaded.veerud.find(v => v.nimi === tooteNimi)?.hind || 0);
}


// --- 4. Linnukeste HTML-i ehitamine ja "Vali kaikki" loogika ---
function EhitaLinnukesteHtml(konteinerId, andmedArr, klassiNimi, vormindaTekstFn) {
    const ala = document.getElementById(konteinerId);
    if (!ala) return;

    let html = `
        <label style="font-weight:bold; border-bottom:1px dashed #cbd5e1; padding-bottom:2px; margin-bottom:4px;">
            <input type="checkbox" id="${konteinerId}-all" checked> Vali kõik
        </label>
    `;

    andmedArr.forEach(val => {
        const kuvatavTekst = vormindaTekstFn ? vormindaTekstFn(val) : val;
        html += `<label><input type="checkbox" class="${klassiNimi}" value="${val}" checked> ${kuvatavTekst}</label>`;
    });

    ala.innerHTML = html;

    const koikChk = document.getElementById(`${konteinerId}-all`);
    if (koikChk) {
        koikChk.onchange = (e) => {
            ala.querySelectorAll(`.${klassiNimi}`).forEach(chk => chk.checked = e.target.checked);
        };
    }
}

function EhitaLinnukesteHtmlObjektidega(konteinerId, tootedArr, klassiNimi) {
    const ala = document.getElementById(konteinerId);
    if (!ala) return;

    let html = `
        <label style="font-weight:bold; border-bottom:1px dashed #cbd5e1; padding-bottom:2px; margin-bottom:4px;">
            <input type="checkbox" id="${konteinerId}-all" checked> Vali kõik
        </label>
    `;

    tootedArr.forEach(v => {
        if (!v) return;
        html += `<label><input type="checkbox" class="${klassiNimi}" value="${v.nimi}" checked> ${v.pealkiri}</label>`;
    });

    ala.innerHTML = html;

    const koikChk = document.getElementById(`${konteinerId}-all`);
    if (koikChk) {
        koikChk.onchange = (e) => {
            ala.querySelectorAll(`.${klassiNimi}`).forEach(chk => chk.checked = e.target.checked);
        };
    }
}

// --- 5. Ristanalüüsi mootor ---
function K2ivitaRistanalyys() {
    const valitudAastad = Array.from(document.querySelectorAll(".chk-aasta:checked")).map(c => Number(c.value));
    const valitudKuud = Array.from(document.querySelectorAll(".chk-kuu:checked")).map(c => Number(c.value));
    const valitudNadalad = Array.from(document.querySelectorAll(".chk-nadal:not(:disabled):checked")).map(c => Number(c.value));
    const valitudPaevad = Array.from(document.querySelectorAll(".chk-paev:checked")).map(c => Number(c.value));
    
    const koikTootedLinnuke = document.getElementById("chkKoikTooted").checked;
    const valitudTooted = koikTootedLinnuke 
        ? seaded.veerud.filter(v => v.tüüp === "toit").map(v => v.nimi)
        : Array.from(document.querySelectorAll(".chk-toode:checked")).map(c => c.value);

    let uuritavadPaevad = 0, myugigaPaevad = 0, uuringuKogusummaKassa = 0, uuringuKogusummaTooted = 0;
    const sektorAndmed = {};
    
    // Koostame hierarhilise andmestruktuuri graafiku jaoks
    const graafikuAndmebaas = [];

    baasKassaAndmed.forEach(r => {
        if (!r.kuupaev) return;
        const d = new Date(r.kuupaev);
        const rAasta = d.getFullYear();
        const rKuu = d.getMonth() + 1;
        const rNadal = TuvastaNadalaNumber(d);
        const rPaev = d.getDay();

        if (!valitudAastad.includes(rAasta) || !valitudKuud.includes(rKuu) || !valitudNadalad.includes(rNadal) || !valitudPaevad.includes(rPaev)) return;

        uuritavadPaevad++;
        let paevalOliMyyki = false, paevaKassaSumma = 0, paevaArtiklid = 0;

        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit" && valitudTooted.includes(v.nimi)) {
                const tooteHind = leiaHindAjaloost(v.nimi, r.kuupaev);
                paevaKassaSumma += kogus * tooteHind;
                paevaArtiklid += kogus;
                sektorAndmed[v.pealkiri] = (sektorAndmed[v.pealkiri] || 0) + kogus;
            } else if (v.tüüp === "number") {
                paevaKassaSumma += kogus;
            }
        });

        if (paevalOliMyyki) myugigaPaevad++;
        uuringuKogusummaKassa += paevaKassaSumma;
        uuringuKogusummaTooted += paevaArtiklid;

        // Salvestame iga päeva täpse kirje hierarhiliseks tükeldamiseks
        graafikuAndmebaas.push({
            aasta: rAasta,
            kuu: rKuu,
            nadal: rNadal,
            paev: rPaev,
            kuupaev: r.kuupaev,
            kassa: paevaKassaSumma
        });
    });

    // Uuendame parema tiiva infoakna tekstid
    document.getElementById("uuringKoikPaevad").innerText = uuritavadPaevad;
    document.getElementById("uuringMyugiPaevad").innerText = myugigaPaevad;
    document.getElementById("uuringTootedKogus").innerText = `${uuringuKogusummaTooted} tk`;
    document.getElementById("uuringKassaSumma").innerText = `${uuringuKogusummaKassa.toFixed(2)} €`;
    document.getElementById("uuringAktiivsedTooted").innerText = valitudTooted.length;

    // Ehitame Sinu kirjeldatud kuude ja nädalate tulbad
    EhitajaJaJoonistaHierarhia(graafikuAndmebaas);
    JoonistaKoondSektorGraafik(Object.keys(sektorAndmed), Object.values(sektorAndmed));
}

function EhitajaJaJoonistaHierarhia(andmebaas) {
    // Sorteerime kuupäeva järgi
    andmebaas.sort((a,b) => new Date(a.kuupaev) - new Date(b.kuupaev));

    const sildid = [];
    const kassaAndmed = [];
    
    // Grupeerime andmed nii, et kui nädal 27 on kahes kuus, tekitatakse talle kaks iseseisvat tulpa kuude sisse
    const grupid = {};
    andmebaas.forEach(p => {
        // Võti koosneb aastast, kuust ja nädalast -> tagab ristnädala puhtuse!
        const voti = `${p.aasta}-Kuu ${p.kuu}-Näd ${p.nadal}`;
        if (!grupid[voti]) grupid[voti] = 0;
        grupid[voti] += p.kassa;
    });

    Object.keys(grupid).forEach(voti => {
        // Teeme sildiks ilusa puhta kirje, nt "Kuu 6 (Näd 27)"
        const osad = voti.split("-");
        sildid.push(`${osad[1]} [${osad[2]}]`);
        kassaAndmed.push(grupid[voti]);
    });

    // Reguleerime graafiku kasti laiust dünaamiliselt! Kui tulpasid on palju, teeme graafiku laiemaks, et saaks mugavalt kerida
    const sisuKast = document.getElementById("graafikSisuKast");
    if (sisuKast) {
        const uueLaius = Math.max(1200, sildid.length * 60);
        sisuKast.style.width = `${uueLaius}px`;
    }

    if (uuringuGraafik) uuringuGraafik.destroy();

    const ctx = document.getElementById("uuringuGraafik").getContext("2d");
    uuringuGraafik = new Chart(ctx, {
        type: "bar",
        data: {
            labels: sildid,
            datasets: [{
                label: "Kassa tulu ristnädalate lõikes (€)",
                data: kassaAndmed,
                backgroundColor: "rgba(241, 196, 15, 0.7)",
                borderColor: "rgba(241, 196, 15, 1)",
                borderWidth: 1,
                barPercentage: 0.8 // Teeb tulbad mõnusalt paksuks ja loetavaks
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: "Summa eurodes (€)" } },
                x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}


// --- 7. ISO Nädalapäeva tuvastamise standard ---
function TuvastaNadalaNumber(d) {
    const tana = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const paevaNr = tana.getUTCDay() || 7;
    tana.setUTCDate(tana.getUTCDate() + 4 - paevaNr);
    const aastaAlgus = new Date(Date.UTC(tana.getUTCFullYear(), 0, 1));
    return Math.ceil((((tana - aastaAlgus) / 86400000) + 1) / 7);
}


