import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';
import { fmtNum, fmtDate } from '../utils/formatters';

function DrawerField({ label, value }) {
  return (
    <div className="drawer-field">
      <span className="df-label">{label}</span>
      <span className="df-value" dangerouslySetInnerHTML={{ __html: value || '-' }} />
    </div>
  );
}

function ContractDetail({ kontrakt, onOpenCustomer }) {
  const { rawData } = useData();
  const r = rawData.find((x) => x['Kontrakt'] === kontrakt);
  if (!r) return <p>Kontrakt ej hittat.</p>;

  const now = new Date();
  const mLeft =
    r['Slutdatum'] && !isNaN(r['Slutdatum'])
      ? Math.max(0, Math.round((r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44)))
      : null;
  const isActive = r['Status kontraktsrad'] === 'Active';
  const statusBadge = isActive
    ? '<span class="badge badge-green">Aktiv</span>'
    : '<span class="badge badge-red">Avslutad</span>';
  const overdue = r['Förfallet (ink VAT'] || 0;

  return (
    <>
      <div className="drawer-section">
        <h3>Status</h3>
        <div className="drawer-grid">
          <DrawerField label="Status" value={statusBadge} />
          <DrawerField label="Kontraktstyp" value={r['Kontraktstyp']} />
          <DrawerField label="Startdatum" value={fmtDate(r['Start Datum'])} />
          <DrawerField label="Slutdatum" value={fmtDate(r['Slutdatum'])} />
          <DrawerField label="Löptid (mån)" value={r['Antal Månader']} />
          <DrawerField label="Kvar (mån)" value={mLeft !== null ? mLeft : '-'} />
        </div>
      </div>
      <div className="drawer-section">
        <h3>Kund</h3>
        <div className="drawer-grid">
          <DrawerField label="Namn" value={r['Kundnamn']} />
          <DrawerField label="Kundtyp" value={r['Kundtyp']} />
          <DrawerField label="Stad" value={r['Stad']} />
          <DrawerField label="Leverantör" value={r['Leverantörsnamn']} />
          <DrawerField label="Case-ägare" value={r['Case-ägare']} />
          <DrawerField label="Kund-ID" value={r['Kund']} />
        </div>
      </div>
      <div className="drawer-section">
        <h3>Fordon</h3>
        <div className="drawer-grid">
          <DrawerField label="Beskrivning" value={r['Fakturatext']} />
          <DrawerField label="Regnr" value={r['Registreringsnummer']} />
          <DrawerField label="Objektsgrupp" value={r['Objektsgrupp Beskrivning']} />
          <DrawerField
            label="Begagnad"
            value={r['Begagnat'] === 'Yes' ? 'Ja' : r['Begagnat'] === 'No' ? 'Nej' : r['Begagnat']}
          />
          <DrawerField label="Reg.datum" value={fmtDate(r['Registreringsdatum'])} />
          <DrawerField label="Bokfört värde" value={fmtNum(r['Bokfört värde']) + ' kr'} />
        </div>
      </div>
      <div className="drawer-section">
        <h3>Ekonomi</h3>
        <div className="drawer-grid">
          <DrawerField label="Finansierat belopp" value={fmtNum(r['Finansierat Belopp']) + ' kr'} />
          <DrawerField label="Nuvärde (kvar)" value={fmtNum(r['Nuvärde']) + ' kr'} />
          <DrawerField label="Restvärde" value={fmtNum(r['Restvärde']) + ' kr'} />
          <DrawerField label="Bas pris" value={fmtNum(r['Bas pris']) + ' kr'} />
          <DrawerField label="Ränta" value={(r['Aktuell ränta'] || 0).toFixed(2) + '%'} />
          <DrawerField label="Månadsbetalning" value={fmtNum(r['Aktuell per amort+rta']) + ' kr'} />
          <DrawerField label="Förhöjd 1:a hyra" value={fmtNum(r['Förhöjd 1:a hyra']) + ' kr'} />
          <DrawerField label="Förskott" value={fmtNum(r['Förskottsbetalning']) + ' kr'} />
          {overdue > 0 && (
            <DrawerField
              label="Förfallet"
              value={`<span class="badge badge-red">${fmtNum(overdue)} kr</span>`}
            />
          )}
          {overdue > 0 && (
            <DrawerField label="Obetalt" value={fmtNum(r['Obetalt (ink VAT)']) + ' kr'} />
          )}
        </div>
      </div>
      <div className="drawer-section">
        <h3>Kontakt</h3>
        <div className="drawer-grid">
          <DrawerField label="Mobiltelefon" value={r['Telefon Mobil']} />
          <DrawerField label="Arbetstelefon" value={r['Telefonarbete']} />
          <DrawerField
            label="E-post"
            value={r['Epost'] ? `<a href="mailto:${r['Epost']}">${r['Epost']}</a>` : '-'}
          />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="export-btn" onClick={() => onOpenCustomer(r['Kund'])}>
          Visa alla kundens kontrakt →
        </button>
      </div>
    </>
  );
}

function CustomerDetail({ custId, onOpenContract }) {
  const { rawData } = useData();
  const contracts = rawData.filter((r) => r['Kund'] === custId);
  if (!contracts.length) return <p>Kund ej hittad.</p>;

  const now = new Date();
  const sample = contracts[0];
  const active = contracts.filter((r) => r['Status kontraktsrad'] === 'Active');
  const totalFin = contracts.reduce((s, r) => s + (r['Finansierat Belopp'] || 0), 0);
  const totalPres = active.reduce((s, r) => s + (r['Nuvärde'] || 0), 0);
  const totalPay = active.reduce((s, r) => s + (r['Aktuell per amort+rta'] || 0), 0);
  const rates = active.filter((r) => r['Aktuell ränta'] > 0).map((r) => r['Aktuell ränta']);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const nearExpiry = active.filter((r) => {
    if (!r['Slutdatum'] || isNaN(r['Slutdatum'])) return false;
    const m = (r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44);
    return m >= 0 && m <= 12;
  }).length;

  const sorted = [...contracts].sort((a, b) => (b['Start Datum'] || 0) - (a['Start Datum'] || 0));

  return (
    <>
      <div className="drawer-kpis">
        {[
          { val: contracts.length, lab: 'Kontrakt totalt' },
          { val: active.length, lab: 'Aktiva' },
          { val: nearExpiry, lab: 'Nära förfall (<12m)' },
          { val: (totalFin / 1e3).toFixed(0) + ' tkr', lab: 'Finansierat totalt' },
          { val: (totalPres / 1e3).toFixed(0) + ' tkr', lab: 'Kvar att betala' },
          { val: avgRate.toFixed(2) + '%', lab: 'Snittränta' },
        ].map((k) => (
          <div key={k.lab} className="drawer-kpi">
            <div className="dk-val">{k.val}</div>
            <div className="dk-lab">{k.lab}</div>
          </div>
        ))}
      </div>
      <div className="drawer-section">
        <h3>Kontakt</h3>
        <div className="drawer-grid">
          <DrawerField label="Telefon" value={sample['Telefon Mobil'] || sample['Telefonarbete']} />
          <DrawerField
            label="E-post"
            value={
              sample['Epost']
                ? `<a href="mailto:${sample['Epost']}">${sample['Epost']}</a>`
                : '-'
            }
          />
          <DrawerField label="Stad" value={sample['Stad']} />
          <DrawerField label="Leverantör" value={sample['Leverantörsnamn']} />
          <DrawerField label="Case-ägare" value={sample['Case-ägare']} />
        </div>
      </div>
      <div className="drawer-section">
        <h3>Alla kontrakt — klicka för detaljer</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="drawer-mini-table">
            <thead>
              <tr>
                <th>Kontrakt</th><th>Typ</th><th>Fordon</th><th>Regnr</th>
                <th>Start</th><th>Slut</th><th>Kvar</th><th>Ränta</th>
                <th>Månadsbet.</th><th>Nuvärde</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isAct = r['Status kontraktsrad'] === 'Active';
                const mLeft =
                  r['Slutdatum'] && !isNaN(r['Slutdatum'])
                    ? Math.max(0, Math.round((r['Slutdatum'] - now) / (1000 * 60 * 60 * 24 * 30.44)))
                    : null;
                return (
                  <tr
                    key={r['Kontrakt']}
                    className="clickable-row"
                    onClick={() => onOpenContract(r['Kontrakt'])}
                  >
                    <td>{isAct ? '🟢' : '🔴'} {r['Kontrakt'] || ''}</td>
                    <td>{r['Kontraktstyp'] || ''}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r['Fakturatext'] || '-'}
                    </td>
                    <td>{r['Registreringsnummer'] || ''}</td>
                    <td>{fmtDate(r['Start Datum'])}</td>
                    <td>{fmtDate(r['Slutdatum'])}</td>
                    <td>{mLeft !== null ? mLeft + ' mån' : '-'}</td>
                    <td>{(r['Aktuell ränta'] || 0).toFixed(2)}%</td>
                    <td>{fmtNum(r['Aktuell per amort+rta'])} kr</td>
                    <td>{fmtNum(r['Nuvärde'])} kr</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ marginTop: 4, fontSize: '.75em', color: '#999' }}>
        Total månadsbetalning (aktiva): <strong>{fmtNum(totalPay)} kr</strong>
      </div>
    </>
  );
}

export default function Drawer() {
  const { drawer, openDrawer, closeDrawer } = useData();
  const { open, type, id } = drawer;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeDrawer]);

  const title = type === 'contract' ? `Kontrakt ${id || ''}` : '';

  return (
    <>
      <div className={`drawer-overlay${open ? ' open' : ''}`} onClick={closeDrawer} />
      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="drawer-header">
          <div>
            <h2 id="drawerTitle">
              {type === 'contract' ? `Kontrakt ${id}` : type === 'customer' ? 'Kund' : 'Detaljer'}
            </h2>
          </div>
          <button className="drawer-close" onClick={closeDrawer}>✕</button>
        </div>
        <div className="drawer-body">
          {open && type === 'contract' && (
            <ContractDetail
              kontrakt={id}
              onOpenCustomer={(custId) => openDrawer('customer', custId)}
            />
          )}
          {open && type === 'customer' && (
            <CustomerDetail
              custId={id}
              onOpenContract={(k) => openDrawer('contract', k)}
            />
          )}
        </div>
      </div>
    </>
  );
}
