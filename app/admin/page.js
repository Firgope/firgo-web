'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const CATS = [
  { id: 'muebles', label: 'Muebles' },
  { id: 'ropa', label: 'Ropa vintage' },
  { id: 'libros', label: 'Libros' },
  { id: 'deco', label: 'DecoraciÃ³n' },
];

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('muebles');
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null); // {type:'ok'|'error', msg}
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unlocked) loadProducts();
  }, [unlocked]);

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
  }

  function checkPassword() {
    if (passInput === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setUnlocked(true);
    } else {
      setStatus({ type: 'error', msg: 'ContraseÃ±a incorrecta' });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !price) {
      setStatus({ type: 'error', msg: 'Completa nombre y precio' });
      return;
    }
    if (files.length > 8) {
      setStatus({ type: 'error', msg: 'MÃ¡ximo 8 fotos por producto' });
      return;
    }
    setSaving(true);
    setStatus(null);

    let image_urls = [];
    try {
      for (const f of files) {
        const ext = f.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, f);
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
        image_urls.push(pub.publicUrl);
      }

      const { error: insertError } = await supabase.from('products').insert({
        name,
        price: Number(price),
        category,
        image_urls,
      });
      if (insertError) throw insertError;

      setStatus({ type: 'ok', msg: 'Producto agregado' });
      setName('');
      setPrice('');
      setFiles([]);
      loadProducts();
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    if (!confirm(`Â¿Borrar "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    const urls = p.image_urls || [];
    const paths = urls.map((u) => u.split('/product-images/')[1]).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from('product-images').remove(paths);
    loadProducts();
  }

  if (!unlocked) {
    return (
      <div className="admin-wrap">
        <div className="admin-card">
          <h1>Firgo â€” Admin</h1>
          <input
            type="password"
            placeholder="ContraseÃ±a"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkPassword()}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 12 }}
          />
          <button onClick={checkPassword} style={{ width: '100%', background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
            Entrar
          </button>
          {status && <p className={`status ${status.type}`}>{status.msg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div className="admin-card">
        <h1>Agregar producto</h1>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />

          <label>Precio (S/)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

          <label>CategorÃ­a</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <label>Fotos (1 a 8)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 8))}
          />
          {files.length > 0 && (
            <p style={{ fontSize: 12, opacity: 0.6, gridColumn: '1/-1', margin: '-4px 0 0' }}>
              {files.length} foto{files.length > 1 ? 's' : ''} seleccionada{files.length > 1 ? 's' : ''}
            </p>
          )}

          <button type="submit" disabled={saving}>
            {saving ? 'Guardandoâ€¦' : '+ Publicar producto'}
          </button>

          {status && <p className={`status ${status.type}`}>{status.msg}</p>}
        </form>
      </div>

      <div className="admin-card">
        <h1>CatÃ¡logo actual ({products.length})</h1>
        {products.map((p) => (
          <div className="admin-list-item" key={p.id}>
            {p.image_urls && p.image_urls[0] ? <img src={p.image_urls[0]} alt={p.name} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg)' }} />}
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="meta">
                {CATS.find((c) => c.id === p.category)?.label} Â· S/ {p.price}
                {p.image_urls && p.image_urls.length > 1 ? ` Â· ${p.image_urls.length} fotos` : ''}
              </div>
            </div>
            <button onClick={() => handleDelete(p)}>Borrar</button>
          </div>
        ))}
        {products.length === 0 && <p style={{ opacity: 0.5 }}>TodavÃ­a no hay productos.</p>}
      </div>
    </div>
  );
}
