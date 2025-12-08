# AGENTS.md – Q-Music – Enjoy The Music

Sa oled AI koodimagend (Codex), töötad **Q-Music** projektiga kaustas `working_folder`.

Projekt on:
- React 18 + TypeScript + Vite
- Tailwind CSS, Material UI, Emotion
- Redux Toolkit, Zustand
- Qortal Core API + QDN (`qortalRequest` brauseris) :contentReference[oaicite:0]{index=0}

## Setup ja käsud

Töötad alati kaustas `working_folder`.

- Installi sõltuvused: `npm install`
- Käivita dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build` :contentReference[oaicite:1]{index=1}  

Kui need käsud ei tööta, ÄRA hakka ise pakette välja vahetama – küsi kasutajalt luba enne, kui midagi package failides muudad.

## Üldreeglid (väga olulised)

1. **ÄRA muuda midagi väljaspool `working_folder/`** ilma selge käsuta kasutajalt.
2. **ÄRA puutu järgmisi faile ilma otsese loata:**
   - `package.json`
   - `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
   - `tsconfig*`, `vite.config*`
   - `.eslintrc*`, `.prettierrc*`
   - `.env*` ja kõik failid, mis sisaldavad võtmeid / paroole / privaatset infot
3. ÄRA puuduta repo juure kausta `BACKUPS/` ega seal olevaid arhive. See on ainult käsitsi backup’ide jaoks.
4. Kui kasutaja palub muuta KONKREETSET faili:
   - muuda **ainult neid faile**, mida ta nimeliselt mainib;
   - kui arvad, et on vaja teisi faile muuta, **peatu** ja küsi enne luba, loetle selgelt:
     - milliseid faile tahad muuta;
     - miks neid üldse vaja puutuda.
5. Enne KÕIKI mitme faili muudatusi:
   - esita lühike plaan (bullet’itega), kus kirjas:
     - mida sa teed;
     - milliseid faile muudad;
   - alles pärast kasutaja nõusolekut hakka muutma.

## Projektistruktuur

- Frontendi kood asub kaustas `src/`.
- Hoia end olemasolevate mustrite ja kaustade küljes:
  - kasuta olemasolevaid komponente, hooke ja utiliite;
  - ära leiuta uusi top-level kaustu, kui pole otseselt palutud.
- Kui on kahtlus, kumb variant sobib, eelista:
  - lihtsamat lahendust,
  - vähem faile ja vähem “maagilist” abstraktsiooni.

## Qortal / Web3 reeglid

- Kõik Qortal Core / QDN kõned peavad käima olemasolevate utiliitide ja polyfillide kaudu (näiteks `src/polyfills/qortal.ts` või sarnased), mitte uute suvaliste `fetch` kõnede kaudu kõvaketastud URL-idega. :contentReference[oaicite:2]{index=2}  
- ÄRA muuda autentimise, allkirjastamise ega privaatvõtmete loogikat ilma selge, otsese juhiseta kasutajalt.
- Arvesta, et lokaalses arenduses võib Qortal API puududa:
  - ära eemalda hoiatusi, mis teavitavad puuduvast API-st;
  - ära tee koodi nii, et rakendus lihtsalt kokku jookseb, kui Qortal API puudub.

## Lubatud käsud

Neid käske võib vajadusel käivitada, aga ütle kasutajale enne, mida teed ja miks:

- `npm run lint` – lindi kontroll
- `npm run build` – kontroll, et build õnnestub

Enne käivitamist:
- ütle selgelt: “kavatsen käivitada `npm run lint` / `npm run build` ja vaadata, kas on vigu”.

**Keelatud käsud ilma otsese loata:**

- `npm install`, `npm uninstall`, `npm update`
- kõik deploy / publish käsud
- `git push`, `git fetch`, `git pull` – ära kasuta neid üldse

## Koodistiil

- TypeScript:
  - ära topi igale poole `any`; lisa tüübid nii palju kui mõistlik.
- UI:
  - kasuta Tailwind / Material UI / olemasolevaid stiilikomponente;
  - ära too projekti suvalisi uusi UI raamistikke.

## Kui tekib vastuolu

Kui see fail ja kasutaja otsene käsk lähevad omavahel vastuollu:
- ütle kasutajale, milles vastuolu seisneb,
- küsi kinnitust,
- ja tegutse vastavalt kasutaja värskele otsesele käsule.
