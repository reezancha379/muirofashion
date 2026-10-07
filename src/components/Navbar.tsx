import { useState } from 'react';
import { Menu, X, Heart } from 'lucide-react';

interface NavbarProps {
  onAdminClick?: () => void;
}

export default function Navbar({ onAdminClick }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);

  const updateWishlistCount = () => {
    const wishlist = JSON.parse(localStorage.getItem('muiro_wishlist') || '[]');
    setWishlistCount(wishlist.length);
  };

  const navLinks = [
    { label: 'Home', href: '#' },
    { label: 'Products', href: '#products' },
    { label: 'Lookbooks', href: '#lookbooks' },
    { label: 'About', href: '#about' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#e0dcd8] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href="#" className="text-2xl font-bold text-[#181512]">
              MUIRO
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[#181512] hover:text-[#666] transition-colors text-sm font-medium"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            <button
              onClick={updateWishlistCount}
              className="relative p-2 text-[#181512] hover:text-[#666] transition-colors"
              aria-label="Wishlist"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#181512] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            <button
              onClick={onAdminClick}
              className="px-4 py-2 text-sm font-medium text-[#181512] border border-[#181512] rounded-full hover:bg-[#181512] hover:text-white transition-colors hidden md:block"
            >
              Admin
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-[#181512]"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block px-4 py-2 text-[#181512] hover:bg-[#f5f1ed] rounded transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => {
                onAdminClick?.();
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-[#181512] hover:bg-[#f5f1ed] rounded transition-colors font-medium"
            >
              Admin
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
