import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './components/auth/LoginPage';
import { Layout } from './components/layout/Layout';
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
import { ManufacturersPage } from './components/admin/ManufacturersPage';
import { CategoriesPage } from './components/admin/CategoriesPage';
import { ShowcasePortfolioPage } from './components/admin/showcase/PortfolioPage';
import { FilamentPage } from './pages/FilamentPage';
import { SalesReportPage } from './components/reports/SalesReportPage';

// BuildPlan #6 Phase 3 (2026-06-04): /queue, /printers, /admin/printers
// routes removed — the queue + on-printer status + printer registry now
// live in BamBuddy at https://bambuddy.deckerzoo.com.

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
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
          <Route path="/admin/categories" element={<ProtectedRoute><Layout><CategoriesPage /></Layout></ProtectedRoute>} />
          {/* /admin/wholesale retired in BuildPlan #11 Phase 1.5 — wholesale
              access is now managed inline on each customer record. Redirect
              any stale bookmarks to the customer list. */}
          <Route path="/admin/wholesale" element={<Navigate to="/customers" replace />} />
          {/* Showcase CMS (BuildPlan #11 Phase 3) — admin proxies to
              wiz3d-prints' /api/portfolio. Other 4 entities (services,
              materials, testimonials, about) follow in later sub-phases. */}
          <Route path="/admin/showcase/portfolio" element={<ProtectedRoute><Layout><ShowcasePortfolioPage /></Layout></ProtectedRoute>} />
          <Route path="/filament" element={<ProtectedRoute><Layout><FilamentPage /></Layout></ProtectedRoute>} />
          <Route path="/reports/sales" element={<ProtectedRoute><Layout><SalesReportPage /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
