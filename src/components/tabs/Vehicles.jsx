import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useData } from '../../context/DataContext';
import { COLORS, fmtNum } from '../../utils/formatters';

export default function Vehicles() {
  const { filteredData } = useData();
  const now = new Date();

  const active = useMemo(() => filteredData.filter((r) => r['Status kontraktsrad'] === 'Active'), [filteredData]);

  const { sorted, top20 } = useMemo(() => {
    const models = {};
    active.forEach((r) => {
      let m = (r['Fakturatext'] || '').trim();
      if (!m || m.length < 2) m = 'Okänd';
      m = m.replace(/,\s*/g, ' ').replace(/\s+/g, ' ').toUpperCase();
      if (!models[m]) models[m] = { count: 0, totalFin: 0, totalRate: 0, rateCount: 0, totalAge: 0, ageCount: 0 };
      models[m].count++;
      models[m].totalFin += r['Finansierat Belopp'] || 0;
      if (r['Aktuell ränta'] > 0) { models[m].totalRate += r['Aktuell ränta']; models[m].rateCount++; }
      if (r['Start Datum'] && !isNaN(r['Start Datum'])) {
        models[m].totalAge += (now - r['Start Datum']) / (1000 * 60 * 60 * 24 * 30.44);
        models[m].ageCount++;
      }
    });
    const sorted = Object.entries(models).sort((a, b) => b[1].count - a[1].count);
    return { sorted, top20: sorted.slice(0, 20) };
  }, [active]);

  const crossData = useMemo(() => {
    const cross = {};
    filteredData.forEach((r) => {
      const obj = r['Objektsgrupp Beskrivning'] || 'Övrigt';
      const ct = r['Kontraktstyp'] || 'Okänd';
      if (!cross[ct]) cross[ct] = {};
      cross[ct][obj] = (cross[ct][obj] || 0) + 1;
    });
    const objLabels = [...new Set(filteredData.map((r) => r['Objektsgrupp Beskrivning'] || 'Övrigt'))];
    const ctLabels = Object.keys(cross);
    const datasets = ctLabels.map((ct, i) => ({
      label: ct,
      data: objLabels.map((o) => cross[ct][o] || 0),
      backgroundColor: COLORS[i % COLORS.length],
    }));
    return { objLabels, datasets };
  }, [filteredData]);

  return (
    <div>
      <div className="chart-row">
        <div className="chart-box">
          <h3>Topp 20 bilmodeller (aktiva)</h3>
          <Bar
            data={{ labels: top20.map((e) => e[0]), datasets: [{ data: top20.map((e) => e[1].count), backgroundColor: COLORS.concat(COLORS) }] }}
            options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'Antal' } } } }}
          />
        </div>
        <div className="chart-box">
          <h3>Objektsgrupp × Kontraktstyp</h3>
          <Bar
            data={{ labels: crossData.objLabels, datasets: crossData.datasets }}
            options={{ responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { ticks: { font: { size: 9 } } } } }}
          />
        </div>
      </div>

      <div className="section">
        <h2>Fördelning per bilmodell</h2>
        <div className="table-scroll">
          <table id="tableModels">
            <thead>
              <tr><th>Modell</th><th>Antal</th><th>Andel</th><th>Snittbelopp</th><th>Snittränta</th><th>Snittålder (mån)</th></tr>
            </thead>
            <tbody>
              {sorted.map(([m, v]) => {
                const avgFin = v.count ? v.totalFin / v.count : 0;
                const avgRate = v.rateCount ? v.totalRate / v.rateCount : 0;
                const avgAge = v.ageCount ? v.totalAge / v.ageCount : 0;
                const pct = active.length ? (v.count / active.length * 100).toFixed(1) : '0';
                return (
                  <tr key={m}>
                    <td>{m}</td>
                    <td>{v.count}</td>
                    <td>{pct}%</td>
                    <td>{fmtNum(avgFin)}</td>
                    <td>{avgRate.toFixed(2)}%</td>
                    <td>{Math.round(avgAge)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
