# Spain Grants & Subsidies – Open Calls (BDNS) 💶

Get **every public grant and subsidy call in Spain** (*ayudas y subvenciones*) from the official national database, the **Base de Datos Nacional de Subvenciones (BDNS)**: central government, the 17 regions, provincial councils, town councils and other public bodies. Thousands of calls, each with a clear **status**, the **application deadline**, the **budget**, **who can apply**, the **region and province** it covers and the **official links and documents**.

The raw BDNS only gives you a registration date and free text such as *"20 business days from the day after the extract is published"*. This Actor turns that into real dates, tells you whether the call is open, upcoming or closed, and lets you filter the way people actually search.

## What can you do with it?

- 🔔 **Grant alerts**: run it every morning with *Published in the last days* = 1 and send the new calls to email, Slack or Google Sheets.
- 🧑‍💼 **Consultancies and gestorías**: find every open grant for SMEs and self-employed (*autónomos*) in your clients' province.
- 🏛️ **Associations and NGOs**: list the open calls for non-profits in your region, closing soonest first.
- 📊 **Analysis and journalism**: budgets by region, topic or administration; EU-funded calls (FEDER, FSE+, FEADER, Recovery Plan).
- 🧩 **Apps and websites**: clean, structured data with Spanish titles and English field names.

## Input

All filters are optional. With no input you get every call you can still apply for, newest first.

| Field | What it does |
|---|---|
| **Keywords** | Any of these words or phrases in the title, organization, topic, sectors or beneficiaries (Spanish, accents ignored). E.g. `digitalización`, `eficiencia energética`, `alquiler`. |
| **Exclude keywords** | Drop calls containing any of these. |
| **Status** | Open (official deadline), open (estimated deadline), deadline to be confirmed, upcoming, closed. |
| **Who can apply** | SMEs and self-employed, individuals and families, non-profits, large companies. |
| **Regions / Provinces** | E.g. *Andalucía*, *Comunidad de Madrid*, *Málaga*. A province also returns the region-wide calls that cover it. |
| **Include nationwide grants** | Also return calls open to the whole of Spain (default on). |
| **Granting administration** | Central government, regional, local, other public bodies. |
| **Topics** | Housing, employment, education, culture, R&D, trade and SMEs, agriculture, environment… |
| **Granting organization contains** | E.g. `Ayuntamiento de Valencia`, `Diputación`, `Ministerio`. |
| **Published since** / **Published in the last days** | Only calls registered on or after a date, or in the last N days (ideal for daily alerts). |
| **Closing within (days)** | Only calls whose deadline is in the next N days. |
| **Minimum budget**, **EU-funded only**, **Sort by**, **Maximum results**, **Include documents** | |

### Example: open grants for self-employed people in Málaga about digitalization

```json
{
  "keywords": ["digitalización", "digital"],
  "audiences": ["smesAndSelfEmployed"],
  "provinces": ["Málaga"],
  "sortBy": "deadline"
}
```

## Output

One record per call. Titles and texts are in Spanish, exactly as published.

```json
{
  "bdnsCode": "925845",
  "title": "Convocatoria destinadas a financiar proyectos ligados a destinos turísticos de excelencia en los territorios afectados por el Fondo de Transición Justa en Castilla y León",
  "organization": "Instituto para la Competitividad Empresarial de Castilla y León (Castilla y León)",
  "administrationLevel": "region",
  "procedure": "competitive",
  "status": "open",
  "applicationStart": "2026-08-26",
  "applicationEnd": "2026-10-26",
  "deadlineEstimated": false,
  "daysLeft": 12,
  "applicationStartText": null,
  "applicationEndText": null,
  "publishedAt": "2026-08-21",
  "budgetEUR": 11914000,
  "audiences": ["smesAndSelfEmployed"],
  "beneficiaryTypes": ["PYME Y PERSONAS FÍSICAS QUE DESARROLLAN ACTIVIDAD ECONÓMICA"],
  "topic": "otherBenefits",
  "topicEs": "Otras prestaciones económicas",
  "purpose": "Otras Prestaciones económicas",
  "sectors": ["Hoteles y alojamientos similares", "Restaurantes y puestos de comidas", "Actividades deportivas", "…"],
  "nationwide": false,
  "regions": ["Castilla y León"],
  "provinces": ["León", "Palencia"],
  "nutsRegions": ["ES413 - León", "ES414 - Palencia"],
  "euFunds": ["FTJ – FONDO DE TRANSICIÓN JUSTA"],
  "recoveryPlanFunded": false,
  "applicationPortalUrl": "https://www.tramitacastillayleon.jcyl.es/",
  "regulatoryBasesReference": "https://bocyl.jcyl.es/boletines/2024/02/07/pdf/BOCYL-D-07022024-17.pdf",
  "regulatoryBasesTitle": "Orden EYH/74/2024, de 31 de enero, por la que se aprueban las BBRR para la concesión de subvenciones…",
  "officialUrl": "https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/925845",
  "pageUrl": "https://cuantogasta.github.io/ayudas/c/925845-convocatoria-destinadas-a-financiar-proyectos-ligados-a/",
  "documents": [
    {
      "name": "Documento de la convocatoria en español",
      "fileName": "Resolución convocatoria turismo FTJ 2026.pdf",
      "publishedAt": "2026-08-21",
      "url": "https://www.infosubvenciones.es/bdnstrans/api/convocatorias/documentos?idDocumento=1511625"
    }
  ],
  "dataUpdatedAt": "2026-10-13T12:04:48.158Z",
  "source": "Base de Datos Nacional de Subvenciones (BDNS), Intervención General de la Administración del Estado"
}
```

### Status values

| `status` | Meaning |
|---|---|
| `open` | Open, with an official deadline (`applicationEnd`), or marked open by the BDNS. |
| `openEstimatedDeadline` | The deadline is counted from the publication in the official gazette (e.g. *"15 business days from the publication of the extract"*). `applicationEnd` is our estimate; the official wording is in `applicationEndText`. |
| `checkDeadline` | Recent call whose deadline is only in the regulatory bases: check them. |
| `upcoming` | The application period has not started yet (`applicationStart`). |
| `closed` | The deadline has passed. |

`audiences`: `smesAndSelfEmployed`, `individuals`, `nonProfits` (associations, foundations, NGOs, clubs and other legal entities without economic activity), `largeCompanies`.

Every run also saves a free **SUMMARY** record in the key-value store: number of calls, total budget, calls closing in the next 7 days, and counts by status, audience, topic, administration and region.

## Pricing

You only pay for the calls you get (pay per result). Use the filters and *Maximum results* to get exactly what you need.

## How fresh is the data?

The data is refreshed from the BDNS three times a day and covers every call registered in the last months, including the ones that have already closed. `dataUpdatedAt` tells you when it was last refreshed.

## FAQ

**Is this legal?** Yes. The BDNS is public open data of the Spanish Government (Intervención General de la Administración del Estado) and may be reused citing the source, which every record includes.

**Is the estimated deadline reliable?** It assumes the extract is published in the official gazette about 10 days after it is registered in the BDNS. Always confirm the date in the gazette or on the organization's website (`applicationPortalUrl`) before applying.

**Can I get notified of new grants?** Yes. Create an Apify schedule that runs every day with *Published in the last days* = 1 (plus your keywords, region or audience), and connect the results to email, Slack, Google Sheets or a webhook.

## Made by

The team behind [CuántoGasta Ayudas](https://cuantogasta.github.io/ayudas/), a free website to find the grants and subsidies open in every Spanish region.
