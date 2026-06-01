import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Market } from './pages/Market';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ListingDetail } from './pages/ListingDetail';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminListings } from './pages/admin/AdminListings';
import { AdminOrders } from './pages/admin/AdminOrders';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin — no bottom nav, own layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="orders" element={<AdminOrders />} />
        </Route>

        {/* Buyer-facing pages */}
        <Route
          path="*"
          element={
            <>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/market" element={<Market />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/listing/:id" element={<ListingDetail />} />
              </Routes>
              <BottomNav />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
