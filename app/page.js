'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../lib/supabaseClient';

const WHATSAPP_NUMBER = '51994859150';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [cart, setCart] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [galleryProduct, setGalleryProduct] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCats();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
    setLoading(false);
  }

  async function loadCats() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) setCats(data);
  }

  function addToCart(id) {
    if (cart[id]) return;
    setCart({ ...cart, [id]: true });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1800);
  }
  function removeFromCart(id) {
    const next = { ...cart };
    delete next[id];
    setCart(next);
  }

  function openGallery(p) {
    if (!p.image_urls || p.image_urls.length === 0) return;
    setGalleryProduct(p);
    setGalleryIndex(0);
    setZoomed(false);
  }
  function closeGallery() {
    setGalleryProduct(null);
    setZoomed(false);
  }
  function nextImage() {
    if (!galleryProduct) return;
    setZoomed(false);
    setGalleryIndex((i) => (i + 1) % galleryProduct.image_urls.length);
  }
  function prevImage() {
    if (!galleryProduct) return;
    setZoomed(false);
    setGalleryIndex((i) => (i - 1 + galleryProduct.image_urls.length) % galleryProduct.image_urls.length);
  }
  function handleZoomMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }

  function formatText(text) {
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      if (match[2] !== undefined) parts.push(<strong key={key++}>{match[2]}</strong>);
      else if (match[3] !== undefined) parts.push(<em key={key++}>{match[3]}</em>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  }

  function plainName(text) {
    return text.replace(/\*\*/g, '').replace(/\*/g, '');
  }

  function discountInfo(p) {
    const hasDiscount = (p.categories || []).includes('sale') && p.original_price && Number(p.original_price) > Number(p.price);
    if (!hasDiscount) return null;
    const pct = Math.round((1 - Number(p.price) / Number(p.original_price)) * 100);
    return pct;
  }

  const searchLower = search.trim().toLowerCase();
  let list = products.filter((p) => {
    const matchesCat = activeCat === 'all' || (p.categories || []).includes(activeCat);
    if (!matchesCat) return false;
    if (!searchLower) return true;
    const haystack = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
    return haystack.includes(searchLower);
  });
  if (sortBy === 'price_asc') list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
  else if (sortBy === 'price_desc') list = [...list].sort((a, b) => Number(b.price) - Number(a.price));

  const cartEntries = products.filter((p) => cart[p.id]);
  const total = cartEntries.reduce((sum, p) => sum + Number(p.price), 0);
  const cartCount = cartEntries.length;

  function shareProduct(p) {
    const plain = plainName(p.name);
    const lines = ['Hola! Mira este producto de Firgo:', '', '- ' + plain + ' - S/ ' + p.price];
    if (p.image_urls && p.image_urls[0]) lines.push(p.image_urls[0]);
    const msg = encodeURIComponent(lines.join('\n'));
    window.open('https://wa.me/?text=' + msg, '_blank');
  }

  function sendWhatsApp() {
    if (cartEntries.length === 0) return;
    const lines = ['Hola! Me interesa:', ''];
    cartEntries.forEach((p) => {
      const plainName = p.name.replace(/\*\*/g, '').replace(/\*/g, '');
      lines.push('- ' + plainName + ' - S/ ' + p.price);
      (p.image_urls || []).forEach((url) => lines.push(url));
    });
    lines.push('', 'Total: S/ ' + total);
    const msg = encodeURIComponent(lines.join('\n'));
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + msg, '_blank');
  }

  return (
    <div className="wrap">
      <header>
        <div className="logo-band">
          <h1 className="logo">FIRGO</h1>
          <p className="tagline">{'Cosas ch\u00e9veres para casas ch\u00e9veres :)'}</p>
          <div className="contact-strip">
            <a href="https://instagram.com/firgo_pe" target="_blank" rel="noreferrer" className="contact-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" stroke="none" />
              </svg>
              firgo_pe
            </a>
            <a href="https://wa.me/51994859150" target="_blank" rel="noreferrer" className="contact-item">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 5L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2zm0 18.06h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.19-.31a8.2 8.2 0 0 1-1.26-4.29c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.17 8.17 0 0 1 2.41 5.82c0 4.55-3.7 8.15-8.26 8.15zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29z" />
              </svg>
              994 859 150
            </a>
          </div>
        </div>

        <div className="body-content">
          <input
            className="search-input"
            type="text"
            placeholder="Buscar... ej: cuadro, plato, mesa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="sort-row">
            <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">{'Mas reciente'}</option>
              <option value="price_asc">{'Precio: menor a mayor'}</option>
              <option value="price_desc">{'Precio: mayor a menor'}</option>
            </select>
          </div>

          <div className="cats">
            <button
              className={'cat-btn ' + (activeCat === 'all' ? 'active' : '')}
              onClick={() => setActiveCat('all')}
            >
              Todo
            </button>
            {cats.map((c) => (
              <button
                key={c.id}
                className={'cat-btn ' + (c.color === 'pink' ? 'sale' : '') + ' ' + (activeCat === c.id ? 'active' : '')}
                onClick={() => setActiveCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading && <p style={{ opacity: 0.5 }}>{'Cargando cat\u00e1logo...'}</p>}

          {!loading && (
            <div className="grid">
              {list.map((p) => (
                <div className="card" key={p.id}>
                  <div
                    className="thumb"
                    onClick={() => openGallery(p)}
                    style={{ cursor: p.image_urls && p.image_urls.length > 0 ? 'pointer' : 'default' }}
                  >
                    {p.image_urls && p.image_urls[0] ? (
                      <Image
                        src={p.image_urls[0]}
                        alt={p.name}
                        fill
                        sizes="(max-width: 600px) 50vw, 220px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <span>{'[sin foto]'}</span>
                    )}
                    {p.image_urls && p.image_urls.length > 1 && (
                      <span className="photo-badge">{'+' + (p.image_urls.length - 1)}</span>
                    )}
                    {p.sold && <span className="sold-stamp">VENDIDO</span>}
                    {discountInfo(p) !== null && <span className="sale-stamp">{discountInfo(p) + '% OFF'}</span>}
                  </div>
                  <div className="card-body">
                    <div className="card-name" title={plainName(p.name)}>{formatText(p.name)}</div>
                    <div className="card-desc" title={p.description ? plainName(p.description) : undefined}>{p.description ? formatText(p.description) : ''}</div>
                    <div className="card-price">
                      {discountInfo(p) !== null && <span className="old-price">{'S/ ' + p.original_price}</span>}
                      {'S/ ' + p.price}
                    </div>
                    <div className="card-medidas">{p.medidas || ''}</div>
                    <div className="card-actions">
                      {p.sold ? (
                        <button className="add-btn sold" disabled>{'VENDIDO'}</button>
                      ) : (
                        <button
                          className="add-btn"
                          disabled={!!cart[p.id]}
                          onClick={() => addToCart(p.id)}
                        >
                          {cart[p.id] ? 'Agregado' : 'Lo quiero'}
                        </button>
                      )}
                      <button className="share-btn" onClick={() => shareProduct(p)} aria-label="Compartir">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
                          <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {list.length === 0 && <p style={{ opacity: 0.5 }}>{'No hay productos que coincidan.'}</p>}
            </div>
          )}
        </div>
      </header>

      <button className="cart-fab" onClick={() => setDrawerOpen(true)}>
        {'Ver carrito'} <span className="cart-badge">{cartCount}</span>
      </button>

      <div className={'toast' + (showToast ? ' show' : '')}>{'Agregado al carrito'}</div>

      <div className={'overlay ' + (drawerOpen ? 'open' : '')} onClick={() => setDrawerOpen(false)} />
      <div className={'drawer ' + (drawerOpen ? 'open' : '')}>
        <button className="close-drawer" onClick={() => setDrawerOpen(false)}>{'x'}</button>
        <h2>{'Tu selecci\u00f3n'}</h2>
        <div className="cart-items">
          {cartEntries.length === 0 && <p className="empty-cart">{'Tu carrito est\u00e1 vac\u00edo'}</p>}
          {cartEntries.map((p) => (
            <div className="cart-item" key={p.id}>
              <div>
                <div className="cart-item-name">{formatText(p.name)}</div>
                <div>{'S/ ' + p.price}</div>
              </div>
              <button className="quitar-btn" onClick={() => removeFromCart(p.id)}>{'Quitar'}</button>
            </div>
          ))}
        </div>
        {cartEntries.length > 0 && (
          <div>
            <div className="cart-total">{'Total: S/ ' + total}</div>
            <button className="whatsapp-btn" onClick={sendWhatsApp}>{'Contactar por WhatsApp'}</button>
            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 10, textAlign: 'center' }}>
              {'\u00bfNo te abre? Escr\u00edbenos directo al 994 859 150'}
            </p>
          </div>
        )}
      </div>

      {galleryProduct && (
        <div className="gallery-overlay" onClick={closeGallery}>
          <button className="gallery-close" onClick={closeGallery}>{'x'}</button>
          <div className="gallery-content" onClick={(e) => e.stopPropagation()}>
            {galleryProduct.image_urls.length > 1 && (
              <button className="gallery-nav gallery-prev" onClick={prevImage}>{'<'}</button>
            )}
            <div
              className="gallery-image-wrap"
              onMouseEnter={() => setZoomed(true)}
              onMouseLeave={() => setZoomed(false)}
              onMouseMove={handleZoomMove}
            >
              <img
                src={galleryProduct.image_urls[galleryIndex]}
                alt={galleryProduct.name}
                className={'gallery-image' + (zoomed ? ' zoomed' : '')}
                style={zoomed ? { transformOrigin: zoomPos.x + '% ' + zoomPos.y + '%' } : undefined}
              />
            </div>
            {galleryProduct.image_urls.length > 1 && (
              <button className="gallery-nav gallery-next" onClick={nextImage}>{'>'}</button>
            )}
          </div>
          <div className="gallery-caption" onClick={(e) => e.stopPropagation()}>
            {formatText(galleryProduct.name)}
          </div>
        </div>
      )}
    </div>
  );
}
