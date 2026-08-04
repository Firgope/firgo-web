'use client';

import { useState } from 'react';

export default function ProductGallery({ images, alt }) {
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        {images.length > 1 && (
          <button type="button" className="product-gallery-nav product-gallery-prev" onClick={prev} aria-label="Foto anterior">
            {'<'}
          </button>
        )}
        <img src={images[index]} alt={alt} className="product-gallery-img" />
        {images.length > 1 && (
          <button type="button" className="product-gallery-nav product-gallery-next" onClick={next} aria-label="Foto siguiente">
            {'>'}
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbs">
          {images.map((url, i) => (
            <button
              type="button"
              key={url + '-' + i}
              className={'product-gallery-thumb' + (i === index ? ' active' : '')}
              onClick={() => setIndex(i)}
              aria-label={'Ver foto ' + (i + 1)}
            >
              <img src={url} alt={alt + ' miniatura ' + (i + 1)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
