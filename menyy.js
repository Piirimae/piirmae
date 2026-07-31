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

// Leiab etteantud kuupäeva nädala esmaspäeva
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

        // 🌟 DÜNAAMILINE: Loeb alati hetkel aktiivseid toite seadetest!
        aktiivsedToiduKoodid.forEach(toode => {
            const vanaTekst = tekstideIndeks[`${kpvStr}_${toode.nimi}`] || "";
            const inputId = `input-${kpvStr}-${toode.nimi}`;
            
            html += `
                <div style="margin-bottom:10px;">
                    <label style="font-size:11px; font-weight:bold; color:#475569; display:block; margin-bottom:2px;">${toode.pealkiri}:</label>
                    <input type="text" id="${inputId}" value="${vanaTekst}" class="menyy-sisend" placeholder="Sisesta toidu nimi...">
                </div>
            `;
        });

        html += `</td>`;
    });

    html += `</tr></tbody></table>`;
    blankettKonteiner.innerHTML = html;
}

async function SalvestaKoguNadalAndmebaasi() {
    if (!valitudEsmaspaev) return alert("Blankett pole veel laetud!");

    const salvestatavadRead = [];

    TOOPAEVAD.forEach(p => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);

        aktiivsedToiduKoodid.forEach(toode => {
            const inputId = `input-${kpvStr}-${toode.nimi}`;
            const lahtriVaartus = document.getElementById(inputId)?.value || "";
            
            // ✅ KAITSE: Salvestame ainult need read, kus on tekst olemas. 
            // Tühjad kastid ei kirjuta andmebaasis vanu asju üle (saad suppi muutmata magusat lisada!)
            if (lahtriVaartus.trim() !== "") {
                salvestatavadRead.push({
                    kuupaev: kpvStr,
                    toode_nimi_kood: toode.nimi,
                    reaalne_toidu_nimi: lahtriVaartus.trim()
                });
            }
        });
    });

    if (salvestatavadRead.length === 0) {
        return alert("Tabelis pole uusi muudatusi, mida salvestada!");
    }

    const { error } = await sb
        .from("menyy_tekstid")
        .upsert(salvestatavadRead, { onConflict: "kuupaev,toode_nimi_kood" });

    if (!error) {
        alert("💾 Menüü tekstid edukalt salvestatud!");
        
        // 🌟 AUTOMAATNE TAGASITULEK: Viime kalendri ja vaate koheselt tagasi KÄESOLEVA nädala peale!
        SuunaTagasiPraegusesseNadalasse();
    } else {
        alert("Tõrge salvestamisel: " + error.message);
    }
}

function SuunaTagasiPraegusesseNadalasse() {
    const tana = new Date();
    const jooksevEsmaspaev = leiaEsmaspaev(tana);
    const kpvInput = document.getElementById("menyyAlgusEsmaspaev");
    if (kpvInput) {
        kpvInput.value = jooksevEsmaspaev.toISOString().split('T')[0];
    }
    EhitaMenyySisestusBlankett();
}

window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    seaded = await laeSeaded();
    // Võtame seadetest ainult toidud. Šnitsel on nimekirjas sees, masin loeb seda siit muretult!
    aktiivsedToiduKoodid = seaded.veerud.filter(v => v.tüüp === "toit");

    // Algseadistus: paneme kalendri käesoleva nädala esmaspäevale
    SuunaTagasiPraegusesseNadalasse();

    document.getElementById("btnLaeNadal").onclick = EhitaMenyySisestusBlankett;
    document.getElementById("btnSalvestaMenyy").onclick = SalvestaKoguNadalAndmebaasi;
});

