# Töövoog – Q-Music / Web3 dapp

See fail kirjeldab, KUIDAS selles projektis tööd teha – eriti siis, kui kasutad VS Code AI agenti (Codex).

Eesmärk:
- rakendus ei lähe iga kord katki;
- alati on checkpoint, kuhu tagasi minna;
- AI agent teeb muudatusi kontrollitult, mitte omatahtsi.

---

## 0. Eeldused

- Koodiga töötad kaustas: `working_folder`
- Git on kasutusel
- VS Codes:
  - Codex Agent režiimis (`Agent`, mitte `Agent (full access)`)
  - AGENTS.md on projektis olemas

---

## 1. Põhireegel: üks konkreetne ülesanne korraga

AI agendile:
- **ära anna korraga mitut suurt ülesannet**
- **kirjelda alati täpselt:**
  - mida muuta
  - millistes failides
  - mida EI TOHI puutuda

Halb:
> “Paranda kommentaaride süsteem ära”

Hea:
> “Muuda ainult faili `src/components/Comments/CommentForm.tsx`, et lisada tühja vormi valideerimine.  
> Ära muuda mitte ühtegi teist faili.”

---

## 2. Enne igat töösessiooni

1. Ava terminal õiges kaustas:

   ```bash
   cd working_folder
Kontrolli git-seisu:

bash
Kopeeri kood
git status
Kui eelmisest korrast on mingi tehtud töö valmis:

commit kohe ära, enne uute asjade alustamist.

3. Checkpoint enne agendiga mässamist
Enne kui AI agendile mingi suurema ülesande annad, tee alati checkpoint.

Salvesta kõik failid VS Codes.

Terminalis:

bash
Kopeeri kood
git add .
git commit -m "checkpoint enne agenti"
See commit on sinu turvavõrk.
Kui agent midagi pekki keerab, saad alati siia tagasi hüpata.

4. ÜHE ülesande tegemine agendiga
4.1. Kirjelda ülesanne selgelt
Näide:

Muuda ainult faili src/components/Player/PlayerControls.tsx.
Lisa “Repeat” nupp, mis vahetab repeat ON/OFF olekut.
Ära muuda mitte ühtegi teist faili.
Kui arvad, et on vaja teisi faile muuta, siis peatu ja küsi minult luba.

4.2. Kui agent pakub plaani
loe plaan läbi

kui plaanis on mainitud muud kaustad/failid, mida sa ei palunud:

Ei. Muuda ainult neid faile, mida ma nimepidi mainisin.
Tee plaan uuesti.

Alles siis luba tal jätkata.

5. Pärast agendi muudatusi
5.1. Vaata git diff üle
Terminalis:

bash
Kopeeri kood
git diff
Kontrolli:

kas muutusid ainult need failid, millest jutt oli;

kas on ilmselget jama (imelikud uued failid, random koodijupid jne).

Kui mõni konkreetne fail ei meeldi:

bash
Kopeeri kood
git restore path/nii/selleni/failini.tsx
Kui TERVE sessioon oli jama ja tahad tagasi checkpointi:

bash
Kopeeri kood
git reset --hard HEAD
(See taastab seisu viimase commiti peale.)

5.2. Testi rakendust
Käivita dev server (nt npm run dev) ja kliki läbi see koht, mida muudeti.

Kui vaja, lase vahel ka:

bash
Kopeeri kood
npm run lint
npm run build
Kui kõik töötab ja tundub mõistlik → järgmine samm.

5.3. Commit, kui tulemus sobib
Kui oled muudatusega rahul:

bash
Kopeeri kood
git add .
git commit -m "kirjelda lühidalt, mis muutus"
Näide:

bash
Kopeeri kood
git commit -m "lisatud repeat nupp player controls komponendile"
Siit edasi uus tsükkel:

jälle checkpoint

jälle üks konkreetne ülesanne

diff + test

commit

6. Kui agent ajab jälle midagi pekki
Kui märkad, et:

mingid failid on muutunud, mida sa ei palunud

rakendus viskab errorit

projekt käitub veidralt

Siis:

Kontrolli diff:

bash
Kopeeri kood
git diff
Kui jama on väike ja ühes-kahes failis:

taasta ainult need failid:

bash
Kopeeri kood
git restore src/fail/mis_on_katki.tsx
Kui jama on igal pool:

hüppa tagasi viimasesse korralikku checkpointi:

bash
Kopeeri kood
git reset --hard HEAD
Õpi sellest:

kitsenda järgmine kord ülesannet

lisa vajadusel AGENTS.md-sse uus reegel (näiteks, et ta ei tohi mingit kindlat kausta puutuda).

7. Ühe päeva lihtne rutiin
Ava projekt (working_folder).

git status → vaata seisu.

Tee vajadusel commit eilsest tööst.

Tee checkpoint enne agendi kasutamist.

Anna agendile üks konkreetne ülesanne.

Pärast tema tööd:

git diff → kontrolli muudatusi

testi rakendust

Kui kõik korras → commit.

Mine järgmise väikse ülesande juurde.

8. Mille vastu see rutiin kaitseb
Agent ei saa “kogemata” pool projekti ümber kirjutada ilma, et sa näeksid, mis toimus.

Kui midagi läheb katki, ei pea sa nullist alustama – lihtsalt tagasi eelmise checkpointi.

Sa ise näed täpselt, mida iga sammuga muudeti.

Projekt ei muutu ajapikku täiesti arusaamatuks prügimäeks.

Seda rutiini tuleb korrata iga päev, seni kuni see muutub automaatseks harjumuseks.