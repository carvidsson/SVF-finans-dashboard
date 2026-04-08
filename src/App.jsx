import React, { useState } from 'react';
import { DataProvider, useData } from './context/DataContext';
import Header from './components/Header';
import DateBar from './components/DateBar';
import FilterBar from './components/FilterBar';
import KPIGrid from './components/KPIGrid';
import Drawer from './components/Drawer';
import Overview from './components/tabs/Overview';
import Sellers from './components/tabs/Sellers';
import Maturity from './components/tabs/Maturity';
import Financial from './components/tabs/Financial';
import Vehicles from './components/tabs/Vehicles';
import Customers from './components/tabs/Customers';
import Top50 from './components/tabs/Top50';
import Overdue from './components/tabs/Overdue';
import Unfinanced from './components/tabs/Unfinanced';
import Finansgrad from './components/tabs/Finansgrad';

const TABS = [
  { id: 'overview', label: 'Översikt' },
  { id: 'sellers', label: 'Säljarranking' },
  { id: 'maturity', label: 'Bytesmogna' },
  { id: 'financial', label: 'Ekonomi & Ränta' },
  { id: 'vehicles', label: 'Fordon & Modeller' },
  { id: 'customers', label: 'Kunder' },
  { id: 'top50', label: 'Topp 50 Potential' },
  { id: 'overdue', label: 'Betalningsstatus' },
  { id: 'unfinanced', label: 'Intern finansiering' },
  { id: 'finansgrad', label: 'Finansgrad VW' },
];

function Dashboard() {
  const { rawData } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const isLoaded = rawData.length > 0;

  return (
    <div>
      <Header />
      {!isLoaded && (
        <div className="container">
          <div className="loading">
            <p>Välkommen! Klicka <strong>"Ladda CSV"</strong> ovan för att ladda in en Stockrapport.</p>
          </div>
        </div>
      )}
      {isLoaded && (
        <div className="container">
          <DateBar />
          <FilterBar />
          <KPIGrid />

          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab${activeTab === t.id ? ' active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={activeTab === 'overview' ? '' : 'hidden'}><Overview /></div>
          <div className={activeTab === 'sellers' ? '' : 'hidden'}><Sellers /></div>
          <div className={activeTab === 'maturity' ? '' : 'hidden'}><Maturity /></div>
          <div className={activeTab === 'financial' ? '' : 'hidden'}><Financial /></div>
          <div className={activeTab === 'vehicles' ? '' : 'hidden'}><Vehicles /></div>
          <div className={activeTab === 'customers' ? '' : 'hidden'}><Customers /></div>
          <div className={activeTab === 'top50' ? '' : 'hidden'}><Top50 /></div>
          <div className={activeTab === 'overdue' ? '' : 'hidden'}><Overdue /></div>
          <div className={activeTab === 'unfinanced' ? '' : 'hidden'}><Unfinanced /></div>
          <div className={activeTab === 'finansgrad' ? '' : 'hidden'}><Finansgrad /></div>
        </div>
      )}
      <Drawer />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Dashboard />
    </DataProvider>
  );
}
