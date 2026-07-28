import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";
import { kuvaKasutajaNimi } from "./auth.js";




let tabelLukus = true;
let seaded = null;

let praeguneKuu = document.getElementById("kuuValik").value;
let reaalneKuu = praeguneKuu;
let roll = null;

// --- DOM elemendid ---
const tabelEl = document.getElementById("kassatabel");
const tbody = document.getElementById("tbody");
const kuuValik = document.getElementById("kuuValik");
const lukustaNupp = document.getElementById("lukustaNupp");
const salvestaNupp = document.getElementById("salvestaNupp");
const arhiiviNupp = document.getElementById("arhiiviNupp");
const prindiNupp = document.getElementById("prindiNupp");
const laeAllaNupp = document.getElementById("laeAllaNupp");
const teadeEl = document.getElementById("teade");
const arhiiviKuva = document.getElementById("arhiiviKuva");
// --- 1. Alglaadimine ja taastamise kontroll ---
// Kontrollime, kas leht avati arhiivist taastamise või parandamise käsuga
const taastatudState = localStorage.getItem("taastatudState");
const taastatudKuu = localStorage.getItem("taastatudKuu");

// Kontroll, et kood käivituks alles siis, kui seaded ja tabel on valmis
async function kontrolliJaTaasta() {
    if (taastatudState && taastatudKuu) {
        try {
            const state = JSON.parse(taastatudState);
            praeguneKuu = taastatudKuu;
            if (kuuValik) kuuValik.value = taastatudKuu;
            
            // Ootame hetke, et DOM ja tabeli read jõuaksid genereeruda
            setTimeout(() => {
                taastaTabelState(state);
                localStorage.removeItem("taastatudState");
                localStorage.removeItem("taastatudKuu");
            }, 100);
        } catch (err) {
            console.error("Viga andmete lahtipakkimisel taastamisel:", err);
        }
    }
}

// ✅ LISATUD PUUDUV FUNKTSIOON: Pakib arhiivi JSON-i lahti ja paneb väärtused inputitesse
function taastaTabelState(state) {
    if (!state || !state.rows) return;
    
    console.log("LOGIC: Taastan tabeli andmeid arhiivifailist...");
    
    state.rows.forEach(ridaState => {
        // Otsime tabelist õiget rida kuupäeva järgi
        const tr = tbody.querySelector(`tr[data-date="${ridaState.kuupäev}"]`);
        if (!tr) return;
        
        const inputs = tr.querySelectorAll("input");
        inputs.forEach((inp, idx) => {
            if (ridaState.veerud && ridaState.veerud[idx] !== undefined) {
                inp.value = ridaState.veerud[idx];
            }
        });
    });
    
    tabelLukus = false; // Teeme tabeli muudetavaks ja aktiivseks!
    rakendaLukustusOlek();
    arvuta(); // Sunnime summad uuesti käima
    näitaTeadet("Andmed arhiivist edukalt tabelisse laetud ja muutmiseks avatud.");
}



console.log("LOGIC STARTED");

function täidaKuuValik() {
    const kuuValik = document.getElementById("kuuValik");

    const praegu = new Date();
    const aasta = praegu.getFullYear();
    const kuu = String(praegu.getMonth() + 1).padStart(2, "0");

    const value = `${aasta}-${kuu}`;
    const label = praegu.toLocaleString("et-EE", { month: "long", year: "numeric" });

    kuuValik.innerHTML = `<option value="${value}" selected>${label}</option>`;
}



   // Globaalne muutuja hindade ajaloo hoidmiseks logic.js ülaosas
let hinnadAjalugu = [];

async function init() {
    täidaKuuValik();
    praeguneKuu = document.getElementById("kuuValik").value;
    
    await kuvaKasutajaNimi();
    roll = window.userRole; 

    seaded = await laeSeaded();
    
    // ✅ LISATUD: Küsime andmebaasist kogu hindade ajaloo nimekirja
    const { data: hist } = await sb.from("hinnad").select("*");
    hinnadAjalugu = hist || [];

    await genereeriKuuTabel();

    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);
    await kontrolliJaTaasta();

    await kuvaArhiiv();
    uuendaVaateReziim();
    rakendaRolliLukustus();
}

// Lisa see abifunktsioon näiteks genereeriKuuTabel() lähedale
function leiaHinnaAjaloost(tooteNimi, kuupaevStr) {
    // Teeme rea kuupäevast võrdluseks kellaaja (päeva algus)
    const targetTime = new Date(`${kuupaevStr}T00:00:00`).getTime();

    // Otsime ajaloo massiivist rida, mis klapib nimega ja jääb õigesse ajavahemikku
    const leitud = hinnadAjalugu.find(h => {
        if (h.nimi !== tooteNimi) return false;
        
        const alates = new Date(h.kehtiv_alates).getTime();
        const kuni = h.kehtiv_kuni ? new Date(h.kehtiv_kuni).getTime() : Infinity;
        
        return targetTime >= alates && targetTime <= kuni;
    });

    // Kui andmebaasi ajaloost leiti vaste, tagastame selle hinna. 
    // Kui ei leitud (nt vana rida), kasutame vaikimisi seadete lehe hetke hinda.
    if (leitud) return Number(leitud.hind);
    
    const vaikimisiVeerg = seaded.veerud.find(v => v.nimi === tooteNimi);
    return vaikimisiVeerg ? Number(vaikimisiVeerg.hind) || 0 : 0;
}


async function laeKuuAndmedSupabasest(kuuId) {
    const { data, error } = await sb
        .from("kassatabel")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("kuupaev", { ascending: true });

    if (error) {
        console.error("Viga Supabase laadimisel:", error);
        return [];
    }
    return data || [];
}

async function salvestaSupabasse(rida) {
    const { error } = await sb
        .from("kassatabel")
        .upsert(rida, { onConflict: "kuu_id,kuupaev" });

    if (error) console.error("Viga salvestamisel:", error);
}
  

console.log("SALVESTAMINE ALGAS");
// --- UUS ARHIIVI SALVESTAMINE SUPABASESSE ---
async function arhiiviSupabasse(kuuId, stateJson) {
    try {
        // 1) Koosta arhiiviId (YYYY-MM-DD-HH-MM)
        const now = new Date();
        const arhiiviId = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0")
        ].join("-");

        // 2) Leia, kas samal minutil on juba versioone
        const { data: olemasolevad } = await sb
            .from("arhiiv")
            .select("versioon")
            .eq("arhiiviId", arhiiviId);

        let versioon = 1;
        if (olemasolevad && olemasolevad.length > 0) {
            versioon = Math.max(...olemasolevad.map(r => r.versioon)) + 1;
        }

        // 3) Leia salvestaja email
        const { data: userData } = await sb.auth.getUser();
        const salvestaja = userData?.user?.email ?? "tundmatu";

        // 4) Salvesta arhiivi
        const parsedState = JSON.parse(stateJson);
        const { error } = await sb
            .from("arhiiv")
            .insert({
                arhiiviId: arhiiviId,
                kuu_id: kuuId,
                state: parsedState,
                salvestaja: salvestaja,
                paeritolu: "aktiivne",
                taastatud: false,
                versioon: versioon
            });

        if (error) {
            console.error("Arhiivi salvestamise viga:", error);
            näitaTeadet("Arhiivi salvestamine ebaõnnestus.");
            return false;
        }

       

        näitaTeadet(`Arhiivi salvestatud: ${arhiiviId} (versioon ${versioon})`);
        return true;

    } catch (err) {
        console.error("Arhiivi salvestamise erind:", err);
        näitaTeadet("Tekkis ootamatu viga arhiivi salvestamisel.");
        return false;
    }
 

}


// --- AUTOMAATNE ARHIIVIMISE FUNKTSIOON (KUU LÕPPSEIS) ---
async function salvestaVanaKuuArhiivi(kuuId) {
    try {
        const stateJson = JSON.stringify(koostaState());
        
        const now = new Date();
        const arhiiviId = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0")
        ].join("-");

        // Leia, kas samal minutil on juba versioone
        const { data: olemasolevad } = await sb
            .from("arhiiv")
            .select("versioon")
            .eq("arhiiviId", arhiiviId);

        let versioon = 1;
        if (olemasolevad && olemasolevad.length > 0) {
            versioon = Math.max(...olemasolevad.map(r => r.versioon)) + 1;
        }

        // Automaatse salvestamise puhul ei pea sisselogijat teadma
        const { error } = await sb
            .from("arhiiv")
            .insert({
                arhiiviId: arhiiviId,
                kuu_id: kuuId,
                state: stateJson,
                salvestaja: "automaatne",
                paeritolu: "automaatne",
                taastatud: false,
                versioon: versioon
            });

               if (error) {
            console.error("Automaatse arhiivimise viga:", error);
            return false;
        }

        
       

        console.log(`✓ Kuu ${kuuId} lõppseis automaatselt salvestatud arhiivi (${arhiiviId} v${versioon})`);
        return true;


        console.log(`✓ Kuu ${kuuId} lõppseis automaatselt salvestatud arhiivi (${arhiiviId} v${versioon})`);
        return true;

    } catch (err) {
        console.error("Automaatse arhiivimise erind:", err);
        return false;
    }
}

async function logiTegevusSupabasse(tegevus, detailid = {}) {
    const { data: userData } = await sb.auth.getUser();
    const userEmail = userData?.user?.email || null;

    const { error } = await sb
        .from("logid")
        .insert({ tegevus, detailid, user_email: userEmail });

    if (error) console.error("Logimise viga:", error);
}

async function laeArhiiv(kuuId) {
    const { data, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("kuu_id", kuuId)
        .order("id", { ascending: false })
        .limit(1);

    if (error) {
        console.error("Arhiivi laadimise viga:", error);
        return null;
    }

    return data?.[0] || null;
}

// --- ABIFUNKTSIOONID ---
function paevadeArvKuus(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function kuupString(year, monthIndex, day) {
    const m = String(monthIndex + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
}

function onNadalavahetus(dateObj) {
    const day = dateObj.getDay();
    return day === 0 || day === 6;
}

function onPyha(dateStr) {
    return Boolean(seaded?.eripaevad?.[dateStr]);
}

function onTäna(dateStr) {
    const täna = new Date();
    const y = täna.getFullYear();
    const m = String(täna.getMonth() + 1).padStart(2, "0");
    const d = String(täna.getDate()).padStart(2, "0");
    return dateStr === `${y}-${m}-${d}`;
}

function näitaTeadet(msg) {
    teadeEl.textContent = msg;
}

// --- DÜNAAMILINE TABELI GENEREERIMINE ---
async function genereeriKuuTabel() {
    if (!seaded) {
        seaded = await laeSeaded(); // laeme veerud + eripäevad
    }
    genereeriPaise(seaded.veerud);
    genereeriJalus(seaded.veerud);

    const veerud = seaded.veerud;        // [{nimi, pealkiri, hind, tüüp, ...}]
    const eripaevad = seaded.eripaevad;  // {"2025-12-24": {nimi, värv}}

    const [yearStr, monthStr] = kuuValik.value.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;

    tbody.innerHTML = "";
    const päevadeArv = paevadeArvKuus(year, monthIndex);

    for (let day = 1; day <= päevadeArv; day++) {
        const dateObj = new Date(year, monthIndex, day);
        const dateStr = kuupString(year, monthIndex, day);

        const tr = document.createElement("tr");
        tr.dataset.date = dateStr;

        // --- Kuupäeva veerg ---
        const kuupTd = document.createElement("td");
        kuupTd.textContent = `${String(day).padStart(2, "0")}.${monthStr}.${year}`;
        tr.appendChild(kuupTd);

        // --- DÜNAAMILISED VEERUD ---
        for (const v of veerud) {
            const td = document.createElement("td");

            // TOIDUVEERG (kogus × hind)
            if (v.tüüp === "toit") {
                const inp = document.createElement("input");
                inp.type = "number";
                inp.min = "0";
                inp.value = "0";
                inp.dataset.veeruNimi = v.nimi;
                inp.dataset.veeruTüüp = v.tüüp;

                inp.addEventListener("input", arvuta);
                td.appendChild(inp);
            }

            // NUMBER VEERG (nt külalised, tasuta portsud)
            else if (v.tüüp === "number") {
                const inp = document.createElement("input");
                inp.type = "number";
                inp.min = "0";
                inp.value = "0";
                inp.dataset.veeruNimi = v.nimi;
                inp.dataset.veeruTüüp = v.tüüp;



                inp.addEventListener("input", arvuta);
                td.appendChild(inp);
            }

            // TEKSTI VEERG (kommentaarid)
            else if (v.tüüp === "tekst" || v.tüüp === "kommentaar") {
                const inp = document.createElement("input");
                inp.type = "text";
                inp.value = "";
                inp.dataset.veeruNimi = v.nimi;
                inp.dataset.veeruTüüp = v.tüüp;

                inp.addEventListener("input", arvuta); // kui vaja
                td.appendChild(inp);
            }

            tr.appendChild(td);
        }

        // --- KOKKU VEERG ---
        const kokkuTd = document.createElement("td");
        kokkuTd.classList.add("kokku-cell");
        kokkuTd.textContent = "0.00 €";
        tr.appendChild(kokkuTd);

        // --- ERIPÄEVAD ---
        if (eripaevad[dateStr]) {
            tr.classList.add("holiday");
            tr.style.background = eripaevad[dateStr].värv;
            tr.title = eripaevad[dateStr].nimi;
        }

        // --- NÄDALAVAHETUS / TÄNA ---
        if (onNadalavahetus(dateObj)) tr.classList.add("weekend");
        if (onTäna(dateStr)) tr.classList.add("today");

        tbody.appendChild(tr);
    }

    rakendaLukustusOlek();
    arvuta();
}
function genereeriPaise(veerud) {
    const head = document.getElementById("tabelHead");

    let html = "<tr>";
    html += "<th>Kuupäev</th>";

    veerud.forEach(v => {
        if (v.tüüp === "toit") {
            html += `<th>${v.pealkiri}<br>${Number(v.hind).toFixed(2)} €</th>`;
        } else {
            html += `<th>${v.pealkiri}</th>`;
        }
    });

    html += "<th>KOKKU</th>";
    html += "</tr>";

    head.innerHTML = html;
}



function genereeriJalus(veerud) {
    const foot = document.getElementById("tabelFoot");

    // --- KOGUSEREA ---
    let kogusRow = "<tr class='summary-row kogus-row'>";
    kogusRow += "<td>Kogus kokku</td>";

    veerud.forEach((v, idx) => {
        if (v.tüüp === "toit" || v.tüüp === "number") {
            kogusRow += `<td id="sumKogus${idx}">0</td>`;
        } else {
            kogusRow += "<td>-</td>";
        }
    });

    kogusRow += "<td></td>";
    kogusRow += "</tr>";

    // --- HINNARIDA ---
    let hindRow = "<tr class='summary-row hind-row'>";
    hindRow += "<td>Kogus × hind</td>";

    veerud.forEach((v, idx) => {
        if (v.tüüp === "toit") {
            hindRow += `<td id="sumHind${idx}">0.00 €</td>`;
        } else {
            hindRow += "<td>-</td>";
        }
    });

    hindRow += `<td id="kuuKokku">0.00 €</td>`;
    hindRow += "</tr>";

    foot.innerHTML = kogusRow + hindRow;
}
// --- DÜNAAMILINE TABELI TÄITMINE SUPABASE ANDMETEGA ---
function täidaTabelSupabaseAndmetega(andmed) {
    const rows = tbody.querySelectorAll("tr");

    andmed.forEach(rida => {
        const supaDate = rida.kuupaev.split("T")[0];

        rows.forEach(row => {
            if (row.dataset.date === supaDate) {

                const inputs = row.querySelectorAll("input");

                inputs.forEach(inp => {
                    const veeruNimi = inp.dataset.veeruNimi;

                    if (veeruNimi && rida[veeruNimi] !== undefined) {
                        inp.value = rida[veeruNimi];
                    }
                });
            }
        });
    });

    arvuta();
}



// --- DÜNAAMILISED ARVUTUSED (AJALOO KONTROLLIGA) ---
function arvuta() {
    if (!seaded) return;

    const veerud = seaded.veerud;
    const rows = tbody.querySelectorAll("tr");

    let kuuSumma = 0;

    const kogused = {};
    const hinnasummad = {};

    veerud.forEach(v => {
        kogused[v.nimi] = 0;
        hinnasummad[v.nimi] = 0;
    });

    rows.forEach(row => {
        // ✅ TUVASTAME REA KUUPÄEVA (nt "2026-07-25")
        const kuupaev = row.dataset.date; 
        
        const inputs = row.querySelectorAll("input");
        const kokkuCell = row.querySelector(".kokku-cell");
        let ridaSumma = 0;

        inputs.forEach(inp => {
            const veeruNimi = inp.dataset.veeruNimi;
            const veeruInfo = veerud.find(v => v.nimi === veeruNimi);
            if (!veeruInfo) return;

            const kogus = Number(inp.value) || 0;

            if (veeruInfo.tüüp === "toit" || veeruInfo.tüüp === "number") {
                kogused[veeruNimi] += kogus;
            }

            if (veeruInfo.tüüp === "toit") {
                // 🚀 PARANDATUD: Küsime hinna otse selle päeva ajaloo seest!
                const hind = leiaHinnaAjaloost(veeruNimi, kuupaev);
                const summa = kogus * hind;

                hinnasummad[veeruNimi] += summa;
                ridaSumma += summa;
            }
        });

        if (kokkuCell) kokkuCell.textContent = ridaSumma.toFixed(2) + " €";
        kuuSumma += ridaSumma;
    });

    veerud.forEach((v, idx) => {
        const kogusElem = document.getElementById("sumKogus" + idx);
        const hindElem = document.getElementById("sumHind" + idx);

        if (kogusElem) kogusElem.textContent = kogused[v.nimi];

        if (hindElem) {
            if (v.tüüp === "toit") {
                hindElem.textContent = hinnasummad[v.nimi].toFixed(2) + " €";
            } else {
                hindElem.textContent = "-";
            }
        }
    });

    const kuuKokkuEl = document.getElementById("kuuKokku");
    if (kuuKokkuEl) kuuKokkuEl.textContent = kuuSumma.toFixed(2) + " €";
}




// --- LUKUSTUS ---
function rakendaLukustusOlek() {
    const kõikInputid = tbody.querySelectorAll("input");

    if (tabelLukus) {
        tabelEl.classList.add("table-locked");
        lukustaNupp.textContent = "Tabel lukus (ava sisestamiseks)";

        kõikInputid.forEach(inp => {
            inp.disabled = true;
            if (inp.dataset.veeruTüüp === "toit" || inp.dataset.veeruTüüp === "number") {
                inp.parentElement.classList.remove("kogus-lahter");
            }
        });

    } else {
        tabelEl.classList.remove("table-locked");
        lukustaNupp.textContent = "Tabel avatud (lukusta)";

        kõikInputid.forEach(inp => {
            inp.disabled = false;
            if (inp.dataset.veeruTüüp === "toit" || inp.dataset.veeruTüüp === "number") {
                inp.parentElement.classList.add("kogus-lahter");
            }
        });
    }
}

function rakendaRolliLukustus() {
    if (praeguneKuu !== reaalneKuu) {
        tabelLukus = true;
        rakendaLukustusOlek(); // ← ✅ LISATUD SULUD, et funktsioon käivituks
        return true;
    }

    // ✅ LUBAME KA SUPERADMINIL SISENEDA:
    if (roll !== "superadmin" && roll !== "admin" && roll !== "sisestaja") {
        tabelLukus = true;
        rakendaLukustusOlek(); // ← ✅ LISATUD SULUD, et funktsioon käivituks
        return true;
    }
    return false;
}



// --- DÜNAAMILINE SALVESTAMINE ---
salvestaNupp.addEventListener("click", async () => {
    const kuuId = kuuValik.value;
    const rows = tbody.querySelectorAll("tr");

    for (let row of rows) {
        const kuupaev = row.dataset.date;
        const inputs = row.querySelectorAll("input");

        const rida = { kuu_id: kuuId, kuupaev };

        inputs.forEach(inp => {
            const veeruNimi = inp.dataset.veeruNimi;
            const veeruTüüp = inp.dataset.veeruTüüp;

            if (!veeruNimi) return;

            if (veeruTüüp === "toit" || veeruTüüp === "number") {
                rida[veeruNimi] = Number(inp.value) || 0;
            } else {
                rida[veeruNimi] = inp.value || "";
            }
        });

        try {
            await salvestaSupabasse(rida);
        } catch (err) {
            console.error("VIGA SALVESTAMISEL:", err, rida);
        }
    }

   

      
    tabelLukus = true;
    rakendaLukustusOlek();
    
    // ✅ LISATUD: Logime tegevuse "salvestus" koos kuu ID-ga
    await logiTegevusSupabasse("salvestus", { kuu: kuuId });

    näitaTeadet("Salvestatud ja lukustatud.");
    alert("Andmed salvestatud!");


    // =========================================================================
    // ✅ 🌟 ÕIGE KOHT: KÜLMVAATE SNAPSHOT SALVESTATAKSE SIIN 🌟
    // =========================================================================
   

// --- ARHIIVI SALVESTAMINE ---
arhiiviNupp.addEventListener("click", salvestaArhiivi);

async function salvestaArhiivi() {
    try {
        const kuuId = praeguneKuu;

        const now = new Date();
        const arhiiviId = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
            String(now.getHours()).padStart(2, "0"),
            String(now.getMinutes()).padStart(2, "0")
        ].join("-");

        const { data: olemasolevad } = await sb
            .from("arhiiv")
            .select("versioon")
            .eq("arhiiviId", arhiiviId);

        let versioon = 1;
        if (olemasolevad && olemasolevad.length > 0) {
            versioon = Math.max(...olemasolevad.map(r => r.versioon)) + 1;
        }

        // ← ÕIGE!
        const stateJson = JSON.stringify(koostaState());

        const { data: userData } = await sb.auth.getUser();
        const salvestaja = userData?.user?.email ?? "tundmatu";

        const { error } = await sb
            .from("arhiiv")
            .insert({
                arhiiviId: arhiiviId,
                kuu_id: kuuId,
                state: stateJson,   // ← PARANDATUD!
                salvestaja: salvestaja,
                paeritolu: "aktiivne",
                taastatud: false,
                versioon: versioon
            });

        // ... (eelnev insert loogika)

        if (error) {
            console.error("Arhiivi salvestamise viga:", error);
            alert("Arhiivi salvestamine ebaõnnestus.");
            return;
        }

        // ✅ ÕIGE KOHT: Logimine asünkroonse funktsiooni sees
        try {
            await logiTegevusSupabasse("arhiiv", { kuu: kuuId, arhiiviId: arhiiviId });
        } catch (logiErr) {
            console.error("Viga logimisel:", logiErr);
        }

        alert(`Arhiiv salvestatud: ${arhiiviId}`);
    } catch (err) {
        console.error("Viga:", err);
    }
}





// --- DÜNAAMILINE ARHIIVI KUVA ---
async function kuvaArhiiv() {
    const kuuId = kuuValik.value;
    const arhiiv = await laeArhiiv(kuuId);

    if (!arhiiv) {
        arhiiviKuva.style.display = "none";
        return;
    }

    let state = arhiiv.state;
    if (typeof state === "string") {
        try { state = JSON.parse(state); }
        catch { arhiiviKuva.style.display = "none"; return; }
    }

    if (!state.rows || !Array.isArray(state.rows)) return;
    if (!state.veerud || !Array.isArray(state.veerud)) return;

    const veerud = state.veerud;

    const theadHtml = `
        <tr>
            <th>Kuupäev</th>
            ${veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
        </tr>
    `;

    const tbodyHtml = state.rows.map(r => `
        <tr>
            <td>${r.kuupäev}</td>
            ${veerud.map(v => `<td>${r[v.nimi] ?? ""}</td>`).join("")}
        </tr>
    `).join("");

    arhiiviKuva.style.display = "block";
    arhiiviKuva.innerHTML = `
        <h3>Arhiiv: ${state.kuu}</h3>
        <table class="arhiivi-tabel">
            <thead>${theadHtml}</thead>
            <tbody>${tbodyHtml}</tbody>
        </table>
        <p><strong>Kuu kokku:</strong> ${state.kuuKokku}</p>
    `;
}


// --- PUUDUV FUNKTSIOON 1 ---
function rakendaLukustusArhiivivaates() {
    if (praeguneKuu !== reaalneKuu) {
        tabelLukus = true;
        rakendaLukustusOlek();
        return true;
    }
    return false;
}

// --- PUUDUV FUNKTSIOON 2 ---
function tabelLahti() {
    tabelLukus = false;
    rakendaLukustusOlek();
}


// --- LUKUSTUSNUPP ---
lukustaNupp.addEventListener("click", () => {
    tabelLukus = !tabelLukus;
    rakendaLukustusOlek();
    näitaTeadet(tabelLukus ? "Tabel lukustatud." : "Tabel avatud.");
});


// --- PRINT ---
prindiNupp.addEventListener("click", () => {
    window.print();
    tabelLukus = true;
    rakendaLukustusOlek();
});


// --- ALLALAADIMINE ---
laeAllaNupp.addEventListener("click", () => {
    tabelLukus = true;
    rakendaLukustusOlek();
    näitaTeadet("Allalaadimine (tulevikus PDF).");
});


// --- KUU VAHETUS (AUTOMAATNE ARHIIVIMIS MÄRGISTUSE FUNKTSIOON) ---
kuuValik.addEventListener("change", async () => {
    const vanaKuu = praeguneKuu;  // Salvesta vana kuu enne muutmist
    const uusKuu = kuuValik.value;
    
    // ✓ AUTOMAATNE ARHIIVIMIS: Kui vahetub eri kuu, salvesta vana kuu lõppseis
    if (vanaKuu !== uusKuu) {
        console.log(`Kuu vahetamine: ${vanaKuu} → ${uusKuu}`);
        const edukas = await salvestaVanaKuuArhiivi(vanaKuu);
        if (edukas) {
            näitaTeadet(`Kuu ${vanaKuu} lõppseis automaatselt salvestatud.`);
        }
    }
    
    praeguneKuu = uusKuu;

    await genereeriKuuTabel();
    const andmed = await laeKuuAndmedSupabasest(uusKuu);
    täidaTabelSupabaseAndmetega(andmed);

    await kuvaArhiiv();
    uuendaVaateReziim();

    if (rakendaRolliLukustus()) return;
    if (rakendaLukustusArhiivivaates()) return;

    tabelLahti();
    await logiTegevusSupabasse("kuu_vahetus", { kuu: uusKuu });
});


// --- VISUAALNE REŽIIM ---
function uuendaVaateReziim() {
    const box = document.getElementById("vaateReziim");
    if (!box) return;

    // 1. Kontrollime, kas andmed tulid just praegu arhiivist taastamise kaudu
    const taastatudState = localStorage.getItem("taastatudState");
    if (taastatudState) {
        box.style.display = "block";
        box.style.background = "#fff9db"; // Kollane/Hoiatav toon
        box.style.color = "#b07d00";
        box.innerHTML = `🌟 <strong>Taastatud seis:</strong> Kuvatakse arhiivist laetud andmeid. Salvestamiseks vajuta 'Salvesta'.`;
        return;
    }

    // 2. Kui vaadatakse tavalist jooksva kuu tabelit
    box.style.display = "block";
    box.style.background = "#e6fffa"; // Roheline/Puhas toon
    box.style.color = "#006d5b";
    
    if (tabelLukus) {
        box.innerHTML = `👁️ <strong>Vaatlusrežiim:</strong> Kuu ${praeguneKuu} tabel on lukus (ainult lugemiseks).`;
        box.style.background = "#f1f3f5";
        box.style.color = "#495057";
    } else {
        box.innerHTML = `✍️ <strong>Sisestusrežiim:</strong> Kuu ${praeguneKuu} tabel on avatud andmete täitmiseks.`;
    }
}



// --- INIT ---


document.addEventListener("DOMContentLoaded", () => {
    console.log("INIT START");
    
 
    init();
});
// =========================================================================
// ✅ SÜNKRONISEERITUD PRINTIMISE KÄSITLEMINE KASSATABELI HTML-IS (TÕSTETUD LOGIC.JS SISSE)
// =========================================================================
window.addEventListener("beforeprint", () => {
    const printHeader = document.getElementById("printHeader");
    const printTitle = document.getElementById("printTitle");
    const h2Pealkiri = document.querySelector("h2");
    const selector = document.getElementById("kuuValik");
    
    let kuuJaAastaTekst = "";

    // Otsime tabeli esimest rida kuupäeva tuvastamiseks (nt "01.07.2026")
    const esimeneRida = document.querySelector("tbody tr[data-date]");
    if (esimeneRida) {
        const kuupaevaTekst = esimeneRida.dataset.date || esimeneRida.querySelector("td")?.textContent || "";
        
        if (kuupaevaTekst && kuupaevaTekst.includes(".")) {
            const osad = kuupaevaTekst.split(".");
            if (osad.length >= 3) {
                const kuuNr = parseInt(osad[1], 10); // Kuu on keskmine element
                const aastaNr = osad[2];            // Aasta on viimane
                const kuudeNimed = ["Jaanuar", "Veebruar", "Märts", "Aprill", "Mai", "Juuni", "Juuli", "August", "September", "Oktoober", "November", "Detsember"];
                if (kuuNr >= 1 && kuuNr <= 12) {
                    kuuJaAastaTekst = `${kuudeNimed[kuuNr - 1]} ${aastaNr}`;
                }
            }
        }
    }

    // Varulahendus: Kui tabelist ei saanud, proovime dropdowni valikut
    if (!kuuJaAastaTekst && selector && selector.options[selector.selectedIndex]) {
        kuuJaAastaTekst = selector.options[selector.selectedIndex].text;
    }

    // Kirjutame teksti Sinu HTML-i printTitle sisse ja teeme päise nähtavaks
    if (printTitle) {
        printTitle.textContent = `${kuuJaAastaTekst || "Kassatabel"} – Kassatabel`;
    }
    if (printHeader) {
        printHeader.style.display = "flex";
        printHeader.style.setProperty("display", "flex", "important");
    }
    
    if (h2Pealkiri) h2Pealkiri.style.display = "none";

    // Peidame vaaterežiimi riba
    const vReziim = document.getElementById("vaateReziim");
    if (vReziim) vReziim.style.display = "none";

    // Muudame input-kastid prindi ajaks tekstiks
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
    const printHeader = document.getElementById("printHeader");
    const h2Pealkiri = document.querySelector("h2");
    if (printHeader) printHeader.style.display = "none";
    if (h2Pealkiri) h2Pealkiri.style.display = "block";

    const vReziim = document.getElementById("vaateReziim");
    if (vReziim) vReziim.style.display = "block";

    // Taastame input-kastid
    document.querySelectorAll(".print-value").forEach(span => span.remove());
    document.querySelectorAll("td input").forEach(inp => {
        if (inp.dataset.wasVisible === "true") {
            inp.style.display = "";
            inp.removeAttribute("data-was-visible");
        }
    });
});

