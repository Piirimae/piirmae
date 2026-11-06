# Automaatne kuulõpu arhiiv

Kassatabeli leht ei käivita seda tööd. Supabase Edge Function loeb `kassatabel`, `seaded_veerud` ja `hinnad` tabelid, teeb arhiivilehega ühilduva raporti ning kirjutab arhiivi ja logi. Käsitsi `Salvesta arhiivi` jääb hetkepiltide tegemiseks eraldi alles.

## Seadistamine (üks kord)

1. Deploy funktsioon: `supabase functions deploy month-end-archive --project-ref <projekt-ref>`.
2. Lisa Edge Functioni secrets:
   - `ARCHIVE_CRON_SECRET` — pikk juhuslik salasõna.
   - Supabase annab funktsioonile `SUPABASE_URL` ja `SUPABASE_SERVICE_ROLE_KEY`; service role võtit ei tohi panna veebilehe JavaScripti.
3. Käivita `supabase/migrations/202611060001_month_end_archive.sql` Supabase SQL Editoris. See loob ühe automaatse arhiivi kuus lubava indeksi ja atomaarse arhiivi+logi DB-funktsiooni.
4. Croni seadistus Supabase SQL Editoris (käivita alles pärast Vaulti saladuste lisamist):

```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'piirmae-month-end-archive',
  '15 2 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'month_end_archive_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-archive-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'month_end_archive_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Lisa Vaulti saladused nimedega `month_end_archive_url` (väärtus `https://<projekt-ref>.supabase.co/functions/v1/month-end-archive`) ja `month_end_archive_cron_secret` (sama väärtus mis Edge Functioni `ARCHIVE_CRON_SECRET`). Cron kontrollib iga päev eelmise kuu arhiivi; puuduva korral loob selle. Seetõttu taastub töö ka ajutise katkestuse järel. Aeg 02:15 UTC vastab Tallinnas talvel 04:15 ja suvel 05:15.

## Pärisandmetega ohutu test

Saladusega POST-päringule lisa body `{"kuu_id":"2026-10","dry_run":true}`. Funktsioon tagastab raporti eelvaate, kuid ei kirjuta arhiivi ega logi. Kui eelvaade on õige, tee sama päring `dry_run`-ita; see lisab ainult arhiivi- ja logikirje, mitte ei muuda `kassatabel`-i ridu. Teist korda käivitades peaks tulema `skipped` / `already_archived`.

Hoia olemasolev `main` tootmiskasutuses kuni testprojektis või eraldi kontrollitud käivitusega on kinnitatud kuuaruanne, arhiivivaade, printimine ja logikirje.
