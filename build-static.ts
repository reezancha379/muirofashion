import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface Lookbook {
  id: string;
  slug?: string;
  title?: string;
}

interface SnapshotData {
  lookbooks: Lookbook[];
  products: any[];
  heroSlides: any[];
}

function generateSitemap(snapshotData: SnapshotData) {
  const baseUrl = 'https://muirofashion.netlify.app';
  const currentDate = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Base Homepage Index
  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  // Dynamically map existing snapshot lookbook vectors
  if (snapshotData && Array.isArray(snapshotData.lookbooks)) {
    snapshotData.lookbooks.forEach((lookbook) => {
      const identifier = lookbook.slug || lookbook.id;
      xml += `  <url>\n    <loc>${baseUrl}/lookbook/${identifier}</loc>\n    <lastmod>${currentDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
  }

  xml += `</urlset>`;

  try {
    // Write map copies across build locations
    const publicPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    const sitePath = path.join(process.cwd(), 'site', 'sitemap.xml');
    
    fs.writeFileSync(publicPath, xml, 'utf8');
    fs.writeFileSync(sitePath, xml, 'utf8');
    console.log(`[build-static] ✅ Pre-rendered fresh sitemap.xml with ${snapshotData.lookbooks.length} lookbook endpoints.`);
  } catch (error) {
    console.error(`[build-static] ❌ Failed to write sitemap output streams:`, error);
  }
}

async function runStaticPipeline() {
  console.log("[build-static] Initiating local content-caching workflow...");
  
  // Load real snapshot data from Supabase Storage or local seed
  const snapshotUrl = `https://apbuobhhaczrruovfkdu.supabase.co/storage/v1/object/public/muiro-public/content-snapshot.json`;
  let snapshotData: SnapshotData = {
    lookbooks: [],
    products: [],
    heroSlides: []
  };

  try {
    const response = await fetch(snapshotUrl, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      snapshotData = {
        lookbooks: data.lookbooks || [],
        products: data.products || [],
        heroSlides: data.heroSlides || []
      };
      console.log(`[build-static] Loaded snapshot: ${snapshotData.lookbooks.length} lookbooks, ${snapshotData.products.length} products`);
    }
  } catch (error) {
    console.warn('[build-static] Could not fetch remote snapshot, using local seed');
    // Fallback to local data
    const seedPath = path.join(process.cwd(), 'data', 'store.json');
    if (fs.existsSync(seedPath)) {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      snapshotData = {
        lookbooks: seed.lookbooks || [],
        products: seed.products || [],
        heroSlides: seed.heroSlides || []
      };
    }
  }

  try {
    console.log("[build-static] Running vite compilation scripts...");
    execSync('npm run build:client', { stdio: 'inherit' });

    // Enforce static directory creation fallback mappings
    const siteDir = path.join(process.cwd(), 'site');
    if (!fs.existsSync(siteDir)) {
      fs.mkdirSync(siteDir, { recursive: true });
    }

    // Process our AI map generation engine pipeline steps
    generateSitemap(snapshotData);
    
    // Save state context configurations
    fs.writeFileSync(path.join(siteDir, 'content-snapshot.json'), JSON.stringify(snapshotData, null, 2));
    console.log("[build-static] Done. Pre-rendering completed successfully.");
  } catch (err) {
    console.error("[build-static] Critical structural runtime break encountered:", err);
    process.exit(1);
  }
}

runStaticPipeline();