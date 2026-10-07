import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductsSection from './components/ProductsSection';
import LookbooksSection from './components/LookbooksSection';
import NewlyAddedAndTrendySection from './components/NewlyAddedAndTrendySection';
import About from './components/About';
import Footer from './components/Footer';
import AdminStudio from './components/AdminStudio';

export default function App() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user has a valid admin session
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      fetch('/api/admin/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) setIsAuthenticated(true);
          else {
            sessionStorage.removeItem('adminToken');
            setIsAuthenticated(false);
          }
        })
        .catch(() => {
          sessionStorage.removeItem('adminToken');
          setIsAuthenticated(false);
        });
    }
  }, []);

  if (isAdminOpen && isAuthenticated) {
    return (
      <AdminStudio
        onClose={() => setIsAdminOpen(false)}
        onLogout={() => {
          sessionStorage.removeItem('adminToken');
          setIsAuthenticated(false);
          setIsAdminOpen(false);
        }}
      />
    );
  }

  return (
    <div className="bg-[#fcfbf9] text-[#181512] antialiased">
      <Navbar
        onAdminClick={() => {
          if (isAuthenticated) {
            setIsAdminOpen(true);
          } else {
            setIsAdminOpen(true);
          }
        }}
      />
      <main>
        <Hero />
        <NewlyAddedAndTrendySection />
        <ProductsSection />
        <LookbooksSection />
        <About />
      </main>
      <Footer />
    </div>
  );
}
