import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Market } from './pages/Market';
import { Sell } from './pages/Sell';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ListingDetail } from './pages/ListingDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="*"
          element={
            <>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/market" element={<Market />} />
                <Route path="/sell" element={<Sell />} />
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
