export interface Lookbook {
  id: string;
  title: string;
  board: string;
  category: string;
  cover: string;
  frame?: string;
  description: string;
  pieces: string[];
  views: number;
  likes: number;
  featured?: boolean;
  isNewlyAdded?: boolean;
  isTrending?: boolean;
  authorNote?: string;
  season?: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  fallbackImage?: string;
  title: string;
  tagline: string;
  category: string;
  lookId?: string;
  keyPieces: string[];
  isActive?: boolean;
  order?: number;
}
