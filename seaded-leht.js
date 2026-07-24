import { laeSeaded, lisaVeerg, kustutaVeerg, uuendaVeerg, lisaEripaev, kustutaEripaev } from "./seaded.js";

// ✅ Ekspordime funktsioonid globaalselt, et HTML inline onclick/onchange saaksid neile pihta
window.uuendaVeergVali = async (id, muudatused) => {
    await uuendaVeerg(id, muudatused);
    console.log(`Veerg ID ${id} uuendatud:`, muudatused);
};

window.kustutaVeergVali = async (id) => {
    if (confirm("Kas kindlasti kustutada see veerg?")) {
        await kustutaVeerg(id);
        await laeLeht();
    }
};

window.kustutaEripaevVali = async (kuupaev) => {
    if (confirm(`Kas kustutada eripäev ${kuupaev}?`)) {
        await kustutaEripaev(kuupaev);
        await laeLeht();
    }
};

async function laeLeht() {
    const seaded = await laeSeaded();

    const tbody = document.querySelector("#veeruTabel tbody");
    if (tbody) {
        tbody.innerHTML = "";
        seaded.veerud.forEach(v => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><input value="${v.pealkiri}" onchange="window.uuendaVeergVali(${v.id}, { pealkiri: this.value })"></td>
                <td><input value="${v.nimi}" onchange="window.uuendaVeergVali(${v.id}, { nimi: this.value })"></td>
                <td><input value="${v.hind ?? ''}" onchange="window.uuendaVeergVali(${v.id}, { hind: this.value || null })"></td>
                <td><input value="${v.tüüp}" onchange="window.uuendaVeergVali(${v.id}, { tüüp: this.value })"></td>
                <td><button onclick="window.kustutaVeergVali(${v.id})">X</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    const ebody = document.querySelector("#eripaevTabel tbody");
    if (ebody) {
        ebody.innerHTML = "";
        Object.entries(seaded.eripaevad).forEach(([kuup, p]) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${kuup}</td>
                <td>${p.nimi}</td>
                <td><div style="width:20px;height:20px;background:${p.värv}"></div></td>
                <td><button onclick="window.kustutaEripaevVali('${kuup}')">X</button></td>
            `;
            ebody.appendChild(tr);
        });
    }
}

window.lisaVeeruRida = () => {
    lisaVeerg("uus", "Uus veerg", null, "tekst").then(laeLeht);
};

window.lisaEripaevRida = () => {
    const kuup = prompt("Kuupäev (YYYY-MM-DD)");
    if (!kuup) return;
    const nimi = prompt("Nimi");
    const värv = prompt("Värv (#rrggbb)");
    lisaEripaev(kuup, nimi, värv).then(laeLeht);
};

// Käivitame lehe laadimise
laeLeht();
