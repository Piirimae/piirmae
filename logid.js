import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

// --- Dropdownid ---
async function laeKuud() {
  const { data, error } = await sb.from("logid").select("detailid");
  if (error) return console.error(error);

  const select = document.getElementById("filterAeg");
  const kuud = new Set();

  data.forEach(r => {
    if (r.detailid?.kuu) kuud.add(r.detailid.kuu);
  });

  [...kuud].sort().forEach(kuu => {
    const opt = document.createElement("option");
    opt.value = kuu;
    opt.textContent = kuu;
    select.appendChild(opt);
  });
}

async function laeKasutajad() {
  const { data, error } = await sb.from("kasutajad").select("email").order("email");
  if (error) return console.error(error);

  const select = document.getElementById("filterKasutaja");

  data.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.email;
    opt.textContent = u.email;
    select.appendChild(opt);
  });
}

async function laeTegevused() {
  const { data, error } = await sb.from("logid").select("tegevus");
  if (error) return console.error(error);

  const select = document.getElementById("filterTegevus");
  const tegevused = new Set(data.map(r => r.tegevus));

  [...tegevused].sort().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
}

// --- Logide kuvamine ---
async function kuvaLogid() {
  const aeg = document.getElementById("filterAeg").value;
  const kasutaja = document.getElementById("filterKasutaja").value;
  const tegevus = document.getElementById("filterTegevus").value;

  let query = sb.from("logid")
    .select("id, timestamp, tegevus, detailid, user_email")
    .order("timestamp", { ascending: false });

  if (aeg) query = query.contains("detailid", { kuu: aeg });
  if (kasutaja) query = query.eq("user_email", kasutaja);
  if (tegevus) query = query.eq("tegevus", tegevus);

  const { data, error } = await query;
  if (error) return console.error(error);

  const card = document.getElementById("logiKonteiner");
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
      <td>${new Date(logi.timestamp).toLocaleString("et-EE")}</td>
      <td>${logi.user_email}</td>
      <td>${logi.tegevus}</td>
      <td><pre>${JSON.stringify(logi.detailid, null, 2)}</pre></td>
    `;
    tbody.appendChild(tr);
  });

  card.appendChild(table);
}

// --- INIT ---
window.addEventListener("DOMContentLoaded", async () => {
  await kuvaKasutajaNimi();
  await laeKuud();
  await laeKasutajad();
  await laeTegevused();
  await kuvaLogid();

  document.getElementById("filtreeriBtn").onclick = kuvaLogid;
});
