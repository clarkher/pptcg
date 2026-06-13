import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Browse } from './pages/Browse';
import { CardDetail } from './pages/CardDetail';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ListingDetail } from './pages/ListingDetail';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { CheckoutStoreConfirm } from './pages/CheckoutStoreConfirm';
import { OrderResult } from './pages/OrderResult';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminListings } from './pages/admin/AdminListings';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminCatalog } from './pages/admin/AdminCatalog';
import { AdminRefData } from './pages/admin/AdminRefData';
import { AdminWishlist } from './pages/admin/AdminWishlist';
import AdminLineSettings from './pages/admin/AdminLineSettings';
import AdminKapai from './pages/admin/AdminKapai';
import AdminHuca from './pages/admin/AdminHuca';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

function App() {
  return (
      <BrowserRouter>
        <Routes>
          {/* Static pages — no shell */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Auth — no shell */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Admin login — separate from user login */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Admin — own layout */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="wishlist" element={<AdminWishlist />} />
            <Route path="listings" element={<AdminListings />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="refdata" element={<AdminRefData />} />
            <Route path="kapai" element={<AdminKapai />} />
            <Route path="huca" element={<AdminHuca />} />
            <Route path="line-settings" element={<AdminLineSettings />} />
          </Route>

          {/* Main app — uses AppShell (sidebar on desktop, bottom nav on mobile) */}
          <Route path="*" element={
            <AppShell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/market" element={<Browse />} />
                <Route path="/card/:id" element={<CardDetail />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/listing/:id" element={<ListingDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/checkout/store-confirm" element={<CheckoutStoreConfirm />} />
                <Route path="/order-result" element={<OrderResult />} />
              </Routes>
            </AppShell>
          } />
        </Routes>
      </BrowserRouter>
  );
}

export default App;
