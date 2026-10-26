export interface Product {
  id: string;
  title: string;
  price: string;
  numericPrice: number;
  board: string;
  category: string;
  image: string;
  description: string;
  affiliateUrl: string;
  merchant: string;
  merchantId?: string;
  affiliateProgramId?: string;
  commissionRate: number;
  badge?: string;
  rating: number;
  reviewCount: number;
  clicks: number;
  featured?: boolean;
  isNewlyAdded?: boolean;
  isTrending?: boolean;
}
