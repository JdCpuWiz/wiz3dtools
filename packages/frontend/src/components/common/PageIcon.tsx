import React from 'react';

export const PageIcon: React.FC<{ src: string; alt?: string }> = ({ src, alt = '' }) => (
  <img
    src={src}
    alt={alt}
    className="object-contain mix-blend-screen shrink-0"
    style={{ width: 80, height: 80 }}
  />
);
