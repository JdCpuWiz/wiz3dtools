import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { QueueList } from './components/queue/QueueList';
import { UploadZone } from './components/upload/UploadZone';
import { CustomerList } from './components/customers/CustomerList';
import { CustomerForm } from './components/customers/CustomerForm';
import { ProductList } from './components/products/ProductList';
import { ProductForm } from './components/products/ProductForm';
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
        <div className="inline-flex p-1 rounded-xl" style={{ background: 'rgba(10,10,10,0.6)' }}>
          {(['all', 'pending', 'printing'] as QueueFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setQueueFilter(f)}
              className={`px-6 py-2 text-sm font-medium transition-all duration-200 ${
                queueFilter === f ? 'nav-tab-active' : 'nav-tab-inactive'
              }`}
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
        <Route path="/invoices" element={<Layout><InvoiceList /></Layout>} />
        <Route path="/invoices/new" element={<Layout><InvoiceForm /></Layout>} />
        <Route path="/invoices/:id" element={<Layout><InvoiceDetail /></Layout>} />
        <Route path="/customers" element={<Layout><CustomerList /></Layout>} />
        <Route path="/customers/new" element={<Layout><CustomerForm /></Layout>} />
        <Route path="/customers/:id" element={<Layout><CustomerForm /></Layout>} />
        <Route path="/products" element={<Layout><ProductList /></Layout>} />
        <Route path="/products/new" element={<Layout><ProductForm /></Layout>} />
        <Route path="/products/:id" element={<Layout><ProductForm /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
