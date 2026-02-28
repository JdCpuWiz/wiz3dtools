import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './components/auth/LoginPage';
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
import { Dashboard } from './components/dashboard/Dashboard';
import { UsersPage } from './components/admin/UsersPage';
import { useQueue } from './hooks/useQueue';
import { useProducts } from './hooks/useProducts';

export type QueueFilter = 'all' | 'pending' | 'printing';

const inputSt = { background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)', border: 'none', boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)' };

function AddItemForm({ onClose }: { onClose: () => void }) {
  const { create } = useQueue();
  const { products } = useProducts(true); // active only
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');

  const applyProduct = (productId: number) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setProductName(p.name);
    setSku(p.sku || '');
    setDetails(p.description || '');
  };

  const handleSubmit = () => {
    if (!productName.trim()) return;
    create({ productName, sku: sku || undefined, quantity, details: details || undefined, notes: notes || undefined });
    onClose();
  };

  const cellInput = 'w-full px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
  const selectSt = { background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)', border: 'none', boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)' };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-iron-50">Add Queue Item</h3>
        <button onClick={onClose} className="text-iron-500 hover:text-iron-300 text-lg leading-none">×</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {products.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-iron-100 mb-1">Pick from Product Catalog</label>
            <select
              className={cellInput}
              style={selectSt}
              defaultValue=""
              onChange={(e) => e.target.value && applyProduct(parseInt(e.target.value))}
            >
              <option value="">— select a product to auto-fill —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-iron-100 mb-1">Product Name *</label>
          <input value={productName} onChange={(e) => setProductName(e.target.value)} className={cellInput} style={inputSt} placeholder="e.g. Benchy, Phone Stand" autoFocus={products.length === 0} />
          {sku && <span className="block font-mono text-xs text-iron-500 mt-1">{sku}</span>}
        </div>
        <div>
          <label className="block text-sm font-medium text-iron-100 mb-1">Quantity</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={cellInput} style={inputSt} />
        </div>
        <div>
          <label className="block text-sm font-medium text-iron-100 mb-1">Details</label>
          <input value={details} onChange={(e) => setDetails(e.target.value)} className={cellInput} style={inputSt} placeholder="Color, size, material…" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-iron-100 mb-1">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={cellInput} style={inputSt} placeholder="Additional instructions…" />
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
        <button onClick={handleSubmit} disabled={!productName.trim()} className="btn-primary btn-sm">Add to Queue</button>
      </div>
    </div>
  );
}

function QueueView() {
  const [showUpload, setShowUpload] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
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
        {/* Filter tabs + Add Item button */}
        <div className="flex items-center gap-3 flex-wrap">
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
          <button onClick={() => setShowAddItem((v) => !v)} className="btn-secondary btn-sm">
            {showAddItem ? 'Cancel' : '+ Add Item'}
          </button>
        </div>

        {showAddItem && <AddItemForm onClose={() => setShowAddItem(false)} />}

        <QueueList filter={queueFilter} />
      </div>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/queue" element={<ProtectedRoute><QueueView /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><Layout><InvoiceList /></Layout></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><Layout><InvoiceForm /></Layout></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><Layout><InvoiceDetail /></Layout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Layout><CustomerList /></Layout></ProtectedRoute>} />
          <Route path="/customers/new" element={<ProtectedRoute><Layout><CustomerForm /></Layout></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><Layout><CustomerForm /></Layout></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Layout><ProductList /></Layout></ProtectedRoute>} />
          <Route path="/products/new" element={<ProtectedRoute><Layout><ProductForm /></Layout></ProtectedRoute>} />
          <Route path="/products/:id" element={<ProtectedRoute><Layout><ProductForm /></Layout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><Layout><UsersPage /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
