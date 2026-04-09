# SVF Dashboard — Börjessons Finans

Webbaserad analysplattform för att visualisera och analysera fordonfinansieringskontrakt från Svensk Fordonsfinans (SVF). Byggd i React + Vite med Chart.js och PapaParse.

---

## Komma igång

1. Öppna dashboarden i webbläsaren.
2. Klicka på **Ladda CSV** i sidhuvudet och välj en Stockrapport-fil (`;`-separerad CSV, latin1-kodad).
3. All data laddas in och dashboarden uppdateras direkt.

---

## Filter

Längst upp finns ett filterfält och en datumrad som styr vilken data som visas i alla flikar och diagram.

| Filter | Beskrivning |
|---|---|
| **Leverantör** | Välj en eller flera återförsäljare |
| **Säljare / Case-ägare** | Filtrera på specifik säljare |
| **Status** | Alla / Aktiva / Avslutade kontrakt |
| **Kundtyp** | Privat / Näringsidkare |
| **Kontraktsperiod** | Fördefinierade perioder (30d, 90d, QTD, YTD m.fl.) eller anpassat datumintervall |

Knappen **Rensa val** återställer alla filter. En räknare visar hur många rader som matchar ("Visar X av Y rader").

---

## KPI-rad

Åtta nyckeltal beräknas automatiskt på filtrerad data och visas överst:

- **Kontrakt** — Totalt antal och antal aktiva
- **Kunder** — Antal unika kunder
- **Fin. belopp** — Total finansierad volym (Mkr)
- **Kvar att betala** — Nuvärde kvar på aktiva kontrakt (Mkr)
- **Snittränta** — Genomsnittlig ränta på aktiva kontrakt
- **Snitt månadsbet.** — Genomsnittlig månadsbetalning (kr)
- **Bytesmogna <12m** — Aktiva kontrakt som löper ut inom 12 månader (antal och %)
- **Förfallet** — Summa förfallet belopp och antal kontrakt med skuld

---

## Flikar

### Översikt
Ger en samlad bild av portföljens sammansättning:
- Kvartalstillväxt (stapeldiagram antal + linjediagram volym Mkr)
- Jämförelse mellan leverantörer (om flera är valda)
- Fördelningsdiagram: kontraktstyp, fordonstyp, ny/begagnad, privat/företag, antal kontrakt per kund
- **Återköpsgrad** — Andel kunder med avslutat kontrakt som tecknat nytt aktivt kontrakt (mäts separat för privatpersoner och företag)

### Säljarranking
- Topp 15-staplar för finansierad volym och aktivt nuvärde
- Sorteringsbar tabell med alla säljare och mätvärden: antal kontrakt, volym, räntor, bytesmogna, höga räntor (>6 %), höga betalningar (>5 000 kr)
- CSV-export

### Bytesmogna
Fokus på kontrakt som snart löper ut:
- Fördelning per löptidsbucket (0–6m, 7–12m, 13–24m osv.)
- Doughnut: avbetalat / kvarvar / restvärde (Mkr)
- Tabell med alla aktiva kontrakt som löper ut inom 12 månader — sökbar och sorterbar, med CSV-export

### Ekonomi & Ränta
- Räntefördelning (stapeldiagram per räntebucket)
- Betalningsfördelning (stapeldiagram per beloppsbucket)
- Tabell: kontrakt med ränta >6 % (sorterat fallande)
- Tabell: kontrakt med månadsbetalning >5 000 kr (sorterat fallande)
- CSV-export för båda tabellerna

### Fordon & Modeller
Fordonsspecifik statistik och modellfördelning.

### Kunder
Avancerad kundsökning med flera kombinerbara filter:
- Fritextsök (namn, e-post, telefon)
- Kundtyp, stad, fordonstyp, kontraktstyp
- Minsta antal kontrakt / aktiva kontrakt
- Lägsta snittränta, volym, kvarvarande belopp
- Kontrakt som löper ut inom X månader
- Sorteringsbar tabell (upp till 500 träffar) med utgångsbadge i färgkod:
  - Röd = <6 månader kvar
  - Gul = 6–12 månader kvar
  - Grön = >12 månader kvar
- Klicka på ett kundnamn för att öppna detaljvy (se nedan)

### Topp 50 Potential
Rangordnar kunder efter säljpotential via ett poängsystem:

| Kriterium | Max poäng |
|---|---|
| Kontrakt löper ut inom 12m | 30 |
| Hög total månadsbetalning | 20 |
| Ränta >3 % (refinansieringsläge) | 20 |
| Antal aktiva kontrakt | 15 |
| Bonus: Näringsidkare | +15 |

Klicka på kundnamn för att öppna detaljvy.

### Betalningsstatus
Visar kontrakt med förfallna eller obetalda belopp.

### Intern finansiering
Kontrakt finansierade internt.

### Finansgrad VW
Separat vy för uppföljning av Volkswagen Finance-finansieringsgrad (se nedan).

---

## Kunddetalj och kontraktsdrilldown

Klickar man på ett **kundnamn** i valfri tabell öppnas en sidopanel (drawer) med:

**Kundöversikt:**
- 6 KPI-kort: totala kontrakt, aktiva, bytesmogna (<12m), finansierad volym, kvarvar att betala, snittränta
- Kontaktuppgifter (telefon, e-post — klickbara), stad, leverantör, case-ägare

**Kontraktslista:**
- Alla kundens kontrakt i en mini-tabell med statusindikator (grön = aktiv, röd = avslutad)
- Kontraktstyp, fordon, regnr, datum, månader kvar, ränta, månadsbet., nuvärde
- Klicka på ett kontrakt för att öppna **kontraktsdetalj**

**Kontraktsdetalj innehåller:**
- Status och period (start/slut, månader kvar)
- Kundinformation
- Fordonsinformation (modell, regnr, typ, ny/beg, bokfört värde)
- Finansiell information: finansierat belopp, nuvärde, restvärde, baspris, ränta, månadsbetalning, förhöjd 1:a hyra, förskottsbetalning
- Förfallet belopp (röd badge om >0)
- Knapp "Visa alla kundens kontrakt" för att navigera tillbaka till kundvyn

---

## Finansgrad VW

Fliken kräver en separat uppladdning av Excel-filen **"ÅF Utfall mot mål"** (.xlsx) från VW Finance-portalen.

**Excelfilens tre flikar tolkas automatiskt:**
1. **Leveranser** — ÅF-nummer, region, ny/beg, leveransdatum
2. **Finanskontrakt** — ÅF-nummer, region, startdatum, typ (OP/FI), finansierat belopp, serviceavtal
3. **Utfall mot mål** — Periodlabel, mål för VFS-finansgrad och OP.leasing per ny/beg

**Mätvärden som beräknas per region:**
- Levererade fordon (ny/beg-uppdelat)
- VFS finansgrad = finansierade kontrakt / leveranser × 100 %
- VFS mål (hämtas från Excel)
- OP.leasing-penetration
- Serviceavtal som andel av VFS-kontrakt

**Diagram:**
- VFS/OP-penetration per region
- Ny vs. Begagnad-fördelning
- Överlager med Börjessons Finans-data från CSV-stockrapporten (kan visas totalt eller per leverantör)

**CSV-stockrapporten kan filtreras direkt i fliken** med datumintervall och objektsgrupp (förval: Personbil + Lätt lastbil) för att jämföra VW-regiondata mot intern data.

---

## Export

Flera tabeller har knappen **Exportera CSV** som laddar ner aktuell filtrerad data som en UTF-8-kompatibel CSV-fil redo att öppna i Excel.

---

## Teknikstack

- **React 18** med Context API för global state
- **Vite** som byggverktyg
- **Chart.js** för alla diagram
- **PapaParse** för CSV-parsning (latin1, semikolonseparerad)
- **XLSX (SheetJS)** för Excel-parsning (Finansgrad VW)
- Statisk webbapp — inga backend-beroenden, all data stannar i webbläsaren
