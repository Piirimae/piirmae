import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

let seaded = null;
let aktiivsedToiduKoodid = []; // Siia kogume seadetest aktiivsed veerud (nt 'supp', 'praad1')
let valitudEsmaspaev = null;


// Päevade nimed ja nihked esmaspäevast
const TOOPAEVAD = [
    { nimi: "ESMASPÄEV", nihe: 0 },
    { nimi: "TEISIPÄEV", nihe: 1 },
    { nimi: "KOLMAPÄEV", nihe: 2 },
    { nimi: "NELJAPÄEV", nihe: 3 },
    { nimi: "REEDE", nihe: 4 }
];

// --- 1. ABIINFO: Leiab kuupäeva nihke järgi ---
function lisaPaevad(algKpv, paevadeArv) {
    const kpv = new Date(algKpv);
    kpv.setDate(kpv.getDate() + paevadeArv);
    return kpv.toISOString().split('T')[0];
}

// --- 2. MOOTOR: Joonistab seadete põhjal dünaamilise tabeli ---
async function EhitaMenyySisestusBlankett() {
    const algusSisend = document.getElementById("menyyAlgusEsmaspaev").value;
    if (!algusSisend) return alert("Palun vali kalendrist esmalt kuupäev!");

    valitudEsmaspaev = new Date(algusSisend);
    const blankettKonteiner = document.getElementById("menyyBlankettKast");
    blankettKonteiner.innerHTML = "<p>Andmete laadimine andmebaasist...</p>";

    // Tõmbame selle nädala kuupäevade vahemiku andmebaasist ära, et olemasolevad tekstid lahtritesse panna
    const esmaspaevStr = lisaPaevad(valitudEsmaspaev, 0);
    const reedeStr = lisaPaevad(valitudEsmaspaev, 4);

    const { data: olemasolevadTekstid, error } = await sb
        .from("menyy_tekstid")
        .select("kuupaev, toode_nimi_kood, reaalne_toidu_nimi")
        .gte("kuupaev", esmaspaevStr)
        .lte("kuupaev", reedeStr);

    if (error) console.error("Viga menüüde laadimisel:", error);

    // Teeme otsinguindeksi: "kuupaev_kood" -> "Tekst"
    const tekstideIndeks = {};
    olemasolevadTekstid?.forEach(t => {
        tekstideIndeks[`${t.kuupaev}_${t.toode_nimi_kood}`] = t.reaalne_toidu_nimi;
    });

    // Hakkame HTML tabelit kokku panema
    let html = `<table class="menyy-tabel"><thead><tr>`;
    TOOPAEVAD.forEach(p => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
        // Teisendame kuupäeva ilusamaks vaateks (nt "15.05")
        const kpvOsad = kpvStr.split("-");
        html += `<th class="paeva-veerg"><div class="padi-paev">${p.nimi}</div><div style="font-size:11px; color:#64748b;">${kpvOsad[2]}.${kpvOsad[1]}</div></th>`;
    });
    html += `</tr></thead><tbody><tr>`;

    // Joonistame iga päeva alla tema aktiivsete toitude tekstilahtrid
    TOOPAEVAD.forEach((p, pIdx) => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);
        html += `<td class="paeva-veerg">`;

        aktiivsedToiduKoodid.forEach(toode => {
            const vanaTekst = tekstideIndeks[`${kpvStr}_${toode.nimi}`] || "";
            // Tekitame unikaalse ID lahtrile kujul: "input-2026-07-30-supp"
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

// --- 3. SALVESTAMINE: Kogub andmed lahtritest kokku ja lennutab Supabasse ---
async function SalvestaKoguNadalAndmebaasi() {
    if (!valitudEsmaspaev) return alert("Blankett pole veel laetud! Vali kuupäev ja lae tabel.");

    const salvestatavadRead = [];

    TOOPAEVAD.forEach(p => {
        const kpvStr = lisaPaevad(valitudEsmaspaev, p.nihe);

        aktiivsedToiduKoodid.forEach(toode => {
            const inputId = `input-${kpvStr}-${toode.nimi}`;
            const lahtriVaartus = document.getElementById(inputId)?.value || "";
            
            // Salvestame andmebaasi ainult need read, kuhu admin päriselt midagi kirjutas
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
        return alert("Tabel on täiesti tühi, pole midagi salvestada!");
    }

    // Kasutame .upsert() käsku, mis sünkroniseerib andmed automaatselt (loob uue või uuendab vana)
    const { error } = await sb
        .from("menyy_tekstid")
        .upsert(salvestatavadRead, { onConflict: "kuupaev,toode_nimi_kood" });

    if (!error) {
        alert("💾 Näidatava nädala menüü tekstid on andmebaasis turvaliselt lukustatud!");
        // Logime tegevuse ka ametlikku logitabelisse auditiks
        try {
            await sb.from("logid").insert({
                tegevus: "menyy_uuendus",
                user_email: window.userEmail || "admin",
                detailid: { esmaspaev: lisaPaevad(valitudEsmaspaev, 0) }
            });
        } catch (e) { console.error(e); }
        
        await EhitaMenyySisestusBlankett(); // Värskendame vaadet
    } else {
        alert("Tõrge salvestamisel: " + error.message);
    }
}

// --- 4. ALGSEADISTUS (DOMContentLoaded) ---
window.addEventListener("DOMContentLoaded", async () => {
    await kuvaKasutajaNimi();
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    // Laeme dünaamilised veerud seadetest
    seaded = await laeSeaded();
    // Filtreerime välja ainult toidukaubad (ignoreerime numbrilisi kassa käibeid jne)
    aktiivsedToiduKoodid = seaded.veerud.filter(v => v.tüüp === "toit");

    // Sättime kalendrisse automaatselt jooksva nädala kuupäeva
    const tana = new Date();
    const jooksevEsmaspaev = new Date(tana.setDate(tana.getDate() - tana.getDay() + (tana.getDay() === 0 ? -6 : 1)));
    document.getElementById("menyyAlgusEsmaspaev").value = jooksevEsmaspaev.toISOString().split('T')[0];

    // Seome nuppude klikid
    document.getElementById("btnLaeNadal").onclick = EhitaMenyySisestusBlankett;
    document.getElementById("btnSalvestaMenyy").onclick = SalvestaKoguNadalAndmebaasi;

    // Laeme laua koheselt jooksva nädala peale valmis
    await EhitaMenyySisestusBlankett();
});
