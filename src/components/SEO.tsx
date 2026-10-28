import React, { useEffect } from 'react';

interface SEOProps {
  lookbooks: Array<{ id: string; title: string; description?: string }>;
  products: Array<{ id: string; name: string; price: number; url?: string }>;
}

export const SEO: React.FC<SEOProps> = ({ lookbooks, products }) => {
  useEffect(() => {
    // Locate or build a dedicated single tracking entity node to prevent duplicates
    let scriptTag = document.getElementById('muiro-jsonld-schema') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'muiro-jsonld-schema';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const schemaPayload = {
      "@context": "https://schema.org",
      "@type": "ClothingStore",
      "name": "MUIRO Fashion Lookbooks",
      "url": "https://muirofashion.netlify.app",
      "description": "Interactive fashion design moodboards connected straight to retail provider outfit integrations.",
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Featured Fashion Lookbooks",
        "itemListElement": lookbooks.map((lb, index) => ({
          "@type": "OfferCatalogItem",
          "position": index + 1,
          "itemOffered": {
            "@type": "Product",
            "name": lb.title,
            "description": lb.description || "Curated digital style lookbook collections."
          }
        }))
      }
    };

    scriptTag.text = JSON.stringify(schemaPayload, null, 2);
  }, [lookbooks, products]);

  return null; // Purely computational functional SEO layout injector context element
};