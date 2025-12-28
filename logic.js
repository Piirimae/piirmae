import { sb } from "./supabase.js";
import { laeSeaded } from "./seaded.js";

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


async function init() {
    täidaKuuValik();
    praeguneKuu = document.getElementById("kuuValik").value;

    seaded = await laeSeaded();
    await genereeriKuuTabel();

    const andmed = await laeKuuAndmedSupabasest(praeguneKuu);
    täidaTabelSupabaseAndmetega(andmed);

    await kuvaArhiiv();
    uuendaVaateReziim();
    rakendaRolliLukustus();
}

// --- SUPABASE FUNKTSIOONID ---
async function kuvaKasutajaNimi() {
    const user = await sb.auth.getUser();
    const email = user.data.user.email;
    const el = document.getElementById("kasutajaNimi");
    if (el) el.textContent = email;
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
        const { error } = await sb
            .from("arhiiv")
            .insert({
                arhiiviId: arhiiviId,
                kuu_id: kuuId,
                state: JSON.parse(stateJson),
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


// --- DÜNAAMILISED ARVUTUSED ---
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
                const hind = Number(veeruInfo.hind) || 0;
                const summa = kogus * hind;

                hinnasummad[veeruNimi] += summa;
                ridaSumma += summa;
            }
        });

        kokkuCell.textContent = ridaSumma.toFixed(2) + " €";
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

    document.getElementById("kuuKokku").textContent = kuuSumma.toFixed(2) + " €";
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
        tabelLukus = true;   // ← PARANDATUD
        return true;
    }

    if (roll !== "admin" && roll !== "sisestaja") {
        tabelLukus = true;   // ← PARANDATUD
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

    await logiTegevusSupabasse("salvestus", { kuu: kuuId });

    tabelLukus = true;
    rakendaLukustusOlek();
    näitaTeadet("Salvestatud ja lukustatud.");
});
function koostaState() {
    const read = Array.from(tbody.querySelectorAll("tr"));

    return read.map(rida => {
        const inputs = Array.from(rida.querySelectorAll("td input"));
        const kokkuCell = rida.querySelector(".kokku-cell")?.textContent ?? "0.00 €";

        // loeme kõik inputid järjest
        const veerud = inputs.map(inp => inp.value);

        return {
            kuupäev: rida.dataset.date,
            veerud: veerud,
            kokku: kokkuCell
        };
    });
}


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

        if (error) {
            console.error("Arhiivi salvestamise viga:", error);
            alert("Arhiivi salvestamine ebaõnnestus.");
            return;
        }

        alert(`Arhiivi salvestatud: ${arhiiviId} (versioon ${versioon})`);

    } catch (err) {
        console.error("Arhiivi salvestamise erind:", err);
        alert("Tekkis ootamatu viga arhiivi salvestamisel.");
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
            <td>${r.kuupaev}</td>
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


// --- KUU VAHETUS ---
kuuValik.addEventListener("change", async () => {
    const uusKuu = kuuValik.value;
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

    if (praeguneKuu !== reaalneKuu) {
        box.style.display = "block";
        box.textContent = `Arhiivivaade: ${praeguneKuu} (lukus)`;
        box.classList.add("lukus");
        return;
    }

    box.style.display = "block";
    box.textContent = `Aktiivne kuu: ${praeguneKuu}`;
    box.classList.remove("lukus");
}


// --- INIT ---
(async () => {
    await kuvaKasutajaNimi();

    await genereeriKuuTabel();
    const kuuId = kuuValik.value;
    const andmed = await laeKuuAndmedSupabasest(kuuId);
    täidaTabelSupabaseAndmetega(andmed);

    await kuvaArhiiv();
})();

document.addEventListener("DOMContentLoaded", () => {
    console.log("INIT START");
    init();
});



















;

































