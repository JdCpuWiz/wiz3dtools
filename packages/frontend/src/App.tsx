import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { QueueList } from './components/queue/QueueList';
import { UploadZone } from './components/upload/UploadZone';
import { CustomerList } from './components/customers/CustomerList';
import { CustomerForm } from './components/customers/CustomerForm';
import { InvoiceList } from './components/invoices/InvoiceList';
import { InvoiceForm } from './components/invoices/InvoiceForm';
import { InvoiceDetail } from './components/invoices/InvoiceDetail';

export type QueueFilter = 'all' | 'pending' | 'printing';

function QueueView() {
  const [showUpload, setShowUpload] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');

  if (showUpload) {
    return (
      <Layout onUploadClick={() => setShowUpload(true)}>
        <UploadZone onClose={() => setShowUpload(false)} />
      </Layout>
    );
  }

  return (
    <Layout onUploadClick={() => setShowUpload(true)}>
      <div className="space-y-6">
        {/* Queue Filter Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-1 inline-flex">
          {(['all', 'pending', 'printing'] as QueueFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setQueueFilter(f)}
              className={`
                px-6 py-2 rounded-md font-medium transition-colors text-base
                ${queueFilter === f
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <QueueList filter={queueFilter} />
      </div>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QueueView />} />

        <Route
          path="/invoices"
          element={<Layout><InvoiceList /></Layout>}
        />
        <Route
          path="/invoices/new"
          element={<Layout><InvoiceForm /></Layout>}
        />
        <Route
          path="/invoices/:id"
          element={<Layout><InvoiceDetail /></Layout>}
        />

        <Route
          path="/customers"
          element={<Layout><CustomerList /></Layout>}
        />
        <Route
          path="/customers/new"
          element={<Layout><CustomerForm /></Layout>}
        />
        <Route
          path="/customers/:id"
          element={<Layout><CustomerForm /></Layout>}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
