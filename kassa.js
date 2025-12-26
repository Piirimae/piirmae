// =========================
//  LOGIC.JS — PUHAS TABELILOOGIKA
// =========================

// Need elemendid on vajalikud DOM-i jaoks
let seaded = null;
const tabelEl = document.getElementById("kassatabel");
const tbody = document.getElementById("tbody");

const teadeEl = document.getElementById("teade");

// =========================
//  TABELI TÄITMINE SUPABASE ANDMETEGA
//  (Supabase päring ise EI OLE siin failis!)
// =========================

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
// =========================
//  TABELI DÜNAAMILINE GENEREERIMINE
// =========================

async function genereeriKuuTabel() {
    if (!seaded || !seaded.veerud) {
        console.error("Seaded puuduvad — ei saa tabelit genereerida.");
        return;
    }

    const veerud = seaded.veerud;

    // --- PÄIS ---
    const thead = document.getElementById("tabelHead");
    thead.innerHTML = `
        <tr>
            <th>Kuupäev</th>
            ${veerud.map(v => `<th>${v.pealkiri}</th>`).join("")}
            <th>Kokku</th>
        </tr>
    `;

    // --- JALUS ---
    const tfoot = document.getElementById("tabelFoot");
    tfoot.innerHTML = `
        <tr>
            <td><strong>Kokku</strong></td>
            ${veerud
                .map((v, idx) => `
                    <td>
                        <div id="sumKogus${idx}" class="summa-kogus"></div>
                        <div id="sumHind${idx}" class="summa-hind"></div>
                    </td>
                `)
                .join("")}
            <td id="kuuKokku"><strong>0 €</strong></td>
        </tr>
    `;

    // --- KEHA ---
    const tbody = document.getElementById("tbody");
    tbody.innerHTML = "";

    const kuuId = kuuValik.value;
    const [year, month] = kuuId.split("-");
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month}-${String(day).padStart(2, "0")}`;

        const tr = document.createElement("tr");
        tr.dataset.date = dateStr;

        tr.innerHTML = `
            <td>${dateStr}</td>
            ${veerud
                .map(v => {
                    return `
                        <td>
                            <input 
                                type="text"
                                data-veeru-nimi="${v.nimi}"
                                data-veeru-tüüp="${v.tüüp}"
                                class="tabel-input"
                            />
                        </td>
                    `;
                })
                .join("")}
            <td class="kokku-cell">0 €</td>
        `;

        tbody.appendChild(tr);
    }

    // --- INPUTITE SÜNDMUSED ---
    tbody.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => {
            arvuta();
        });
    });

    // Esmane arvutus
    arvuta();
}

// =========================
//  DÜNAAMILISED ARVUTUSED
// =========================

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
            hindElem.textContent =
                v.tüüp === "toit"
                    ? hinnasummad[v.nimi].toFixed(2) + " €"
                    : "-";
        }
    });

    document.getElementById("kuuKokku").textContent = kuuSumma.toFixed(2) + " €";
}

// =========================
//  LUKUSTUS — ainult visuaalne
//  (päris lukustus läheb kassatabel.js-i)
// =========================

function rakendaLukustusOlek(tabelLukus) {
    const kõikInputid = tbody.querySelectorAll("input");

    if (tabelLukus) {
        tabelEl.classList.add("table-locked");

        kõikInputid.forEach(inp => {
            inp.disabled = true;
            if (inp.dataset.veeruTüüp === "toit" || inp.dataset.veeruTüüp === "number") {
                inp.parentElement.classList.remove("kogus-lahter");
            }
        });

    } else {
        tabelEl.classList.remove("table-locked");

        kõikInputid.forEach(inp => {
            inp.disabled = false;
            if (inp.dataset.veeruTüüp === "toit" || inp.dataset.veeruTüüp === "number") {
                inp.parentElement.classList.add("kogus-lahter");
            }
        });
    }
}

// =========================
//  ABIFUNKTSIOONID
// =========================

function näitaTeadet(msg) {
    teadeEl.textContent = msg;
}








