export interface SiteSettings {
  aboutTitle: string;
  aboutSubtitle: string;
  aboutStory: string;
  aboutPillars: {
    title: string;
    desc: string;
    icon: string;
  }[];
  affiliateDisclosure: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  ogImage?: string;
}

export interface Testimonial {
  id: string;
  author: string;
  location: string;
  avatar: string;
  rating: number;
  outfitTitle: string;
  comment: string;
  verified: boolean;
  date: string;
  helpfulCount: number;
  featured?: boolean;
}
