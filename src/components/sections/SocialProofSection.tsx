import React, { useState } from 'react';
import { Testimonial } from '@/types';
import { Star, CheckCircle2, ThumbsUp, Quote, MessageSquarePlus } from 'lucide-react';

interface SocialProofSectionProps {
  testimonials: Testimonial[];
  onAddReviewClick: () => void;
}

export const SocialProofSection: React.FC<SocialProofSectionProps> = ({
  testimonials,
  onAddReviewClick
}) => {
  const [helpfulMap, setHelpfulMap] = useState<Record<string, number>>({});

  const handleHelpful = (id: string, currentCount: number) => {
    if (helpfulMap[id]) return;
    setHelpfulMap(prev => ({
      ...prev,
      [id]: (prev[id] || currentCount) + 1
    }));
  };

  return (
    <section id="reviews-section" className="py-16 bg-[#f7f4ee] border-y border-[#e8e2dc]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[#6e6761] mb-2 flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-amber-700" />
              <span>From the MUIRO Circle</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-normal font-serif-editorial text-[#181512]">
              Worn, loved, remembered.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white p-3.5 rounded-xl border border-[#e8e2dc] shadow-xs flex items-center gap-3">
              <div className="text-3xl font-bold font-serif-editorial text-[#181512]">
                4.9
              </div>
              <div className="text-xs">
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
                  ))}
                </div>
                <div className="text-[#6e6761] mt-0.5 font-medium">3,420+ Outfits Recreated</div>
              </div>
            </div>

            <button
              onClick={onAddReviewClick}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#181512] text-white text-xs font-bold uppercase tracking-wider hover:bg-black transition shadow-sm"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Write Review</span>
            </button>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map(item => {
            const count = helpfulMap[item.id] !== undefined ? helpfulMap[item.id] : item.helpfulCount;
            const hasVoted = helpfulMap[item.id] !== undefined;

            return (
              <div
                key={item.id}
                id={`testimonial-card-${item.id}`}
                className="bg-white rounded-2xl p-6 border border-[#e8e2dc] shadow-xs flex flex-col justify-between transition-all hover:shadow-md"
              >
                <div>
                  {/* Rating Stars & Outfit Tag */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, idx) => (
                        <Star
                          key={idx}
                          className={`w-4 h-4 ${idx < item.rating ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>

                    <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>From the MUIRO Circle</span>
                    </span>
                  </div>

                  {/* Comment */}
                  <p className="text-sm text-[#4a4540] leading-relaxed mb-6 font-normal">
                    "{item.comment}"
                  </p>
                </div>

                <div>
                  {/* Outfit Title Badge */}
                  <div className="text-xs font-medium text-[#6e6761] mb-3 truncate">
                    Wearing: <strong className="text-[#181512]">{item.outfitTitle}</strong>
                  </div>

                  {/* Reviewer Details */}
                  <div className="pt-3 border-t border-[#e8e2dc]/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.avatar}
                        alt={item.author}
                        className="w-10 h-10 rounded-full object-cover border border-[#e8e2dc]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#181512]">{item.author}</div>
                        <div className="text-[11px] text-[#6e6761]">{item.location} • {item.date}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleHelpful(item.id, item.helpfulCount)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition ${
                        hasVoted
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'border-[#e8e2dc] text-[#6e6761] hover:bg-[#f4efe9]'
                      }`}
                      title="Mark as helpful"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{count}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
