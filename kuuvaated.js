import { sb } from "./supabase.js";
import { kuvaKasutajaNimi, logout } from "./auth.js";

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Laeme kasutaja nime
    await kuvaKasutajaNimi();

    // Seome väljalogimise nupu
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = logout;

    // Tuvastame jooksva kuu (näiteks praegune aasta ja kuu)
    const jooksevKuup = new Date();
    const jooksevKuu = `${jooksevKuup.getFullYear()}-${String(jooksevKuup.getMonth() + 1).padStart(2, '0')}`;

    const laud = document.getElementById("kuuvaadeTabeliKoht");
    if (!laud) return;

    laud.innerHTML = "<p>Laen viimast kinnitatud seisvvaadet...</p>";

    // 2. Küsime andmebaasist külmutatud pildi
    const { data, error } = await sb
        .from("kuuvaated_snapshot")
        .select("*")
        .eq("kuu_id", jooksevKuu)
        .maybeSingle();

    if (error || !data) {
        laud.innerHTML = `<p class="error-box">Kuu ${jooksevKuu} kohta pole administraator veel ühtegi ametlikku külmvaadet salvestanud.</p>`;
        return;
    }

    // Parsime valmis salvestatud seisu
    const seis = typeof data.state === "string" ? JSON.parse(data.state) : data.state;

    // 3. Joonistame tabeli puhta tekstina (pildina) ilma ühegi sisendväljata (inputita)
    let thead = `<tr><th>Kuupäev</th>${seis.paise.map(v => `<th>${v.pealkiri}</th>`).join("")}</tr>`;
    
    // Siia joonistuvad read täpselt sellise kujuga nagu nad salvestamise hetkel olid
    let tbody = `<tr><td colspan="${seis.paise.length + 1}">Kuu lõppsumma seisuga: ${seis.kuuKokku}</td></tr>`;

    laud.innerHTML = `
        <table class="tabel vaatleja-tabel">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
        <p class="subtitle" style="margin-top:15px; font-size:12px;">
            * See on külmvaate väljavõte. Viimati uuendatud: ${new Date(data.uuendatud_at).toLocaleString("et-EE")} (Uuendas: ${data.uuendaja})
        </p>
    `;
});
