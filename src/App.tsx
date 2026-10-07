import Navbar from './components/Navbar';
import Hero from './components/Hero';
import { StorefrontSections, About, Footer } from './components/StorefrontSections';

export default function App() {
  return (
    <div className="bg-[#fcfbf9] text-[#181512] antialiased">
      <Navbar />
      <main>
        <Hero />
        <StorefrontSections />
        <About />
      </main>
      <Footer />
    </div>
  );
}
