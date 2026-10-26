import React from 'react';
import { SiteSettings } from '@/types';

interface AboutSectionProps {
  settings?: SiteSettings | null;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ settings }) => {
  return (
    <section id="about" className="py-12 bg-white border-t border-[#e8e2dc] font-casual">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-3">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-[#181512] tracking-tight">
          About MUIRO
        </h2>
        <p className="text-sm text-[#6e6761] leading-relaxed">
          MUIRO is a visual fashion destination shaped by restraint, atmosphere, and the art of the edit.
        </p>
      </div>
    </section>
  );
};
