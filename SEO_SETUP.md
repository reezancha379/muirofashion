# MUIRO SEO Setup (Local Review)

This file records the SEO changes prepared in the repository. They are local source changes only; nothing has been pushed to GitHub, published to Netlify, or changed in the live Supabase project.

## Implemented in this review

- Homepage title set to exactly `MUIRO`, plus description, canonical URL, robots meta, Open Graph URL/image text, and Twitter card metadata.
- Factual JSON-LD for the MUIRO organization, website, and homepage collection. It does not claim that MUIRO is the merchant or that it controls product price/stock.
- Root `robots.txt`, canonical `sitemap.xml`, and an optional `llms.txt` site guide.
- A visible-to-no-JavaScript fallback description so the HTML response is not only an empty React mount when scripts are unavailable.
- Regression checks for these public SEO files and metadata.

The browser-tab title, social-card titles, and structured site/page names are exactly `MUIRO`, as requested. The keyword-rich meta description remains separate. A brand-only title is less descriptive in search results than a brand-plus-topic title, so that is an intentional brand preference rather than an SEO recommendation.

The configured origin, `https://muirofashion.netlify.app/`, is already present in the project's existing JSON-LD. Before the first publish, confirm that this is still the site's canonical public domain and that the Netlify custom domain is attached to it. If the primary domain differs, update the canonical URL, sitemap, robots sitemap line, structured data, and llms.txt together.

## Deliberate limits

The current website is a client-rendered single-page app. Its visible lookbook modal and shop view are not separate content-rich pathname routes, so the sitemap lists only the homepage. The query-driven `?look=` and `?view=` variants should not be listed as independent pages. Generating one URL per product or lookbook before the app has stable detail routes and cleaned editorial data would risk thin or duplicate pages. The local content seed includes an obvious placeholder product title/description and one referenced upload image returned 404 in the local preview. Verify whether the production Supabase snapshot uses a different valid asset, and clean the live content before building product-specific SEO pages or product structured data.

`llms.txt` is an emerging optional convention, not a ranking factor or guarantee of AI citations. The wildcard robots policy allows all public-page crawling, including search and retrieval bots, and only excludes `/api/`. It does not separately block model-training crawlers. The owner should make a separate training-crawler opt-out decision if desired; search/retrieval access and model-training use are distinct policies.

## Pre-publish checklist

1. Confirm `https://muirofashion.netlify.app/` is the primary domain and that HTTPS works.
2. Verify the built site's raw `/`, `/robots.txt`, `/sitemap.xml`, and `/llms.txt` responses before release.
3. Confirm that public CMS content is accurate and free of placeholders before adding item URLs to the sitemap.
4. After deployment approval, add the domain and sitemap in Google Search Console and Bing Webmaster Tools, then monitor indexing and canonical selection.
5. Treat search visibility as an outcome to measure; metadata and structured data do not guarantee rankings or AI citations.
