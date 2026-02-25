# Toronto Auto Risk Hotspot Scanner

A small full-stack web app that lets users search Toronto Police Service (TPS) KSI collision records by date range, police division, and severity, then view results in a summary + table format and export the current results to CSV.

## Features

- Search by:
  - **Date range** (`From` / `To`)
  - **Police Division**
  - **Severity** (optional)
  - **Limit**
- Backend proxy to TPS ArcGIS Open Data API
- Summary section (item count, top divisions, top severity)
- Simple bar chart visualization (severity distribution summary, built with HTML/CSS rendering in JavaScript)
- Results table (Date, District, Division, Location, Severity)
- CSV export for current search results
- Dynamic dataset date range note (min/max from source data)
- Date picker min/max limits based on dataset bounds
- Default date range set to the **latest available period**
- Results sorted by **latest date first** (`DATE DESC`)

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js, Express
- **External API:** Toronto Police Service Open Data (ArcGIS FeatureServer)

## Project Structure

```text
.
├─ public/
│  ├─ index.html
│  ├─ app.js
│  └─ styles.css
├─ server.js
├─ package.json
├─ package-lock.json
├─ README.md
└─ reflection.txt
```

## How to Run
1. Install dependencies:
```
npm install
```
2. Start the server:
```
node server.js
```
3. Open in browser:
```
http://localhost:3000/app
```


### API Flow (End-to-End)
1. User enters search inputs on the frontend form.
2. Frontend sends an AJAX POST request to:
 - `/api/hotspots`
3. Express backend:
 - validates inputs
 - builds ArcGIS `where` query
 - applies optional severity filter
 - applies sorting (`DATE DESC`) 
 - calls TPS ArcGIS API
 - returns JSON results
4. Frontend renders:
 - search summary context
 - summary statistics
 - search summary context
 - results table
 - CSV export uses current results in memory

### Notes About Data
- DIVISION and DISTRICT values may not always align one-to-one.
- Division labels in the UI are readability hints and do not replace TPS source fields.
- Some legacy divisions may not appear in newer date ranges due to dataset updates/changes.
- Date bounds shown in the UI are fetched from the source dataset and may change if the dataset is updated.

### Example Inputs
- Date range: 2023-11-01 to 2023-12-29
- Police Division: 52 Division
- Severity: Major (optional)
- Limit: 25

### This project demonstrates:
- Frontend form with multiple inputs
- AJAX request/response handling
- Backend route processing with Express
- Third-party Web API integration
- Dynamic rendering of API results
- Simple client-side data visualization (bar chart summary)
- CSV export of filtered results
- Git-based development with incremental commits