// CustomScrollbar.jsx
import React from 'react';

export const CustomScrollbar = () => {
  return (
    <style>{`
      :root {
        --ion: #2dd4ff;
        --plasma: #9f5bff;
      }

      /* WebKit Browsers (Chrome, Safari, Edge) */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, var(--ion), var(--plasma));
        border-radius: 9999px;
      }

      ::-webkit-scrollbar-thumb:hover {
        opacity: 0.8;
      }

      /* Targeted Override for History List */
      .history-list::-webkit-scrollbar-thumb {
        background: #334155;
      }

      /* Firefox Fallback */
      * {
        scrollbar-width: thin;
        scrollbar-color: var(--plasma) transparent;
      }
    `}</style>
  );
};

export default CustomScrollbar;