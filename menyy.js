import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

let seaded = null;
let aktiivsedToiduKoodid = []; 
let valitudEsmaspaev = null;

const TOOPAEVAD = [
    { nimi: "ESMASPÄEV", nihe: 0 },
    { nimi: "TEISIPÄEV", nihe: 1 },
    { nimi: "KOLMAPÄEV", nihe: 2 },
    { nimi: "NELJAPÄEV", nihe: 3 },
    { nimi: "REEDE", nihe: 4 }
];

function lisaPaevad(algKpv, paevadeArv) {
    const kpv = new Date(algKpv);
    kpv.setDate(kpv.getDate() + paevadeArv);
    return kpv.toISOString().split('T')[0];
}

function leiaEsmaspaev(kuupaev) {
    const d = new Date(kuupaev);
    const day = d.getDay();
    const nihe = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(nihe));
}

async function EhitaMenyySisestusBlankett() {
    const algusSisend = document.getElementById("menyyAlgusEsmaspaev").value;
    if (!algusSisend) return alert("Palun vali kalendrist esmalt kuupäev!");

    valitudEsmaspaev = new Date(algusSisend);
    const blankettKonteiner = document.getElementById("menyyBlankettKast");
    blankettKonteiner.innerHTML = "<p>Laen andmeid andmebaasist...</p>";

    const esmaspaevStr = lisaPaevad(valitudEsmaspaev, 0);
    const reedeStr = lisaPaevad(valitudEsmaspaev, 4);

    const { data: olemasolevadTekstid, error } = await sb
        .from("menyy_tekstid")
        .select("kuupaev, toode_nimi_kood, reaalne_toidu_nimi")
        .gte("kuupaev", esmaspaevStr)
        .lte("kuupaev", reedeStr);

    if (error) console.error("Viga menüüde laadimisel:", error);

    const tekstideIndeks = {};
    olemasolevadTekstid?.forEach(t => {
        tekstideIndeks[`${t.kuupaev}_${t.toode_nimi_kood}`] = t.reaalne_toidu_nimi;
    });

    let html = `<table class="menyy-tabel"><thead><tr>`;
    TOOPAEVAD.forEach(p => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
        const kpvOsad = kpvStr.split("-");
        html += `<th class="paeva-veerg"><div class="padi-paev">${p.nimi}</div><div style="font-size:11px; color:#64748b;">${kpvOsad[2]}.${kpvOsad[1]}</div></th>`;
    });
    html += `</tr></thead><tbody><tr>`;

    TOOPAEVAD.forEach((p, pIdx) => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
        html += `<td class="paeva-veerg">`;

        // A. Laeme tavalised toidud lahtritesse
        aktiivsedToiduKoodid.forEach(toode => {
            const vanaTekst = tekstideIndeks[`${kpvStr}_${toode.nimi}`] || "";
            const inputId = `input-${kpvStr}-${toode.nimi}`;
            
            html += `
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:2px;">${toode.pealkiri}:</label>
                    <input type="text" id="${inputId}" value="${vanaTekst}" class="menyy-sisend" placeholder="Toidu nimi...">
                </div>
            `;
        });

        // B. 🌟 LAEME PÄEVA ERITEATE LAHTRI (Võtab andmebaasist "PAEVA_TEADE" rea)
        const vanaPaevaTeade = tekstideIndeks[`${kpvStr}_PAEVA_TEADE`] || "";
        // Kui teade on olemas, anname lahtrile helekollase tausta, aga muuta saab ikka!
        const paevaTaustastiil = vanaPaevaTeade.trim() !== "" ? "background-color: #fef3c7;" : "";

        html += `
            <div style="margin-top:15px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <label style="font-size:11px; font-weight:bold; color:#dd6b20; display:block; margin-bottom:2px;">✨ Päeva erisõnum/teade:</label>
                <input type="text" id="teade-${kpvStr}" value="${vanaPaevaTeade}" style="${paevaTaustastiil}" class="menyy-teade-input" placeholder="nt. Täna kook + kohv soodsalt!...">
            </div>
        `;

        html += `</td>`;
    });

    html += `</tr></tbody></table>`;
    blankettKonteiner.innerHTML = html;

    // C. 🌟 LAEME NÄDALA ÜLDTEATE LAHTRI (Seotud alati valitud nädala esmaspäevaga)
    const vanaNadalaTeade = tekstideIndeks[`${esmaspaevStr}_NADALA_TEADE`] || "";
    const nadalaTeadeLahter = document.getElementById("inputNadalUldTeade");
    if (nadalaTeadeLahter) {
        nadalaTeadeLahter.value = vanaNadalaTeade;
        // Kui nädala teade on andmebaasis olemas, teeme ka selle kollakaks
        nadalaTeadeLahter.style.backgroundColor = vanaNadalaTeade.trim() !== "" ? "#fef3c7" : "";
    }
}


async function SalvestaKoguNadalAndmebaasi() {
    if (!valitudEsmaspaev) return alert("Blankett pole laetud!");

    const salvestatavadRead = [];
    const esmaspaevStr = lisaPaevad(valitudEsmaspaev, 0);

    // 1. KORJAME TOIDUD JA PÄEVA ERITEATED
    TOOPAEVAD.forEach(p => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
        
        // A. Korjame tavalised toidud (Sinu algne loogika)
        aktiivsedToiduKoodid.forEach(toode => {
            const inputId = `input-${kpvStr}-${toode.nimi}`;
            const lahtriVaartus = document.getElementById(inputId)?.value || "";
            
            if (lahtriVaartus.trim() !== "") {
                salvestatavadRead.push({
                    kuupaev: kpvStr,
                    toode_nimi_kood: toode.nimi,
                    reaalne_toidu_nimi: lahtriVaartus.trim()
                });
            }
        });

        // B. 📢 UUS: Korjame selle päeva erisõnumi/teate lahtri sisu
        const paevaTeadeSisend = document.getElementById(`teade-${kpvStr}`)?.value || "";
        if (paevaTeadeSisend.trim() !== "") {
            salvestatavadRead.push({
                kuupaev: kpvStr,
                toode_nimi_kood: "PAEVA_TEADE", // Unikaalne kood, et hoida andmebaas puhtana
                reaalne_toidu_nimi: paevaTeadeSisend.trim()
            });
        }
    });

    // 2. 📢 UUS: Korjame nädala üldteate lahtri sisu ja seome selle nädala esmaspäevaga
    const nadalaTeadeSisend = document.getElementById("inputNadalUldTeade")?.value || "";
    if (nadalaTeadeSisend.trim() !== "") {
        salvestatavadRead.push({
            kuupaev: esmaspaevStr, // Alati esmaspäeva kuupäev
            toode_nimi_kood: "NADALA_TEADE", // Unikaalne kood nädala teatele
            reaalne_toidu_nimi: nadalaTeadeSisend.trim()
        });
    }

    if (salvestatavadRead.length === 0) return alert("Midagi pole salvestada!");

      // 3. SALVESTAME KÕIK ÜHE KORRAGA ANDMEBAASI
    const { error } = await sb
        .from("menyy_tekstid")
        .upsert(salvestatavadRead, { onConflict: "kuupaev,toode_nimi_kood" });

    if (!error) {
        // 🌟 KRAAN LAHTI: Kirjutame rea Sinu olemasolevasse logide tabelisse!
        try {
            // Küsime sisselogitud kasutaja emaili
            const { data: { user } } = await sb.auth.getUser();
            const kasutajaEmail = user?.email || "Teadmata";

            // Saadame rea Sinu tabelisse "logid" täpselt Sinu struktuuri järgi
            await sb.from("logid").insert({
                kasutaja: kasutajaEmail, // 🛠️ Kannab meili, mitte "admin"
                tegevus: "menyy_uuendus",
                andmed: {
                    esmaspaev: esmaspaevStr,
                    teade: "Menüü tekstide ja eriteadete salvestamine"
                }
            });
        } catch (logiViga) {
            console.error("Viga olemasolevasse logitabelisse kirjutamisel:", logiViga);
        }

        alert("💾 Menüü tekstid ja teated edukalt salvestatud!");
        SuunaTagasiPraegusesseNadalasse();
    } else {
        alert("Tõrge salvestamisel: " + error.message);
    }
} // 🌟 SEE SULG OLI PUUDU! See sulgeb funktsiooni SalvestaKoguNadalAndmebaasi




// =========================================================================
// 🖨️ ERALDI SEISVATELE PRINDIAKNATE GENEREERIMISE MOOTORID (A4 FORMAT) [1.1]
// =========================================================================

function AvaPrindiAkenPaev() {
    const paevIndex = Number(document.getElementById("prindiPaevValik").value);
    const p = TOOPAEVAD[paevIndex];
    const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
    const kpvOsad = kpvStr.split("-");

    // Kogume selle päeva toidud ja hinnad kokku
    let toidudHtml = "";
    aktiivsedToiduKoodid.forEach(toode => {
        const inputId = `input-${kpvStr}-${toode.nimi}`;
        const nimi = document.getElementById(inputId)?.value || "";
        if (nimi.trim() !== "") {
            // Otsime hinna lennult seadetest selle päeva seisuga
            const hind = toode.hind || 0; 
            toidudHtml += `
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:15px; font-size:18px;">
                    <span style="text-align:left; font-weight:500;">${nimi}</span>
                    <span style="flex-grow:1; border-bottom:1px dotted #cbd5e1; margin:0 10px 4px 10px;"></span>
                    <span style="font-weight:bold;">${Number(hind).toFixed(2)} €</span>
                </div>
            `;
        }
    });

    // Päeva eriteade lahtrist
    const paevaTeade = document.getElementById(`teade-${kpvStr}`)?.value || "";
    let teadeHtml = paevaTeade.trim() !== "" ? `<div style="margin-top:30px; padding:12px; background:#fffaf0; border-left:4px solid #c5a880; font-style:italic; font-size:15px; text-align:left;">✨ ${paevaTeade}</div>` : "";

    // Avame uue puhta brauseriakna, kus on AINULT selle päeva menüü, kauni taustapildiga! [1.1]
    const prindiAken = window.open("", "_blank", "width=800,height=1000");
    prindiAken.document.write(`
        <html>
        <head>
            <title>Trükk: Päevamenüü</title>
            <style>
                body { font-family:'Georgia', serif; padding:50px; color:#2c3e50; background:#fdfbf7 url('paev_taust.png') no-repeat center center; background-size:cover; text-align:center; }
                .raam { border:6px double #c5a880; padding:40px; background:rgba(255,255,255,0.96); max-width:650px; margin:0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.05); }
                @media print { body { background:#ffffff !important; padding:0; } .raam { border:4px double #000000 !important; box-shadow:none !important; background:#ffffff !important; } }
            </style>
        </head>
        <body>
            <div class="raam">
                <img src="logo1.png" alt="Logo" style="max-height:60px; margin-bottom:10px; display:inline-block;">
                <h1 style="font-size:32px; text-transform:uppercase; margin-bottom:5px; letter-spacing:2px;">Tänased Lõunapakkumised</h1>
                <h3 style="font-size:18px; font-style:italic; color:#4a5568; margin-bottom:40px; border-bottom:1px solid #cbd5e1; padding-bottom:10px;">${kpvOsad[2]}. ${HangiKuuNimi(kpvOsad[1])} ${kpvOsad[0]}</h3>
                <div style="margin:40px 0;">${toidudHtml}</div>
                <div style="font-family:'Brush Script MT', cursive; font-size:28px; margin-top:40px; color:#4a5568;">Head isu !</div>
                ${teadeHtml}
            </div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
    `);
    prindiAken.document.close();
}

function AvaPrindiAkenNadal() {
    const esmaspaevStr = lisaPaevad(valitudEsmaspaev, 0);
    const reedeStr = lisaPaevad(valitudEsmaspaev, 4);
    
    const eOsad = esmaspaevStr.split("-");
    const rOsad = reedeStr.split("-");

    let paevadHtml = "";
    TOOPAEVAD.forEach(p => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
        const kOsad = kpvStr.split("-");
        
        let toidudRiad = "";
        aktiivsedToiduKoodid.forEach(toode => {
            // 🌟 Sinu uus reegel läheb SIIT algusest käima:
            const koodVäike = toode.nimi.toLowerCase();
            if (koodVäike.includes("šnitsel") || koodVäike.includes("magus") || koodVäike.includes("termo")) {
                return; // Hüppab üle ja ei pane seda toitu nädala prindilehtedele!
            }

            // Siit edasi läheb Sinu algne kood täiesti muutmata kujul:
            const inputId = `input-${kpvStr}-${toode.nimi}`;
            const nimi = document.getElementById(inputId)?.value || "";
            if (nimi.trim() !== "") {
                toidudRiad += `
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:14px;">
                        <span style="max-width:80%; text-align:left;">${nimi}</span>
                        <span style="font-weight:bold; white-space:nowrap;">${Number(toode.hind).toFixed(2)} €</span>
                    </div>
                `;
            }
        });


        if (toidudRiad !== "") {
            paevadHtml += `
                <div style="margin-bottom:20px; page-break-inside:avoid;">
                    <h4 style="color:#2b6cb0; text-transform:uppercase; font-size:13px; text-align:left; margin:0 0 6px 0; border-bottom:1px solid #e2e8f0; padding-bottom:2px;">${p.nimi} (${kOsad[2]}.${kOsad[1]})</h4>
                    ${toidudRiad}
                </div>
            `;
        }
    });

    const nadalTeade = document.getElementById("inputNadalUldTeade")?.value || "";
    let teadeHtml = nadalTeade.trim() !== "" ? `<div style="margin-top:25px; padding:10px; background:#ebf8ff; border-left:4px solid #2b6cb0; font-style:italic; font-size:13px; text-align:left;">📢 ${nadalTeade}</div>` : "";
    
    const prindiAken = window.open("", "_blank", "width=850,height=1100");
    prindiAken.document.write(`
        <html>
        <head>
            <title>Trükk: Nädalamenüü</title>
            <style>
                body { font-family:'Georgia', serif; padding:40px; color:#2c3e50; background:#fdfbf7 url('nadal_taust.png') no-repeat center center; background-size:cover; }
                .raam { border:6px double #c5a880; padding:35px; background:rgba(255,255,255,0.96); max-width:700px; margin:0 auto; }
                @media print { body { background:#ffffff !important; padding:0; } .raam { border:4px double #000000 !important; box-shadow:none !important; background:#ffffff !important; } }
            </style>
        </head>
        <body>
            <div class="raam">
                <div style="text-align:center; margin-bottom:20px;">
                    <img src="logo1.png" alt="Logo" style="max-height:50px; margin-bottom:5px;">
                    <h1 style="font-size:28px; text-transform:uppercase; margin:0; letter-spacing:2px;">Nädalamenüü</h1>
                    <h3 style="font-size:15px; font-style:italic; color:#4a5568; margin:5px 0 25px 0; border-bottom:1px solid #cbd5e1; padding-bottom:8px;">${eOsad[2]}.${eOsad[1]} - ${rOsad[2]}.${rOsad[1]}.${rOsad[0]}</h3>
                </div>
                <div>${paevadHtml}</div>
                ${teadeHtml}
            </div>
            <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
    `);
    prindiAken.document.close();
}

function HangiKuuNimi(kuuStr) {
    const kuud = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
    const kuuIndex = parseInt(kuuStr, 10) - 1;
    return kuud[kuuIndex] || "";
}

function SuunaTagasiPraegusesseNadalasse() {
    const tana = new Date();
    const jooksevEsmaspaev = leiaEsmaspaev(tana);
    const kpvInput = document.getElementById("menyyAlgusEsmaspaev");
    if (kpvInput) kpvInput.value = jooksevEsmaspaev.toISOString().split('T')[0];
    EhitaMenyySisestusBlankett();
}

window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    seaded = await laeSeaded();
    aktiivsedToiduKoodid = seaded.veerud.filter(v => v.tüüp === "toit");

    SuunaTagasiPraegusesseNadalasse();

    document.getElementById("btnLaeNadal").onclick = EhitaMenyySisestusBlankett;
    document.getElementById("btnSalvestaMenyy").onclick = SalvestaKoguNadalAndmebaasi;
    
    // Seome uued spetsiaalsed prindiakende klikid lennult
    const prindiPaevBtn = document.getElementById("btnPrindiPaev");
    const prindiNadalBtn = document.getElementById("btnPrindiNadal");
    if (prindiPaevBtn) prindiPaevBtn.onclick = AvaPrindiAkenPaev;
    if (prindiNadalBtn) prindiNadalBtn.onclick = AvaPrindiAkenNadal;
});
