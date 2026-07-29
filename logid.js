// logid.js (MOODUL) - Piirimäe Turvatud Auditi Logid
import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

// --- Dropdownid ---
async function laeKuud() {
  const { data, error } = await sb.from("logid").select("detailid");
  if (error) return console.error("Logide laadimise viga (kuud):", error);

  const select = document.getElementById("filterAeg");
  if (!select) return;
  select.innerHTML = '<option value="">-- Vali kuu --</option>'; // Puhastame ja lisame vaikevaliku
  
  const kuud = new Set();
  data.forEach(r => {
    if (r.detailid?.kuu) kuud.add(r.detailid.kuu);
  });

  [...kuud].sort().forEach(kuu => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = kuu;
    select.appendChild(opt);
  });
}

async function laeKasutajad() {
  // 🔧 PARANDATUD KONFLIKT: Kasutame õiget andmebaasi nime "kasutajad"

  
  const { data, error } = await sb.from("kasutajad").select("email").order("email");
  if (error) return console.error("Kasutajate laadimise viga:", error);

  const select = document.getElementById("filterKasutaja");
  if (!select) return;
  select.innerHTML = '<option value="">-- Vali kasutaja --</option>';

  data.forEach(u => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = u.email;
    select.appendChild(opt);
  });
}

async function laeTegevused() {
  const { data, error } = await sb.from("logid").select("tegevus");
  if (error) return console.error("Logide laadimise viga (tegevused):", error);

  const select = document.getElementById("filterTegevus");
  if (!select) return;
  select.innerHTML = '<option value="">-- Vali tegevus --</option>';
  
  const tegevused = new Set(data.map(r => r.tegevus));

  [...tegevused].sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = t;
    select.appendChild(opt);
  });
}

// --- Logide kuvamine ---
async function kuvaLogid() {
  const aeg = document.getElementById("filterAeg")?.value || "";
  const kasutaja = document.getElementById("filterKasutaja")?.value || "";
  const tegevus = document.getElementById("filterTegevus")?.value || "";

  let query = sb.from("logid")
    .select("id, timestamp, tegevus, detailid, user_email")
    .order("timestamp", { ascending: false });

  // 🔧 LAHENDUS: Rakendame filtreid rangelt ainult siis, kui väärtus on olemas ega ole tühi string!
  if (aeg && aeg !== "") {
      query = query.contains("detailid", { kuu: aeg });
  }
  if (kasutaja && kasutaja !== "") {
      query = query.eq("user_email", kasutaja);
  }
  if (tegevus && tegevus !== "") {
      query = query.eq("tegevus", tegevus);
  }

  const { data, error } = await query;
  if (error) {
      console.error("Logide kuvamise viga päringus:", error);
      return;
  }

  const card = document.getElementById("logiKonteiner");
  if (!card) return;
  card.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("logitabel");

  table.innerHTML = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Aeg</th>
        <th>Kasutaja</th>
        <th>Tegevus</th>
        <th>Detailid</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  data.forEach(logi => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${logi.id}</td>
      <td>${logi.timestamp ? new Date(logi.timestamp).toLocaleString("et-EE") : "-"}</td>
      <td>${logi.user_email || "süsteem"}</td>
      <td><strong>${logi.tegevus}</strong></td>
      <td><pre style="margin:0; font-family:monospace; font-size:0.9em;">${JSON.stringify(logi.detailid, null, 2)}</pre></td>
    `;
    tbody.appendChild(tr);
  });

  card.appendChild(table);
}

// --- INIT ---
// =========================================================================
// ✅ PARANDATUD JA TURVATUD ALGSEADISTUS (Konfliktivaba alglaadimine)
// =========================================================================
// --- INIT (Automaatne laadimine lehele tulles) ---
// =========================================================================
// 🔐 LUBADE JA ÕIGUSTE JUHTPANEELI MOOTOR (SUPERADMINILE)
// =========================================================================

// 1. Kontrollime ja kuvame õiguste nupu ainult Sinu e-maili jaoks lehe laadimisel
async function SeadistaLubadeAken(sisselogitudEmail) {
    if (sisselogitudEmail !== "piirimaeinge@gmail.com") return; // Kui pole Sina, jääb nupp igaveseks peitu

    const btnAvaLoad = document.getElementById("btnAvaLoad");
    const btnSulgeLoad = document.getElementById("btnSulgeLoad");
    const lubadePaneel = document.getElementById("lubadePaneelKonteiner");

    if (btnAvaLoad) {
        btnAvaLoad.style.display = "block"; // 🌟 Toob nupu ekraanile ainult Sulle!
        btnAvaLoad.onclick = async () => {
            lubadePaneel.style.display = "block";
            await JoonistaLubadeHaldustabel();
        };
    }

    if (btnSulgeLoad) {
        btnSulgeLoad.onclick = () => {
            lubadePaneel.style.display = "none";
        };
    }
}

// 2. Joonistame dünaamilise tabeli kasutajatest koos dropdownide ja seadetega
async function JoonistaLubadeHaldustabel() {
    const koht = document.getElementById("lubadeTabeliKoht");
    if (!koht) return;

    // Küsime kõik kasutajad ja unikaalsed tegevused logidest
    const { data: kasutajadList } = await sb.from("kasutajad").select("id, email, roll, logi_load").order("email");
    const { data: logiTegevused } = await sb.from("logid").select("tegevus");
    
    const unikaalsedTegevused = [...new Set(logiTegevused?.map(r => r.tegevus) || [])].sort();

    let html = `
        <table class="logitabel" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
                <tr style="background:#edf2f7;">
                    <th style="padding:8px;">Kasutaja</th>
                    <th style="padding:8px;">Roll</th>
                    <th style="padding:8px;">1. Näeb kasutajaid</th>
                    <th style="padding:8px;">2. Lubatud tegevused</th>
                    <th style="padding:8px;">3. Ajaline limiit</th>
                    <th style="padding:8px;">Tegevus</th>
                </tr>
            </thead>
            <tbody>
    `;

    kasutajadList?.forEach((u, uIdx) => {
        if (u.email === "piirimaeinge@gmail.com") return; // Sinu peakontot ei saa keegi muuta

        const load = u.logi_load || { aeg: "kõik", tegevused: "kõik", kasutajad: "kõik" };

        html += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px;"><strong>${u.email}</strong></td>
                <td style="padding:8px;"><span class="badge">${u.roll}</span></td>
                
                <!-- 1. KASUTAJATE FILTRI DROPDOWN -->
                <td style="padding:8px;">
                    <select id="loadUser-${uIdx}" style="padding:4px; width:100%;">
                        <option value="kõik" ${load.kasutajad === "kõik" ? "selected" : ""}>Kõik kasutajad</option>
                        <option value="ainult_ise" ${load.kasutajad === "ainult_ise" ? "selected" : ""}>Ainult oma sissekanded</option>
                    </select>
                </td>

                <!-- 2. LUBATUD TEGEVUSTE VALIK -->
                <td style="padding:8px;">
                    <div style="max-height:80px; overflow-y:auto; background:#f7fafc; padding:4px; border:1px solid #cbd5e1; border-radius:4px;">
                        <label><input type="checkbox" id="chkAllAct-${uIdx}" ${load.tegevused === "kõik" ? "checked" : ""}> 🌟 Kõik tegevused</label><br>
                        <div id="tegevusteLinnukesteKast-${uIdx}" style="${load.tegevused === "kõik" ? "display:none;" : ""}">
                            ${unikaalsedTegevused.map(t => {
                                const onLubatud = Array.isArray(load.tegevused) ? load.tegevused.includes(t) : false;
                                return `<label><input type="checkbox" class="act-chk-${uIdx}" value="${t}" ${onLubatud ? "checked" : ""}> ${t}</label><br>`;
                            }).join("")}
                        </div>
                    </div>
                </td>

                <!-- 3. AJALINE DROPDOWN + KALENDER -->
                <td style="padding:8px;">
                    <select id="loadAeg-${uIdx}" style="padding:4px; width:100%; margin-bottom:4px;">
                        <option value="kõik" ${load.aeg === "kõik" ? "selected" : ""}>Kogu ajalugu</option>
                        <option value="30" ${load.aeg === "30" ? "selected" : ""}>Jooksvalt 30 päeva</option>
                        <option value="60" ${load.aeg === "60" ? "selected" : ""}>Jooksvalt 60 päeva</option>
                        <option value="käsitsi" ${load.aeg !== "kõik" && load.aeg !== "30" && load.aeg !== "60" ? "selected" : ""}>Käsitsi kuupäev...</option>
                    </select>
                    <input type="date" id="loadAegKuupaev-${uIdx}" value="${load.aeg !== "kõik" && load.aeg !== "30" && load.aeg !== "60" ? load.aeg : ""}" 
                           style="padding:3px; font-size:11px; width:100%; display:${load.aeg !== "kõik" && load.aeg !== "30" && load.aeg !== "60" ? "block" : "none"};">
                </td>

                <!-- SALVESTAMISE NUPP LENNULT -->
                <td style="padding:8px; text-align:center;">
                    <button onclick="SalvestaKasutajaUuedLoad('${u.id}', ${uIdx})" style="background:#1abc9c; color:white; padding:4px 10px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">
                        Salvesta
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    koht.innerHTML = html;

    // Seome dünaamilised sündmused linnukeste ja dropdownide peitmiseks
    kasutajadList?.forEach((u, uIdx) => {
        if (u.email === "piirimaeinge@gmail.com") return;
        
        const allActChk = document.getElementById(`chkAllAct-${uIdx}`);
        const chkKast = document.getElementById(`tegevusteLinnukesteKast-${uIdx}`);
        if (allActChk && chkKast) {
            allActChk.onchange = () => { chkKast.style.display = allActChk.checked ? "none" : "block"; };
        }

        const aegSelect = document.getElementById(`loadAeg-${uIdx}`);
        const kpvInput = document.getElementById(`loadAegKuupaev-${uIdx}`);
        if (aegSelect && kpvInput) {
            aegSelect.onchange = () => { kpvInput.style.display = aegSelect.value === "käsitsi" ? "block" : "none"; };
        }
    });
}

// 3. Salvestame uued load lennult andmebaasi kasutajad tabelisse
window.SalvestaKasutajaUuedLoad = async function(kasutajaId, idx) {
    const userSelect = document.getElementById(`loadUser-${idx}`).value;
    const allActChk = document.getElementById(`chkAllAct-${idx}`).checked;
    const aegSelect = document.getElementById(`loadAeg-${idx}`).value;
    const kpvInput = document.getElementById(`loadAegKuupaev-${idx}`).value;

    let tegevusedValik = "kõik";
    if (!allActChk) {
        tegevusedValik = Array.from(document.querySelectorAll(`.act-chk-${idx}:checked`)).map(c => c.value);
    }

    let aegValik = aegSelect;
    if (aegSelect === "käsitsi") {
        aegValik = kpvInput || "kõik";
    }

    const uuedLoadObjekt = {
        kasutajad: userSelect,
        tegevused: tegevusedValik,
        aeg: aegValik
    };

    const { error } = await sb
        .from("kasutajad")
        .update({ logi_load: uuedLoadObjekt })
        .eq("id", kasutajaId);

    if (!error) {
        alert("🔒 Kasutaja õigused andmebaasis edukalt uuendatud!");
        await JoonistaLubadeHaldustabel();
    } else {
        alert("Viga õiguste muutmisel: " + error.message);
    }
};

// =========================================================================
// 🔄 ALGSEADISTUS (Uuendatud INIT plokk)
// =========================================================================
window.addEventListener("DOMContentLoaded", async () => {
    // Tuvastame kasutaja sessiooni ja e-maili kohe alguses
    const { data: { user } } = await sb.auth.getUser();
    const sisselogitudEmail = user?.email || "";

    // Käivitame superadmini nupu kontrolli
    await SeadistaLubadeAken(sisselogitudEmail);

    await kuvaKasutajaNimi();
    await laeKuud();
    await laeKasutajad();
    await laeTegevused();
    await kuvaLogid();

    const filtreeriBtn = document.getElementById("filtreeriBtn");
    if (filtreeriBtn) filtreeriBtn.onclick = kuvaLogid;

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;
});





