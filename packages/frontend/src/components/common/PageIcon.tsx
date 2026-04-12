import React from 'react';

export const PageIcon: React.FC<{ src: string; alt?: string }> = ({ src, alt = '' }) => (
  <img
    src={src}
    alt={alt}
    className="object-contain shrink-0"
    style={{ width: 160, height: 160 }}
  />
);
