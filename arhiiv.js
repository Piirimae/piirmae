import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, laeRoll, logout } from "./auth.js";

// --- DOM elemendid ---
const kuuValik = document.getElementById("kuuValik");
const arhiiviMeta = document.getElementById("arhiiviMeta");
const arhiiviKuva = document.getElementById("arhiiviKuva");
const arhiiviNupud = document.getElementById("arhiiviNupud");

console.log("arhiiv.js laaditud");

// --- Kohalik logimise funktsioon (sünkroniseeritud teiste lehtedega) ---
async function logiTegevusSupabasse(tegevus, detailid = {}) {
    const { data: userData } = await sb.auth.getUser();
    const userEmail = userData?.user?.email || null;
    await sb.from("logid").insert({ tegevus, detailid, user_email: userEmail });
}

// --- INIT ---
window.addEventListener("DOMContentLoaded", async () => {
    try {
        await kuvaKasutajaNimi();
    } catch (authError) {
        console.error("Kasutajanime kuvamise viga (auth.js):", authError);
    }
    await laeKuuValikud();
    await kuvaArhiiv();
});

// --- Lae kuude loetelu ---
async function laeKuuValikud() {
    const { data, error } = await sb
        .from("arhiiv")
        .select("arhiiviId, kuu_id, created_at, salvestaja, versioon, paeritolu")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Kuu valikute laadimise viga:", error);
        return;
    }

    kuuValik.innerHTML = data.map(r => {
        let versiooniMärgistus = r.paeritolu === "automaatne" ? "(automaatika)" : `(v${r.versioon})`;
        const label = `${r.kuu_id} ${versiooniMärgistus}`;

        return `
            <option 
                value="${r.arhiiviId}"
                data-kuu="${r.kuu_id}"
                data-created="${r.created_at}"
                data-salvestaja="${r.salvestaja}"
                data-versioon="${r.versioon}"
                data-paeritolu="${r.paeritolu || ''}"
            >
                ${label}
            </option>
        `;
    }).join("");

    kuuValik.addEventListener("change", kuvaArhiiv);
}

// 🔧 PARANDATUD JA TURVALINE PÄRING (failis arhiiv.js)
async function kuvaArhiiv() {
    const arhiiviId = kuuValik.value;
    if (!arhiiviId) return;

    // Küsime andmed massiivina, sorteerime versiooni järgi ja võtame ainult 1 kõige uuema [1.1]
    const { data: arhiivList, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .order("versioon", { ascending: false }) // Toob kõige uuema versiooni esimesena [1.1]
        .limit(1); // Kaotab ära 406 vea, kuna ei nõua rangelt ühte rida [1.1]

    if (error || !arhiivList || arhiivList.length === 0) {
        arhiiviMeta.innerHTML = "<p>Arhiivi ei leitud.</p>";
        arhiiviKuva.innerHTML = "";
        arhiiviNupud.innerHTML = "";
        return;
    }

    const data = arhiivList[0]; // Võtame massiivist selle esimese (kõige uuema) rea [1.1]
    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    kuvaMeta(data);
    kuvaTabel(state);
    kuvaNupud(data); // Anname andmed edasi nuppudele [1.1]
}


// --- Metaandmed ---
function kuvaMeta(kirje) {
    const d = new Date(kirje.created_at);
    const kuup = d.toLocaleDateString("et-EE");
    const aeg = d.toLocaleTimeString("et-EE");

    let arhiveerijaTekst = kirje.paeritolu === "automaatne" ? "(automaatika)" : kirje.salvestaja;
    let versiooniTekst = kirje.paeritolu === "automaatne" ? "(automaatika)" : kirje.versioon;

    arhiiviMeta.innerHTML = `
        <p><strong>Kuu:</strong> ${kirje.kuu_id}</p>
        <p><strong>Arhiveeritud:</strong> ${kuup}, ${aeg}</p>
        <p><strong>Arhiveeris:</strong> ${arhiveerijaTekst}</p>
        <p><strong>Versioon:</strong> ${versiooniTekst}</p>
    `;
}

// --- Tabel ---
function kuvaTabel(state) {
    if (!state.paise || !state.rows) {
        arhiiviKuva.innerHTML = "<p>Arhiivi formaat tundmatu või vigane.</p>";
        return;
    }

    const paise = state.paise;
    const rows = state.rows;

    const thead = `
        <thead>
            <tr>
                <th>Kuupäev</th>
                ${paise.map(v => v.tüüp === "toit" ? `<th>${v.pealkiri}<br><small>${Number(v.hind).toFixed(2)} €</small></th>` : `<th>${v.pealkiri}</th>`).join("")}
                <th>Kokku</th>
            </tr>
        </thead>
    `;

    const tbody = `
        <tbody>
            ${rows.map(r => `
                <tr>
                    <td>${r.kuupäev}</td>
                    ${r.veerud.map(v => `<td>${v}</td>`).join("")}
                    <td>${r.kokku}</td>
                </tr>
            `).join("")}
        </tbody>
    `;

    const tfoot = `
        <tfoot>
            <tr>
                <td>Kogus kokku</td>
                ${state.sumKogus.map(v => `<td>${v}</td>`).join("")}
                <td></td>
            </tr>
            <tr>
                <td>Kogus × hind</td>
                ${state.sumHind.map(v => `<td>${v}</td>`).join("")}
                <td>${state.kuuKokku}</td>
            </tr>
        </tfoot>
    `;

    arhiiviKuva.innerHTML = `<table class="arhiivi-tabel">${thead}${tbody}${tfoot}</table>`;
}

// --- Nupud ---
function kuvaNupud(kirje) {
    const roll = window.userRole || "vaataja";
    
    // Baasnupud kõigile rollidele
    let html = `
        <button onclick="window.print()" class="btn-small">Prindi vaade</button>
        <button disabled class="btn-small">Lae alla PDF (tulekul)</button>
        <button onclick="window.location='fuajee.html'" class="btn-small">⬅ Fuajee</button>
    `;

    // Admini ja superadmini ühised nupud
    if (["admin", "superadmin"].includes(roll)) {
        html += `<button id="taastaArhiivBtn" class="btn-small" style="background:#2ecc71; color:white; font-weight:bold;">Taasta aktiivseks kuuks</button>`;
    }
    
    // Ainult superadmini laiendatud nupud (Parandatud trükiviga r -> kirje)
    if (roll === "superadmin") {
        html += `
            <button onclick="window.location.href='parandus.html?arhiiviId=${kirje.arhiiviId}'" class="btn-small" style="background:#3498db; color:white;">🔧 Paranda arhiivi</button>
            <button class="admin" id="kustutaArhiivBtn" style="background:#e74c3c; color:white;">🗑 Kustuta arhiiv</button>
        `;
    }
    
    arhiiviNupud.innerHTML = html;
    
    // Käivitame nuppude klikikuulajad alles pärast seda, kui nad on ekraanile joonistatud
    SeostaNuppudeKlikid(kirje);
}

// UUS ABIFUNKTSIOON: Seob klikid turvaliselt külge, kontrollides enne, kas nupp on ekraanil olemas
function SeostaNuppudeKlikid(kirje) {
    const taastaBtn = document.getElementById("taastaArhiivBtn");
    if (taastaBtn) {
        taastaBtn.onclick = () => {
            taastaArhiivLoogika(kirje.arhiiviId, kirje.kuu_id);
        };
    }

    const kustutaBtn = document.getElementById("kustutaArhiivBtn");
    if (kustutaBtn) {
        kustutaBtn.onclick = async () => {
            if (!confirm(`Kas oled täiesti kindel, et soovid arhiivi ${kirje.arhiiviId} kustutada?`)) return;
            if (!confirm("⚠️ HOIATUS: See kustutab arhiivi andmebaasist jäädavalt! Kas jätkata?")) return;

            const { error } = await sb.from("arhiiv").delete().eq("arhiiviId", kirje.arhiiviId);
            if (!error) {
                await logiTegevusSupabasse("kustuta_arhiiv", { arhiiviId: kirje.arhiiviId, kuu: kirje.kuu_id });
                alert("Arhiiv edukalt kustutatud.");
                window.location.reload();
            } else {
                alert("Kustutamine ebaõnnestus: " + error.message);
            }
        };
    }
}



// ==========================================
//  TAASTAMINE, LOGOUT JA TEGEVUSED
// ==========================================

// --- TAASTAMISE AKTIIVNE PROTSESS (PARANDATUD JA TAIBUKAS) ---
async function taastaArhiivLoogika(arhiiviId, kuuId) {
    if (!confirm("Kas oled kindel, et soovid selle arhiiviseisu laadida käesoleva kuu aktiivseks tabeliks? See kirjutab praegused sisestused üle.")) return;

    const { data, error } = await sb
        .from("arhiiv")
        .select("*")
        .eq("arhiiviId", arhiiviId)
        .single();

    if (error || !data) {
        alert("Arhiivi laadimine ebaõnnestus.");
        return;
    }

    const state = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    // Tuvastame jooksva kalendrikuu (kujul YYYY-MM)
    const jooksevKuup = new Date();
    const jooksevKuuStr = `${jooksevKuup.getFullYear()}-${String(jooksevKuup.getMonth() + 1).padStart(2, '0')}`;

    await sb.from("arhiiv").update({ taastatud: true }).eq("arhiiviId", arhiiviId);

    // Logime tegevuse ametlikult logide tabelisse
    await logiTegevusSupabasse("taasta_aktiivne-kuu", { 
        algne_kuu: kuuId, 
        arhiiviId: arhiiviId, 
        siht_kuu: jooksevKuuStr 
    });

    // Salvestame andmed kotti jooksvaks kuuks
    localStorage.setItem("taastatudState", JSON.stringify(state));
    localStorage.setItem("taastatudKuu", jooksevKuuStr);

    alert(`Andmed ette valmistatud! Suunan Sind Kassatabeli lehele, kus see seis laetakse jooksva kuu (${jooksevKuuStr}) tabelisse.`);
    window.location.href = "kassatabel.html";
}

// --- Väljalogimise kuulaja ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}

// --- Dünaamiline pealkiri printimisel ---
window.addEventListener("beforeprint", () => {
    const valitudVariant = kuuValik?.selectedOptions;
    const kuu = valitudVariant && valitudVariant.length > 0 ? valitudVariant[0].dataset.kuu : "";
    const printTitle = document.getElementById("printTitle");
    
    if (printTitle) {
        printTitle.textContent = `${kuu} – Arhiiv`;
    }
});
// 🌟 SÜSTEEMI AUTO-KRAAN: Kontrollib ja arhiveerib eelmise kuu automaatselt, kui see on andmebaasist puudu
async function KontrolliJaArhiveeriEelmineKuuAutomaatselt(praeguneKuuId) {
    if (!praeguneKuuId || !praeguneKuuId.includes("-")) return;

    // 1. Tuvastame kalendriliselt eelmise kuu ID (kujul YYYY-MM)
    const [aasta, kuu] = praeguneKuuId.split("-").map(Number);
    let eelmiseKuuObj = new Date(aasta, kuu - 2, 1); // Liigume 1 kuu tagasi
    const eelmiseKuuId = `${eelmiseKuuObj.getFullYear()}-${String(eelmiseKuuObj.getMonth() + 1).padStart(2, '0')}`;

    try {
        // 2. Kontrollime, kas see eelmine kuu on Sinu 'arhiiv' tabelis juba olemas
        const { data: olemasArhiivis } = await sb
            .from("arhiiv")
            .select("arhiiviId")
            .eq("kuu_id", eelmiseKuuId)
            .maybeSingle();

        // Kui on juba arhiivis olemas, siis me midagi üle ei kirjuta ega puutu
        if (olemasArhiivis) return;

        // 3. Küsime andmebaasist eelmise kuu reaalsed kassa andmed
        const { data: vanaKuuAndmed } = await sb
            .from("kassatabel")
            .select("*")
            .eq("kuu_id", eelmiseKuuId)
            .order("kuupaev");

        // Kui vanas kuus polnud üldse andmeid sisestatud, pole midagi arhiveerida
        if (!vanaKuuAndmed || vanaKuuAndmed.length === 0) return;

        console.log(`[AUTOMAATIKA] Tuvastasin sulgemata eelmise kuu: ${eelmiseKuuId}. Alustan arhiveerimist...`);

        // 4. Ehitame Sinu arhiiv.js jaoks vajaliku 'state' objekti struktuuri
        // (Et arhiiv.js suudaks seda tabelina kuvada, peab see sisaldama paise, rows, sumKogus jne)
        const arhiiviState = {
            paise: seaded?.veerud || [], // Võtame jooksvad veerud seadetest
            rows: vanaKuuAndmed.map(r => ({
                kuupäev: r.kuupaev && r.kuupaev.includes("T") ? r.kuupaev.split("T")[0] : r.kuupaev,
                veerud: (seaded?.veerud || []).map(v => r[v.nimi] || 0),
                kokku: 0 // Siia arvutab logic.js või süsteem summad ise
            })),
            sumKogus: [],
            sumHind: [],
            kuuKokku: 0
        };

        const uueArhiiviId = "arh_" + eelmiseKuuId + "_" + Date.now();

        // 5. SAADAME ANDMED SINU AMETLIKKU ARHIIVI TABELISSE
        const { error: arhiivError } = await sb
            .from("arhiiv")
            .insert({
                arhiiviId: uueArhiiviId,
                kuu_id: eelmiseKuuId,
                salvestaja: "Süsteem auto",
                versioon: 1,
                paeritolu: "automaatne", // 🛠️ Sinu arhiiv.js loeb seda märgistust!
                state: JSON.stringify(arhiiviState)
            });

        if (!arhiivError) {
            // 6. 📢 KANNAME TEGEVUSE AUTOMATSELT SINU LOGID TABELISSE!
            await sb.from("logid").insert({
                user_email: "Süsteem auto", // 🛠️ Logis selge ja korrektne tunnus
                tegevus: "auto_kuu_arhiiv",
                detailid: {
                    kuu: eelmiseKuuId,
                    arhiiviId: uueArhiiviId,
                    teade: `Eelmise kuu (${eelmiseKuuId}) andmed arhiveeriti automaatselt uue kuu laadimise esimesel sekundil.`
                }
            });
            console.log(`✅ [AUTO-LOGI] Kuu ${eelmiseKuuId} edukalt arhiveeritud ja logitud.`);
        } else {
            console.error("Automaatse arhiivi tõrge andmebaasis:", arhiivError.message);
        }
    } catch (err) {
        console.error("Süsteemne viga automaatsel kontrollil:", err);
    }
}



