import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export function parseStockCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter: ';',
      header: true,
      encoding: 'latin1',
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data
          .map((row) => {
            const r = {};
            for (const [k, v] of Object.entries(row)) {
              r[k.trim()] = typeof v === 'string' ? v.trim() : v;
            }
            const numFields = [
              'Bas pris', 'Finansierat Belopp', 'Restvärde', 'Nuvärde',
              'Aktuell ränta', 'Aktuell per amort+rta', 'Obetalt (ink VAT)',
              'Förfallet (ink VAT', 'Antal Månader', 'Bokfört värde',
              'Förhöjd 1:a hyra', 'Förskottsbetalning', 'Ej officiell marknadsränta',
            ];
            numFields.forEach((f) => {
              if (r[f]) r[f] = parseFloat(String(r[f]).replace(',', '.'));
            });
            ['Start Datum', 'Slutdatum', 'Registreringsdatum'].forEach((f) => {
              if (r[f]) r[f] = new Date(r[f]);
            });
            return r;
          })
          .filter((r) => r['Kontrakt']);
        resolve(data);
      },
      error: reject,
    });
  });
}

export function parseVWCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      let text = evt.target.result;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      Papa.parse(text, {
        delimiter: ',',
        header: false,
        skipEmptyLines: false,
        complete: (results) => resolve(results.data),
        error: reject,
      });
    };
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

// ── Excel parser for "ÅF Utfall mot mål" (.xlsx) ─────────────────────────────
// Reads the "Utfall mot mål" sheet and extracts region-level finansgrad data.
export function parseVWExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        // Prefer "Utfall mot mål" sheet, fall back to first sheet
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase().includes('utfall')) ||
          wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Extract period label from description cell (row 1, col 0)
        let periodLabel = 'Okänd period';
        const desc = String(rows[1]?.[0] || '');
        const pm = desc.match(/Period från:\s*(\d+)\s+Period till:\s*(\d+)/);
        if (pm) periodLabel = `${pm[1]} – ${pm[2]}`;

        const toNum = (v) => {
          const n = Number(v);
          return isNaN(n) ? 0 : n;
        };

        const results = [];
        let currentNybeg = null;

        for (const row of rows) {
          const col1 = String(row[1] || '').trim(); // Ny / Beg
          const col2 = String(row[2] || '').trim(); // ÅF-grupp
          const col3 = String(row[3] || '').trim(); // ÅF-region
          const col4 = String(row[4] || '').trim(); // Återförsäljare
          const col5 = String(row[5] || '').trim(); // ÅF/Agent-nr

          if (col1 === 'Ny' || col1 === 'Beg') currentNybeg = col1;

          // Region-level row: col3 filled, col2/col4/col5 empty
          if (currentNybeg && col3 && !col2 && !col4 && !col5) {
            const total    = toNum(row[6]);   // Antal leveranser
            const vfsCount = toNum(row[7]);   // Antal finanskontrakt
            const opkCount = toNum(row[11]);  // Antal kontrakt op.leasing
            const vfsMal   = toNum(row[10]) * 100; // Mål finansgrad (decimal → %)
            const opkMal   = toNum(row[14]) * 100; // Mål op.leasing (decimal → %)

            results.push({
              nybeg:     currentNybeg,
              region:    col3,
              period:    periodLabel,
              total,
              vfsCount,
              vfsAmount: toNum(row[8]),
              vfsGrad:   total ? (vfsCount / total) * 100 : 0,
              vfsMal,
              opkCount,
              opkAmount: 0,
              opkGrad:   total ? (opkCount / total) * 100 : 0,
              opkMal,
            });
          }
        }

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function processVWData(rows) {
  const cleanNum = (val) => {
    if (!val && val !== 0) return 0;
    const s = String(val).replace(/\u00A0/g, '').replace(/\s+/g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  // Find ALL nybeg* section headers (nybeg1, nybeg2, …)
  const sections = [];
  for (let i = 0; i < rows.length; i++) {
    const cell = String(rows[i][0] || '')
      .replace(/\uFEFF/g, '')
      .replace(/\u00A0/g, '')
      .trim()
      .toLowerCase();
    if (/^nybeg\d*$/.test(cell)) {
      // Try to find a period label: first check other columns in the same header row,
      // then scan the 5 rows above for a date-like string.
      let periodLabel = null;
      for (let col = 1; col < Math.min(rows[i].length, 15); col++) {
        const v = String(rows[i][col] || '').replace(/\u00A0/g, '').trim();
        if (v && v.length > 3) { periodLabel = v; break; }
      }
      if (!periodLabel) {
        for (let j = Math.max(0, i - 5); j < i && !periodLabel; j++) {
          for (let col = 0; col < Math.min(rows[j].length, 15); col++) {
            const v = String(rows[j][col] || '').replace(/\u00A0/g, '').trim();
            if (v && /\d{4}/.test(v)) { periodLabel = v; break; }
          }
        }
      }
      if (!periodLabel) periodLabel = `Period ${sections.length + 1}`;
      sections.push({ headerRow: i, periodLabel });
    }
  }

  if (sections.length === 0) return [];

  const allResults = [];

  sections.forEach(({ headerRow, periodLabel }, sIdx) => {
    const startRow = headerRow + 1;
    const endRow = sIdx < sections.length - 1 ? sections[sIdx + 1].headerRow : rows.length;
    const seen = new Set();

    for (let i = startRow; i < endRow; i++) {
      const row = rows[i];
      if (!row || row.length < 30) continue;
      const nybeg = String(row[0] || '').replace(/\u00A0/g, '').trim();
      if (nybeg !== 'Ny' && nybeg !== 'Beg') {
        if (nybeg && nybeg.length > 3 && i > startRow + 2) break;
        continue;
      }
      const region = String(row[26] || '').replace(/\u00A0/g, '').trim();
      if (!region) continue;
      const key = nybeg + '|' + region;
      if (seen.has(key)) continue;
      seen.add(key);

      allResults.push({
        nybeg, region, period: periodLabel,
        total:     cleanNum(row[27]),
        vfsCount:  cleanNum(row[28]),
        vfsAmount: cleanNum(row[29]),
        vfsGrad:   cleanNum(row[30]),
        vfsMal:    cleanNum(row[31]),
        opkCount:  cleanNum(row[32]),
        opkAmount: cleanNum(row[33]),
        opkGrad:   cleanNum(row[34]),
        opkMal:    cleanNum(row[35]),
      });
    }
  });

  return allResults;
}
