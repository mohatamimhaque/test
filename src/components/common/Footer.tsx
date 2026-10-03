import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800 pt-6 pb-20 md:pb-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center text-xs text-slate-400 gap-1.5">
        <span>Developed by</span>
        <a 
          href="https://wa.me/mohatamim" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-slate-300 hover:text-emerald-400 transition-colors font-medium hover:underline lowercase"
        >
          mohatamim
        </a>
      </div>
    </footer>
  );
};
