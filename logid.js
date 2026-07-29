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
window.addEventListener("DOMContentLoaded", async () => {
  // 1. Kuvame kasutaja nime ekraanile
  try {
      await kuvaKasutajaNimi();
  } catch (e) {
      console.error("Kasutajanime kuvamise tõrge:", e);
  }

  // 2. Laeme dropdown filtrid iseseisvate plokkidena (Et ükski viga ei blokeeriks teist!)
  try { await laeKuud(); } catch (e) { console.error("Kuude laadimise tõrge:", e); }
  try { await laeKasutajad(); } catch (e) { console.error("Kasutajate laadimise tõrge:", e); }
  try { await laeTegevused(); } catch (e) { console.error("Tegevuste laadimise tõrge:", e); }

  // 3. 🌟 KÄIVITAME LOGIDE KUVAMISE (Kuna eelnevad on isoleeritud, käivitub see alati!)
  try {
      await kuvaLogid();
  } catch (e) {
      console.error("Logitabeli joonistamise tõrge:", e);
  }

  // Seome nuppude klikid turvaliselt
  const filtreeriBtn = document.getElementById("filtreeriBtn");
  if (filtreeriBtn) filtreeriBtn.onclick = kuvaLogid;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;
});



