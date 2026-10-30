import React from 'react';
import { Lookbook, Product } from '@/types';
import { Sparkles, ArrowUpRight, Eye, Link2 } from 'lucide-react';

interface LookbookCardProps {
  look: Lookbook;
  allProducts: Product[];
  onOpenLook: (look: Lookbook) => void;
  onInspect: (src: string, alt: string) => void;
}

function copyLookbookLink(lookId: string) {
  const url = `${window.location.origin}/lookbook/${lookId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}

export const LookbookCard: React.FC<LookbookCardProps> = ({
  look,
  allProducts,
  onOpenLook,
  onInspect
}) => {
  const piecesCount = look.pieces.length;

  return (
    <article
      id={`look-card-${look.id}`}
      className="group bg-white rounded-xl border border-[#e8e2dc] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-[#181512]/30"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[2/3] bg-[#f4efe9] overflow-hidden cursor-pointer" onClick={() => onOpenLook(look)}>
        <img
          src={look.cover}
          alt={look.title}
          loading="lazy"
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Board / Category Tag */}
        <div className="absolute top-3 left-3 bg-[#181512]/90 backdrop-blur-sm text-white text-[11px] font-medium tracking-widest uppercase px-3 py-1 rounded-full shadow-sm">
          {look.category || 'Lookbook'}
        </div>

        {/* Piece Count Pill */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-[#181512] text-xs font-bold px-2.5 py-1 rounded-full border border-[#e8e2dc]/60 shadow-sm flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-700" />
          <span>{piecesCount} {piecesCount === 1 ? 'Piece' : 'Pieces'}</span>
        </div>

        {/* Quick View Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-5">
          <button
            type="button"
            className="w-full py-3 px-4 rounded-lg bg-white text-[#181512] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-neutral-100 transition"
          >
            <span>Explore & Shop Look</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="text-xs text-[#6e6761] uppercase tracking-wider font-semibold mb-1">
            {look.board || 'MUIRO Edit'}
          </div>

          <h3
            onClick={() => onOpenLook(look)}
            className="text-xl font-normal font-serif-editorial text-[#181512] line-clamp-1 group-hover:text-black cursor-pointer mb-2 transition"
          >
            {look.title}
          </h3>

          <p className="text-xs text-[#6e6761] line-clamp-2 leading-relaxed mb-4">
            {look.description}
          </p>
        </div>

        <div className="pt-3 border-t border-[#e8e2dc]/80 flex items-center justify-between">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); copyLookbookLink(look.id); }}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#6e6761] hover:text-[#181512] transition"
            title="Copy lookbook link"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          <button
            onClick={() => onOpenLook(look)}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#181512] hover:underline"
          >
            <span>View Look</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
