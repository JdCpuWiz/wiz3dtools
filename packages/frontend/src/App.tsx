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
import { ColorsPage } from './components/admin/ColorsPage';
import { PrintersPage } from './components/admin/PrintersPage';
import { ManufacturersPage } from './components/admin/ManufacturersPage';
import { FilamentPage } from './pages/FilamentPage';
import { SalesReportPage } from './components/reports/SalesReportPage';
import { useQueue } from './hooks/useQueue';
import { useProducts } from './hooks/useProducts';
import { useColors } from './hooks/useColors';
import { ColorPicker } from './components/common/ColorPicker';
import { colorApi } from './services/api';
import type { ItemColorDto } from '@wizqueue/shared';

export type QueueFilter = 'all' | 'pending' | 'printing' | 'completed';

const inputSt = { background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)', border: 'none', boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)' };

function AddItemForm({ onClose }: { onClose: () => void }) {
  const { create, invalidate } = useQueue();
  const { products } = useProducts(true); // active only
  const { colors: availableColors } = useColors();
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [details, setDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [draftColors, setDraftColors] = useState<ItemColorDto[]>([]);

  const applyProduct = (productId: number) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setProductName(p.name);
    setSku(p.sku || '');
    setDetails(p.description || '');
  };

  const handleSubmit = async () => {
    if (!productName.trim()) return;
    create(
      { productName, sku: sku || undefined, quantity, details: details || undefined, notes: notes || undefined },
      {
        onSuccess: async (newItem) => {
          if (draftColors.length > 0) {
            await colorApi.setQueueItemColors(newItem.id, draftColors);
            invalidate();
          }
        },
      }
    );
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
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-iron-100 mb-1" style={{ color: '#ff9900' }}>Print Colors</label>
          <ColorPicker availableColors={availableColors} selected={draftColors} onChange={setDraftColors} maxColors={4} />
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
  const { items } = useQueue();

  const counts = {
    pending: items.filter((i) => i.status === 'pending').reduce((s, i) => s + i.quantity, 0),
    printing: items.filter((i) => i.status === 'printing').reduce((s, i) => s + i.quantity, 0),
    completed: items.filter((i) => i.status === 'completed').reduce((s, i) => s + i.quantity, 0),
    total: items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled').reduce((s, i) => s + i.quantity, 0),
  };

  if (showUpload) {
    return (
      <Layout>
        <UploadZone onClose={() => setShowUpload(false)} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Counter/filter boxes + Add Item button + Upload button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="card py-0 px-0 flex items-stretch overflow-hidden" style={{ background: 'linear-gradient(to bottom, #3a3a3a, #2d2d2d)' }}>
            {([
              { label: 'Printing', value: counts.printing, color: '#f59e0b', filter: 'printing' as QueueFilter },
              { label: 'Pending',  value: counts.pending,  color: '#60a5fa', filter: 'pending'  as QueueFilter },
              { label: 'Completed',value: counts.completed,color: '#4ade80', filter: 'completed' as QueueFilter },
              { label: 'In Queue', value: counts.total,    color: '#e5e5e5', filter: 'all'      as QueueFilter },
            ]).map((s, i, arr) => (
              <button
                key={s.label}
                onClick={() => setQueueFilter(s.filter)}
                className="flex flex-col items-center justify-center px-6 py-2 transition-colors duration-150 cursor-pointer"
                style={{
                  borderRight: i < arr.length - 1 ? '1px solid #4a4a4a' : undefined,
                  background: queueFilter === s.filter ? 'rgba(255,153,0,0.12)' : undefined,
                  boxShadow: queueFilter === s.filter ? 'inset 0 -2px 0 #ff9900' : undefined,
                }}
              >
                <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#e5e5e5' }}>{s.label}</span>
                <span className="text-2xl font-bold mt-0.5" style={{ color: s.color }}>{s.value}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowAddItem((v) => !v)} className="btn-secondary btn-sm">
            {showAddItem ? 'Cancel' : '+ Add Item'}
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-secondary btn-sm">
            Upload Invoice
          </button>
          <span className="text-sm" style={{ color: '#6b7280' }}>Drag and drop to reorder</span>
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
          <Route path="/admin/colors" element={<ProtectedRoute><Layout><ColorsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/manufacturers" element={<ProtectedRoute><Layout><ManufacturersPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/printers" element={<ProtectedRoute><Layout><PrintersPage /></Layout></ProtectedRoute>} />
          <Route path="/filament" element={<ProtectedRoute><Layout><FilamentPage /></Layout></ProtectedRoute>} />
          <Route path="/reports/sales" element={<ProtectedRoute><Layout><SalesReportPage /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
