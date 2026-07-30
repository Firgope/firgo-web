'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const CATS = [
  { id: 'all', label: 'Todo' },
  { id: 'muebles', label: 'Muebles' },
  { id: 'ropa', label: 'Ropa vintage' },
  { id: 'libros', label: 'Libros' },
  { id: 'deco', label: 'DecoraciÃ³n' },
];

const WHATSAPP_NUMBER = '51994859150';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [cart, setCart] = useState({}); // id -> true
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadProducts();
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

  function addToCart(id) {
    if (cart[id]) return; // pieza Ãºnica, mÃ¡x 1
    setCart({ ...cart, [id]: true });
  }
  function removeFromCart(id) {
    const next = { ...cart };
    delete next[id];
    setCart(next);
  }

  const list = activeCat === 'all' ? products : products.filter((p) => p.category === activeCat);
  const cartEntries = products.filter((p) => cart[p.id]);
  const total = cartEntries.reduce((sum, p) => sum + Number(p.price), 0);
  const cartCount = cartEntries.length;

  function sendWhatsApp() {
    if (cartEntries.length === 0) return;
    const lines = ['Hola! Me interesa:', ''];
    cartEntries.forEach((p) => {
      lines.push(`â€¢ ${p.name} â€” S/ ${p.price}`);
      (p.image_urls || []).forEach((url) => lines.push(url));
    });
    lines.push('', `Total: S/ ${total}`);
    const msg = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  }

  return (
    <div className="wrap">
      <header>
        <h1 className="logo">FIRGO</h1>
        <p className="tagline">muebles Â· ropa vintage Â· libros Â· decoraciÃ³n</p>

        <div className="cats">
          {CATS.map((c) => (
            <button
              key={c.id}
              className={`cat-btn ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => setActiveCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && <p style={{ opacity: 0.5 }}>Cargando catÃ¡logoâ€¦</p>}

        {!loading && (
          <div className="grid">
            {list.map((p) => (
              <div className="card" key={p.id}>
                <div className="thumb">
                  {p.image_urls && p.image_urls[0] ? <img src={p.image_urls[0]} alt={p.name} /> : 'ðŸŽ'}
                  {p.image_urls && p.image_urls.length > 1 && (
                    <span className="photo-badge">+{p.image_urls.length - 1}</span>
                  )}
                </div>
                <div className="card-body">
                  <div className="card-cat">{CATS.find((c) => c.id === p.category)?.label || p.category}</div>
                  <div className="card-name">{p.name}</div>
                  <div className="card-price">S/ {p.price}</div>
                  <button
                    className="add-btn"
                    disabled={!!cart[p.id]}
                    onClick={() => addToCart(p.id)}
                  >
                    {cart[p.id] ? 'Agregado âœ“' : 'Agregar'}
                  </button>
                </div>
              </div>
            ))}
            {list.length === 0 && <p style={{ opacity: 0.5 }}>No hay productos en esta categorÃ­a todavÃ­a.</p>}
          </div>
        )}
      </header>

      <button className="cart-fab" onClick={() => setDrawerOpen(true)}>
        ðŸ›’ Ver carrito <span className="cart-badge">{cartCount}</span>
      </button>

      <div className={`overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <button className="close-drawer" onClick={() => setDrawerOpen(false)}>âœ•</button>
        <h2>Tu selecciÃ³n</h2>
        <div className="cart-items">
          {cartEntries.length === 0 && <p className="empty-cart">Tu carrito estÃ¡ vacÃ­o</p>}
          {cartEntries.map((p) => (
            <div className="cart-item" key={p.id}>
              <div>
                <div className="cart-item-name">{p.name}</div>
                <div>S/ {p.price}</div>
              </div>
              <button className="quitar-btn" onClick={() => removeFromCart(p.id)}>Quitar</button>
            </div>
          ))}
        </div>
        {cartEntries.length > 0 && (
          <div>
            <div className="cart-total">Total: S/ {total}</div>
            <button className="whatsapp-btn" onClick={sendWhatsApp}>Contactar por WhatsApp</button>
            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 10, textAlign: 'center' }}>
              Â¿No te abre? EscrÃ­benos directo al 994 859 150
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
