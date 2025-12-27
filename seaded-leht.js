import { laeSeaded, lisaVeerg, kustutaVeerg, uuendaVeerg, lisaEripaev, kustutaEripaev } from "./seaded.js";

async function laeLeht() {
    const seaded = await laeSeaded();

    const tbody = document.querySelector("#veeruTabel tbody");
    tbody.innerHTML = "";

    seaded.veerud.forEach(v => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input value="${v.pealkiri}" onchange="uuendaVeerg(${v.id}, { pealkiri: this.value })"></td>
            <td><input value="${v.nimi}" onchange="uuendaVeerg(${v.id}, { nimi: this.value })"></td>
            <td><input value="${v.hind ?? ''}" onchange="uuendaVeerg(${v.id}, { hind: this.value })"></td>
            <td><input value="${v.tüüp}" onchange="uuendaVeerg(${v.id}, { tüüp: this.value })"></td>
            <td><button onclick="kustutaVeerg(${v.id}).then(laeLeht)">X</button></td>
        `;
        tbody.appendChild(tr);
    });

    const ebody = document.querySelector("#eripaevTabel tbody");
    ebody.innerHTML = "";

    Object.entries(seaded.eripaevad).forEach(([kuup, p]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${kuup}</td>
            <td>${p.nimi}</td>
            <td><div style="width:20px;height:20px;background:${p.värv}"></div></td>
            <td><button onclick="kustutaEripaev('${kuup}').then(laeLeht)">X</button></td>
        `;
        ebody.appendChild(tr);
    });
}

window.lisaVeeruRida = () => {
    lisaVeerg("uus", "Uus veerg", null, "tekst").then(laeLeht);
};

window.lisaEripaevRida = () => {
    const kuup = prompt("Kuupäev (YYYY-MM-DD)");
    const nimi = prompt("Nimi");
    const värv = prompt("Värv (#rrggbb)");
    lisaEripaev(kuup, nimi, värv).then(laeLeht);
};

laeLeht();
