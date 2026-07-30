                // (JÄTKUB SIIT)
                yArtiklid: { 
                    type: "linear", 
                    position: "right", 
                    title: { display: true, text: "Kogus (tk)" },
                    grid: { drawOnChartArea: false } // Hoiab ära joonte risti-rästi joone ekraanil
                }
            },
            // 🌟 MULTI-LUKUSTUS: Teeme suurel graafikul infoaknad klikiga ekraanile lukustatavaks!
            onClick: (event, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const notatsiooniId = `note-pulss-${element.datasetIndex}-${element.index}`;
                const olemasolevNote = document.getElementById(notatsiooniId);
                
                // Kui klikitakse uuesti samale tulbale, võetakse märk meilt maha
                if (olemasolevNote) {
                    olemasolevNote.remove();
                    return;
                }

                // Arvutame ujuva HTML-kasti asukoha ekraanil
                const canvasPosition = chart.canvas.getBoundingClientRect();
                const vigaTop = window.scrollY + canvasPosition.top + element.element.y - 45;
                const vigaLeft = window.scrollX + canvasPosition.left + element.element.x - 60;

                const noot = document.createElement("div");
                noot.id = notatsiooniId;
                noot.className = "lukustatud-notatsioon";
                
                const kuupaevTekst = chart.data.labels[element.index];
                const seeriaNimi = chart.data.datasets[element.datasetIndex].label;
                const vaartus = chart.data.datasets[element.datasetIndex].data[element.index];
                const yhik = element.datasetIndex === 0 ? "€" : "tk";
                
                noot.innerHTML = `<strong>${kuupaevTekst}</strong><br>${seeriaNimi}: ${vaartus.toFixed(element.datasetIndex === 0 ? 2 : 0)} ${yhik}`;
                
                Object.assign(noot.style, {
                    position: "absolute", top: `${vigaTop}px`, left: `${vigaLeft}px`,
                    background: "rgba(0, 0, 0, 0.9)", color: "white", padding: "6px 10px",
                    borderRadius: "4px", fontSize: "11px", zIndex: "1000", cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)", fontFamily: "sans-serif", lineHeights: "1.3"
                });

                noot.onclick = () => noot.remove();
                document.body.appendChild(noot);
            }
        }
    });
}

// --- KAST 2: Arvuta ja kuva perioodi koondinfo (Täidab Sinu loetelu!) ---
function ArvutaJaKuvaPerioodiInfo(ajaTyyp) {
    let koguKäive = 0;
    let koguArtikleid = 0;
    let myugigaPaevi = 0;
    
    // Toodete koondobjekt
    const toodeteKoondStatistika = {};
    seaded.veerud.forEach(v => {
        if (v.tüüp === "toit") {
            toodeteKoondStatistika[v.nimi] = { pealkiri: v.pealkiri, kogus: 0, tulu: 0 };
        }
    });

    laetudKassaAndmed.forEach(r => {
        let paevalOliMyyki = false;
        
        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit") {
                const hind = leiaHind(v.nimi, r.kuupaev);
                const tulu = kogus * hind;
                
                koguKäive += tulu;
                koguArtikleid += kogus;
                
                if (toodeteKoondStatistika[v.nimi]) {
                    toodeteKoondStatistika[v.nimi].kogus += kogus;
                    toodeteKoondStatistika[v.nimi].tulu += tulu;
                }
            } else if (v.tüüp === "number") {
                koguKäive += kogus;
            }
        });
        if (paevalOliMyyki) myugigaPaevi++;
    });

    // 🌟 JOONISTAME DÜNAAMILISE TEXT-LOENDI (Supp 74 tk / 296.00 €)
    const loendKonteiner = document.getElementById("toodeteTekstLoend");
    let loendHtml = "";
    let raportiTekstRidad = [];

    Object.keys(toodeteKoondStatistika).forEach(nimi => {
        const t = toodeteKoondStatistika[nimi];
        if (t.kogus > 0) {
            const rida = `${t.pealkiri} ${t.kogus} tk / ${t.tulu.toFixed(2)} €`;
            loendHtml += `<div style="padding: 3px 0; border-bottom: 1px solid #edf2f7;">• ${rida}</div>`;
            raportiTekstRidad.push(rida);
        }
    });

    if (loendKonteiner) {
        loendKonteiner.innerHTML = loendHtml || "<div style='color:#718096;'>Valitud vahemikus andmed puuduvad.</div>";
    }

    // Uuendame kaardikasti tekstilised kokkuvõtted ekraanil [1.1]
    if (document.getElementById("uuringKoikPaevad")) {
        document.getElementById("uuringKoikPaevad").innerText = `${laetudKassaAndmed.length} päeva aknas`;
    }
    if (document.getElementById("uuringMyugiPaevad")) {
        document.getElementById("uuringMyugiPaevad").innerText = `${myugigaPaevi} päeva`;
    }
    if (document.getElementById("uuringKassaSumma")) {
        document.getElementById("uuringKassaSumma").innerText = `${koguKäive.toFixed(2)} €`;
    }

    // 🌟 GLOBAALNE RAPORT: Paneme valmis puhta teksti kopeerimise (Copy) nupu jaoks [1.1]
    window.viimanePulssRaportTekst = `📊 PIIRIMÄE PULSSI KOONDARUANNE\n` +
        `Tüüp: ${ajaTyyp.toUpperCase()}\n` +
        `Müügiga päevi: ${myugigaPaevi}\n` +
        `Kogukäive: ${koguKäive.toFixed(2)} €\n` +
        `Müüdud artikleid: ${koguArtikleid} tk\n\n` +
        `TOODETE MÜÜGISTATISTIKA:\n` + raportiTekstRidad.map(r => `- ${r}`).join("\n");
}

// --- KAST 1: Uuenda koondsektorit globaalselt (Kogu valitud perioodi tootejaotus) ---
function UuendaGrupiSektoritGlobaalselt() {
    const sektorAndmed = {};
    
    laetudKassaAndmed.forEach(r => {
        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (v.tüüp === "toit" && kogus > 0) {
                sektorAndmed[v.pealkiri] = (sektorAndmed[v.pealkiri] || 0) + kogus;
            }
        });
    });

    const labels = Object.keys(sektorAndmed);
    const data = Object.values(sektorAndmed);
    const kogusummaTk = data.reduce((a, b) => a + b, 0);

    // Ehitame legendi sisse automaatselt protsendid, et ketas poleks kole ja anonüümne
    const dunaamilisedSildid = labels.map((nimi, idx) => {
        const kogus = data[idx];
        const protsent = kogusummaTk > 0 ? ((kogus * 100) / kogusummaTk).toFixed(0) : 0;
        return `${nimi} (${protsent}%)`;
    });

    if (grupiSektorGraafik) grupiSektorGraafik.destroy();

    const ctx = document.getElementById("uuringuSektorGraafik");
    if (!ctx) return;

    const paevadeVarvid = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#34495e"];

    grupiSektorGraafik = new Chart(ctx.getContext("2d"), {
        type: "pie",
        data: {
            labels: dunaamilisedSildid,
            datasets: [{
                data: data,
                backgroundColor: paevadeVarvid.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "bottom", labels: { boxWidth: 10, font: { size: 10 }, padding: 4 } },
                tooltip: { enabled: false } // Keelame vaike-akna HTML märkmete jaoks
            },
            // 🌟 SEKTORI MULTI-LUKUSTUS: Jätab mustad märkmed klikiga paigale
            onClick: (event, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const notatsiooniId = `note-pulss-sektor-${element.index}`;
                const olemasolevNote = document.getElementById(notatsiooniId);
                
                if (olemasolevNote) {
                    olemasolevNote.remove();
                    return;
                }

                const canvasPosition = chart.canvas.getBoundingClientRect();
                const vigaTop = window.scrollY + canvasPosition.top + element.element.y - 20;
                const vigaLeft = window.scrollX + canvasPosition.left + element.element.x - 40;

                const noot = document.createElement("div");
                noot.id = notatsiooniId;
                noot.className = "lukustatud-notatsioon";
                
                const tooteNimiJaProtsent = chart.data.labels[element.index];
                const tykkideArv = chart.data.datasets[0].data[element.index];
                
                noot.innerHTML = `<strong>${tooteNimiJaProtsent}</strong>: ${tykkideArv} tk`;
                
                Object.assign(noot.style, {
                    position: "absolute", top: `${vigaTop}px`, left: `${vigaLeft}px`,
                    background: "rgba(0, 0, 0, 0.85)", color: "white", padding: "5px 8px",
                    borderRadius: "4px", fontSize: "11px", zIndex: "1001", cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.3)", fontFamily: "sans-serif"
                });

                noot.onclick = () => noot.remove();
                document.body.appendChild(noot);
            }
        }
    });
}

// =========================================================================
// 📥 KAST 3 MOOTOR: KOPEERIMINE JA TOPEALT-TERAV SCREENSHOT LENNULT
// =========================================================================
function SeadistaEksportKuulajad() {
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

// Pikendame alglaadimise filtrit lennult, et eksportnupud alati kuulataks
// =========================================================================
// 📥 EXPORT KASTI SEADISTAMINE JA KÄIVITAMINE (Kopeeri & Screenshot)
// =========================================================================

// 1. Sidumine nuppudega lennult laadimisel
function SeadistaPulssEksportKuulajad() {
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

// Pikendame esialgset kuulajate funktsiooni lennult ilma vanu asju rikkumata
const algneFiltriMootorKäsk = SeadistaFiltriKuulajad;
SeadistaFiltriKuulajad = function() {
    algneFiltriMootorKäsk();
    SeadistaPulssEksportKuulajad(); // 🌟 SÜNKROONIS: Süütab õige nimega nupud põlema!
};

// 2. Kopeerimine lõikelauale (Copy to clipboard)
function KopeeriPulssRaportLikelauale() {
    // 🌟 PARANDATUD MUUTUJA NIMI: Loeb andmed otse õigest koondraporti muutujast!
    if (!window.viimanePulssKoondraportTekst) {
        return alert("Andmeid pole veel arvutatud või vahemik on tühi!");
    }
    
    navigator.clipboard.writeText(window.viimanePulssKoondraportTekst)
        .then(() => alert("📋 Pulss-raport edukalt kopeeritud! Võid selle nüüd otse meili kleepida."))
        .catch(err => console.error("Kopeerimise tõrge:", err));
}

// 3. Ekraanipildi tegemine (Screenshot PNG)
async function TeePulssTyoalastScreenshot() {
    alert("Valmistun ekraanipildi loomiseks. Palun oota hetk...");
    
    // 🔧 PARANDATUD: Täielik ja toimiv html2canvas raamistiku CDN veebiaadress
    if (typeof html2canvas === "undefined") {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://jsdelivr.net" + "/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Jäädvustame kogu tööala koos märkmete ja graafikutega topeltteravusega
    const uuringuKest = document.body;
    html2canvas(uuringuKest, { background: "#ffffff", useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        // 🔧 PARANDATUD: Lisatud õiged template stringi jutumärgid failinime ümber
        link.download = `piirimae-pulss-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// =========================================================================
// 🌟 ÕIGED PARANDUSED JA TÄIENDUSED: KOGU LEHE KOONDSTATISTIKA JA EXPORT
// =========================================================================

// --- 1. SAKSA TÄPSUSEGA TOODETE TEKSTILOENDI JA RAPORTI LOOMINE (Kast 2 Uuendus) ---
// Kirjutame Sinu ArvutaJaKuvaPerioodiInfo funktsiooni tulemused üle targa loendiga
const algneArvutaJaKuvaPerioodiInfo = ArvutaJaKuvaPerioodiInfo;
ArvutaJaKuvaPerioodiInfo = function(vordlusTyyp) {
    // Käivitame esmalt Sinu baasarvutused (Kassa, Päevad, Hoiatustuled)
    algneArvutaJaKuvaPerioodiInfo(vordlusTyyp);

    if (laetudKassaAndmed.length === 0) return;

    // Loome otsinguobjekti toodete summeerimiseks kogu perioodi kohta
    const toodeteKoondStatistika = {};
    seaded.veerud.forEach(v => {
        if (v.tüüp === "toit") {
            toodeteKoondStatistika[v.nimi] = { pealkiri: v.pealkiri, kogus: 0, tulu: 0 };
        }
    });

    let koguKäiveTooted = 0;
    let koguArtikleidTooted = 0;
    let müügigaPäevi = 0;

    laetudKassaAndmed.forEach(r => {
        let paevalOliMyyki = false;
        seaded.veerud.forEach(v => {
            const kogus = Number(r[v.nimi]) || 0;
            if (kogus > 0) paevalOliMyyki = true;

            if (v.tüüp === "toit") {
                const hind = leiaHind(v.nimi, r.kuupaev);
                const tulu = kogus * hind;
                koguKäiveTooted += tulu;
                koguArtikleidTooted += kogus;

                if (toodeteKoondStatistika[v.nimi]) {
                    toodeteKoondStatistika[v.nimi].kogus += kogus;
                    toodeteKoondStatistika[v.nimi].tulu += tulu;
                }
            }
        });
        if (paevalOliMyyki) müügigaPäevi++;
    });

    // 🌟 JOONISTAME DÜNAAMILISE KAST 2 TOODETE TEKSTILOENDI (Supp 74 tk / 296.00 €)
    // Otsime Sinu lehelt koha, kuhu loetelu panna. Kui ID-d pole, loob kood selle ise infoKassaSumma alla!
    let loendKest = document.getElementById("toodeteTekstLoend");
    if (!loendKest) {
        const kassaElement = document.getElementById("infoKassaSumma");
        if (kassaElement) {
            loendKest = document.createElement("div");
            loendKest.id = "toodeteTekstLoend";
            Object.assign(loendKest.style, {
                maxHeight: "140px", overflowY: "auto", fontVerra: "monospace",
                fontSize: "11px", background: "#f8f9fa", padding: "6px",
                borderRadius: "4px", border: "1px solid #cbd5e1", marginTop: "10px",
                lineHeight: "1.4", textAlign: "left", color: "#2d3748"
            });
            kassaElement.parentNode.appendChild(loendKest);
        }
    }

    let loendHtml = "";
    let raportiTekstRidad = [];

    Object.keys(toodeteKoondStatistika).forEach(nimi => {
        const t = toodeteKoondStatistika[nimi];
        if (t.kogus > 0) {
            const rida = `${t.pealkiri} ${t.kogus} tk / ${t.tulu.toFixed(2)} €`;
            loendHtml += `<div style="padding:2px 0; border-bottom:1px solid #edf2f7;">• ${rida}</div>`;
            raportiTekstRidad.push(rida);
        }
    });

    if (loendKest) {
        loendKest.innerHTML = loendHtml || "<div>Valitud vahemikus toidutellimused puuduvad.</div>";
    }

    // 🌟 RAPORTI LOOMINE: Paneme kokku teksti lõikelauale kopeerimise (Copy) jaoks
    window.viimanePulssKoondraportTekst = `📊 PIIRIMÄE PULSSI KOONDARUANNE\n` +
        `Vaadeldav periood: ${laetudKassaAndmed.length} kalendripäeva\n` +
        `Müügiga päevi kokku: ${müügigaPäevi} päeva\n` +
        `Kogu perioodi tulu: ${document.getElementById("infoKassaSumma")?.innerText || koguKäiveTooted.toFixed(2) + " €"}\n\n` +
        `TOODETE DETAILNE JAOTUS:\n` + raportiTekstRidad.map(r => `- ${r}`).join("\n");
};

// --- 2. KAST 1 LUKUSTAMINE: Sektordiagrammile protsendid lennult (Kogu perioodi jaotus) ---
const algneUuendaGrupiSektoritGlobaalselt = UuendaGrupiSektoritGlobaalselt;
UuendaGrupiSektoritGlobaalselt = function() {
    const gruppideSummad = {};
    laetudKassaAndmed.forEach(r => {
        seaded.veerud.forEach(v => {
            if (v.tüüp === "toit") {
                const kogus = Number(r[v.nimi]) || 0;
                if (kogus > 0) {
                    gruppideSummad[v.pealkiri] = (gruppideSummad[v.pealkiri] || 0) + kogus;
                }
            }
        });
    });

    const labels = Object.keys(gruppideSummad);
    const data = Object.values(gruppideSummad);
    const kogusummaTk = data.reduce((a, b) => a + b, 0);

    // 🌟 KAVAL TRIKK: Ehitame uued sildid, kus on protsent ja nimi kohe sees! (nt "SUPP (24%)")
    const dunaamilisedSildid = labels.map((nimi, idx) => {
        const kogus = data[idx];
        const protsent = kogusummaTk > 0 ? ((kogus * 100) / kogusummaTk).toFixed(0) : 0;
        return `${nimi} (${protsent}%)`;
    });

    // Joonistame Sinu sektorgraafiku uute targa legendi siltidega
    if (grupiSektorGraafik) grupiSektorGraafik.destroy();
    const ctx = document.getElementById("grupiSektorGraafik");
    if (!ctx) return;

    grupiSektorGraafik = new Chart(ctx.getContext("2d"), {
        type: "pie",
        data: {
            labels: dunaamilisedSildid,
            datasets: [{
                data: data,
                backgroundColor: ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#1abc9c", "#e67e22"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "bottom", labels: { boxWidth: 10, font: { size: 9 }, padding: 3 } },
                tooltip: { enabled: false } // Keelame vaike-akna klikilukustuse jaoks
            },
            // 🌟 MULTI-LUKUSTUS KETTAL: Jätab mustad märkmed klikiga paigale screenshotiks
            onClick: (event, elements, chart) => {
                if (!elements || elements.length === 0) return;
                const element = elements[0];
                const notatsiooniId = `note-pulss-sektor-${element.index}`;
                const olemasolevNote = document.getElementById(notatsiooniId);
                
                if (olemasolevNote) { olemasolevNote.remove(); return; }

                const canvasPosition = chart.canvas.getBoundingClientRect();
                const vigaTop = window.scrollY + canvasPosition.top + element.element.y - 20;
                const vigaLeft = window.scrollX + canvasPosition.left + element.element.x - 40;

                const noot = document.createElement("div");
                noot.id = notatsiooniId;
                noot.className = "lukustatud-notatsioon";
                noot.innerHTML = `<strong>${chart.data.labels[element.index]}</strong>: ${chart.data.datasets[0].data[element.index]} tk`;
                
                Object.assign(noot.style, {
                    position: "absolute", top: `${vigaTop}px`, left: `${vigaLeft}px`,
                    background: "rgba(0, 0, 0, 0.85)", color: "white", padding: "5px 8px",
                    borderRadius: "4px", fontSize: "11px", zIndex: "1005", cursor: "pointer"
                });
                noot.onclick = () => noot.remove();
                document.body.appendChild(noot);
            }
        }
    });
};

// --- 3. EXPORT KASTI SEADISTAMINE JA KÄIVITAMINE (Kopeeri & Screenshot) ---
function SeadistaPulssEksportKuulajad() {
    const cpBtn = document.getElementById("btnKopeeriTekst");
    const ssBtn = document.getElementById("btnTeeScreenshot");
    
    if (cpBtn) cpBtn.onclick = KopeeriPulssRaportLikelauale;
    if (ssBtn) ssBtn.onclick = TeePulssTyoalastScreenshot;
}

// Pikendame esialgset kuulajate funktsiooni lennult ilma vanu asju rikkumata
const algneFiltriMootorKäsk = SeadistaFiltriKuulajad;
SeadistaFiltriKuulajad = function() {
    algneFiltriMootorKäsk();
    SeadistaPulssEksportKuulajad(); // Süütab eksportnupud põlema!
};

function KopeeriPulssRaportLikelauale() {
    if (!window.viimanePulssKoondraportTekst) return alert("Andmeid pole veel arvutatud!");
    navigator.clipboard.writeText(window.viimanePulssKoondraportTekst)
        .then(() => alert("📋 Koondraport kopeeritud! Võid selle nüüd otse meili kleepida."))
        .catch(err => console.error("Kopeerimise tõrge:", err));
}

async function TeePulssTyoalastScreenshot() {
    alert("Valmistun ekraanipildi loomiseks. Palun oota hetk...");
    
    // Laeme html2canvas pildistamise raamistiku turvaliselt ja blokeeringuvabalt
    if (typeof html2canvas === "undefined") {
        await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://jsdelivr.net" + "/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // Jäädvustame kogu tööala koos märkmete ja graafikutega topeltteravusega
    const uuringuKest = document.body;
    html2canvas(uuringuKest, { background: "#ffffff", useCORS: true, scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        link.download = `piirimae-pulss-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}
