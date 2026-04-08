import React, { useRef } from 'react';
import { useData } from '../context/DataContext';
import { parseStockCSV } from '../utils/csvParser';

export default function Header() {
  const { rawData, setRawData } = useData();
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const data = await parseStockCSV(file);
    setRawData(data);
    e.target.value = '';
  };

  const info = rawData.length > 0
    ? `${rawData.length.toLocaleString()} rader | Laddad ${new Date().toLocaleDateString('sv-SE')}`
    : 'Ladda data genom att klicka "Ladda CSV"';

  return (
    <div className="header">
      <div>
        <h1>Svensk Fordonsfinans - Börjessons Dashboard</h1>
        <p>{info}</p>
      </div>
      <div className="upload-area">
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
        <button className="upload-btn" onClick={() => fileRef.current.click()}>Ladda CSV</button>
        <span className="upload-info">Stockrapport-format</span>
      </div>
    </div>
  );
}
