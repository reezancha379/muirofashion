import { useEffect, useState } from 'react';

interface Product {
  id: string;
  title: string;
  price: string;
  image: string;
  description: string;
  affiliate: string;
}

interface Lookbook {
  id: string;
  title: string;
  cover: string;
  description: string;
  pieces: string[];
}

interface Content {
  products: Product[];
  lookbooks: Lookbook[];
}

export function StorefrontSections() {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/content-snapshot.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Content unavailable');
        const snapshot = await response.json();
        if (!Array.isArray(snapshot.products) || !Array.isArray(snapshot.lookbooks)) {
          throw new Error('Invalid content');
        }
        setContent(snapshot);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert" className="p-8">The fashion edit could not load. Please reload to try again.</p>;
  if (!content) return <p role="status" className="p-8">Loading the fashion edit…</p>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 space-y-20">
      <section id="products">
        <h2 className="font-serif text-4xl mb-8">Shoppable discoveries</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {content.products.map((product) => (
            <article key={product.id} className="bg-white border border-[#e0dcd8] rounded-lg overflow-hidden">
              <img src={product.image} alt={product.title} loading="lazy" className="w-full aspect-[2/3] object-cover" />
              <div className="p-6 space-y-3">
                <h3 className="font-serif text-xl">{product.title}</h3>
                <p className="text-sm text-[#666]">{product.description}</p>
                {product.price && <p>${product.price}</p>}
                <a href={product.affiliate} target="_blank" rel="sponsored noopener noreferrer" className="inline-block underline underline-offset-4">Shop this piece</a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section id="lookbooks">
        <h2 className="font-serif text-4xl mb-8">Lookbooks</h2>
        {content.lookbooks.map((lookbook) => (
          <article key={lookbook.id} className="grid md:grid-cols-2 gap-8 items-center">
            <img src={lookbook.cover} alt={lookbook.title} loading="lazy" className="w-full aspect-[2/3] object-cover rounded-lg" />
            <div className="space-y-4">
              <h3 className="font-serif text-3xl">{lookbook.title}</h3>
              <p className="text-[#666]">{lookbook.description}</p>
              <a className="inline-block underline underline-offset-4" href={`/lookbook.html?look=${encodeURIComponent(lookbook.id)}`}>Explore the {lookbook.pieces.length} pieces</a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function About() {
  return (
    <section id="about" className="max-w-7xl mx-auto px-4 py-16 border-t border-[#e0dcd8]">
      <h2 className="font-serif text-4xl mb-6">Fashion, curated with a closer look.</h2>
      <p className="max-w-3xl text-[#666]">MUIRO is a visual destination for fashion inspiration, aesthetic outfits and shoppable discoveries. We collect the details worth stopping for and organize them into simple, editorial edits.</p>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#eee9e3] px-4 py-12">
      <div className="max-w-7xl mx-auto space-y-4">
        <a href="#" className="font-serif text-3xl">MUIRO</a>
        <p className="text-sm text-[#666]">MUIRO links are affiliate links. Qualifying purchases may earn a commission at no additional cost to you.</p>
        <a href="https://www.pinterest.com/muirofashion/" target="_blank" rel="noopener noreferrer" className="underline">Pinterest</a>
      </div>
    </footer>
  );
}
