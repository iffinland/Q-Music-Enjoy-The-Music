# Q-Music – Enjoy the Music

Q-Music on Qortal platvormi jaoks loodud muusika- ja meediamängija, mis koondab kogukonna avaldatud laulud, playlistid, podcastid ja videod ühte kaasaegsesse kasutajaliidesse. Projekt väljendab uue Q-Music kogukonna tulevikuvisiooni: detsentraliseeritud, censorsip-kindel ja kasutajaid kaasav meediakogemus.

## Mis projekti sees toimub?

- Avaleht kuvab värskelt lisatud lood, playlistid, podcastid ja videod ning võimaldab kiiret navigeerimist.
- Meediateek on jaotatud alamlehtedeks (laulud, playlistid, podcastid, videod), et sirvida ka suuri kogusid.
- Täpsemad vaated võimaldavad kuulata loo-, playlisti-, podcasti- ja videodetaile eraldi lehtedel koos taustainfo ning navigeerimisvõimalustega.
- Otsing ja filtrid aitavad leida uusi teoseid; täiendavad ülevaated nagu "Newest" annavad kiire ligipääsu värsketele lugudele.
- Requests-osa laseb kasutajatel esitada kogukonnale laulu/playlisti soovitusi, neid täita, raporteerida või kustutada.
- Statistika ja alamribad aitavad jälgida Q-Music ökosüsteemi elavust.
- Lemmikute haldus salvestatakse lokaalselt brauserisse, et sageli kuulatud sisu oleks clipsi kaugusel.

## Tehnoloogiapino

- **Raamistik**: React 18, TypeScript, Vite
- **Kujundus**: Tailwind CSS, Material UI, Emotion
- **Rakenduse olek**: Redux Toolkit, Zustand
- **Andmeallikad**: QORTAL Core API ja QDN (Qortal Data Network)
- **Praktilised tööriistad**: React Hook Form, React Router DOM, moment.js, localforage, Radix UI dialoogid/sliderid
- **Audiotöötlus**: music-metadata-browser, use-sound

## Qortaliga töötamine

Rakendus eeldab Qortal võrgu ja Qortal Core'i olemasolu:

1. Käivita Qortal Core või ava Qortal UI, mis eksponeerib `qortalRequest` API-d.
2. Kui töötad lokaalselt, lisa polüfüll `src/polyfills/qortal.ts` kaudu – see näitab hoiatust, et päris API puudub.
3. Autentimiseks ja kogukonna funktsioonide (Requests, statistika jmt) kasutamiseks on vaja Qortal kontot.

> Vihje: arenduskeskkonnas kasuta Qortal UI siseset brauserit või defineeri bridge oma arendusega; ilma selleta väljastab rakendus arendaja konsooli hoiatuse.

## Projekti käivitamine lokaalselt

1. Paigalda Node.js (soovitavalt 18.x või uuem).
2. Liigu projekti juurkausta:  
   `cd /home/iffiolen/REACT-PROJECTS/Q-Music/working_folder`
3. Paigalda sõltuvused:  
   `npm install`
4. Arendusserver:  
   `npm run dev` ja ava terminalis kuvatud URL (nt http://localhost:5173).
5. Koodi kvaliteedi kontroll:  
   `npm run lint`
6. Tootmispakett:  
   `npm run build` (valmispaketid tekivad kausta `dist/`).

## Varunduse parim praktika

Kombineeri Git commit'id (tõuke GitHubi reposse `Q-Music-Enjoy-The-Music`) lokaalse arhiveerimisega, et oleks tagatud nii versioonikontroll kui ka koopiad välisteks juhuks.

1. Loo kaust varukoopiate jaoks (pärast projekti ümbernimetamist on see juba olemas, vajadusel uuenda rada):  
   `mkdir -p /home/iffiolen/REACT-PROJECTS/Q-Music/BACKUPS`
2. Lisa skript `working_folder/scripts/backup.sh` järgmise sisuga ja muuda käivitatavaks (`chmod +x working_folder/scripts/backup.sh`):

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   PROJECT_DIR="/home/iffiolen/REACT-PROJECTS/Q-Music/working_folder"
   BACKUP_DIR="/home/iffiolen/REACT-PROJECTS/Q-Music/BACKUPS"
   TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

   mkdir -p "$BACKUP_DIR"
   tar --exclude='.git' \
       --exclude='node_modules' \
       --exclude='dist' \
       --exclude='BACKUPS' \
       -czf "$BACKUP_DIR/$TIMESTAMP.tar.gz" \
       -C "$PROJECT_DIR" .

   ls -1t "$BACKUP_DIR" | tail -n +5 | while read -r old; do
     rm -f "$BACKUP_DIR/$old"
   done
   ```

3. Käivita skript vajadusel käsitsi või lisa cron'i (`crontab -e`), et see töötaks nt igal ööl.
4. Sünkroniseeri Git commit'id GitHubi:  
   `git add . && git commit -m "Your message" && git push`.

Skripti loogika jätab alati alles neli kõige värskemat arhivi; vajadusel muuda `tail -n +5` väärtust, kui soovid rohkem koopiad säilitada.

## Kaastöö ja arenduse suunised

- Hargi repo, loo oma haru (`git checkout -b feature/uus-funktsioon`), tee muudatused, lisa testid/kontrollid ja esita pull request.
- Pane tähele ESLint reegleid ja Tailwindi/TypeScripti stiili.
- Küsimuste korral ava GitHubi arutelu või issue.

## Litsents

Projekt on avaldatud MIT litsentsi all. Täpsem info failis `LICENSE`.

---

Q-Music areneb koos kogukonnaga – pane muusika mängima ja naudi!
