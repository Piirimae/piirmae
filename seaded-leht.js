// seaded-leht.js (MOODUL)
import { laeSeaded, lisaVeerg, kustutaVeerg, uuendaVeerg, lisaEripaev, kustutaEripaev } from "./seaded.js";
import { logiTegevus } from "./auth.js"; // ✅ LISATUD: Impordime logimise funktsiooni

// ==========================================
//  VEERGUDE JA ERIPÄEVADE MUUTMINE JA LOGID
// ==========================================

window.uuendaVeergVali = async (id, muudatused) => {
    await uuendaVeerg(id, muudatused);
    
    // ✅ Tuvastame, mis väljaga oli tegu (pealkiri, nimi, hind või tüüp) ja logime täpselt selle tüübi
    const võti = Object.keys(muudatused)[0]; 
    await logiTegevus(`seaded_${võti}`, { veeruId: id, uusVäärtus: muudatused[võti] });
    
    console.log(`Logitud tegevus: seaded_${võti}`, muudatused);
};

window.kustutaVeergVali = async (id) => {
    if (confirm("Kas kindlasti kustutada see veerg?")) {
        await kustutaVeerg(id);
        
        // ✅ LISATUD: Logime veeru kustutamise
        await logiTegevus("-veerg", { veeruId: id });
        
        await laeLeht();
    }
};

window.kustutaEripaevVali = async (kuupaev) => {
    if (confirm(`Kas kustutada eripäev ${kuupaev}?`)) {
        await kustutaEripaev(kuupaev);
        
        // ✅ LISATUD: Logime eripäeva kustutamise
        await logiTegevus("-eripäev", { kuupaev: kuupaev });
        
        await laeLeht();
    }
};

// ==========================================
//  LEHE LAADIMINE JA GENEREERIMINE
// ==========================================
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

// ==========================================
//  LISAMISE NUPUD JA LOGID
// ==========================================
window.lisaVeeruRida = () => {
    lisaVeerg("uus", "Uus veerg", null, "tekst").then(async () => {
        // ✅ LISATUD: Logime uue veeru lisamise
        await logiTegevus("+veerg", { nimi: "uus", pealkiri: "Uus veerg" });
        await laeLeht();
    });
};

window.lisaEripaevRida = () => {
    const kuup = prompt("Kuupäev (YYYY-MM-DD)");
    if (!kuup) return;
    const nimi = prompt("Nimi");
    const värv = prompt("Värv (#rrggbb)");
    
    lisaEripaev(kuup, nimi, värv).then(async () => {
        // ✅ LISATUD: Logime uue eripäeva lisamise
        await logiTegevus("+eripäev", { kuupaev: kuup, nimi: nimi });
        await laeLeht();
    });
};

// Käivitame lehe alglaadimise
laeLeht();

