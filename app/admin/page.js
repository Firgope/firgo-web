'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const CATS = [
  { id: 'muebles', label: 'Muebles' },
  { id: 'ropa', label: 'Ropa vintage' },
  { id: 'libros', label: 'Libros' },
  { id: 'deco', label: 'Decoración' },
];

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('muebles');
  const [file, setFile] = useState(null);
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
      setStatus({ type: 'error', msg: 'Contraseña incorrecta' });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !price) {
      setStatus({ type: 'error', msg: 'Completa nombre y precio' });
      return;
    }
    setSaving(true);
    setStatus(null);

    let image_url = null;
    try {
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
        image_url = pub.publicUrl;
      }

      const { error: insertError } = await supabase.from('products').insert({
        name,
        price: Number(price),
        category,
        image_url,
      });
      if (insertError) throw insertError;

      setStatus({ type: 'ok', msg: 'Producto agregado' });
      setName('');
      setPrice('');
      setFile(null);
      loadProducts();
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    if (!confirm(`¿Borrar "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    if (p.image_url) {
      const path = p.image_url.split('/product-images/')[1];
      if (path) await supabase.storage.from('product-images').remove([path]);
    }
    loadProducts();
  }

  if (!unlocked) {
    return (
      <div className="admin-wrap">
        <div className="admin-card">
          <h1>Firgo — Admin</h1>
          <input
            type="password"
            placeholder="Contraseña"
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

          <label>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <label>Foto</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />

          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : '+ Publicar producto'}
          </button>

          {status && <p className={`status ${status.type}`}>{status.msg}</p>}
        </form>
      </div>

      <div className="admin-card">
        <h1>Catálogo actual ({products.length})</h1>
        {products.map((p) => (
          <div className="admin-list-item" key={p.id}>
            {p.image_url ? <img src={p.image_url} alt={p.name} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg)' }} />}
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="meta">{CATS.find((c) => c.id === p.category)?.label} · S/ {p.price}</div>
            </div>
            <button onClick={() => handleDelete(p)}>Borrar</button>
          </div>
        ))}
        {products.length === 0 && <p style={{ opacity: 0.5 }}>Todavía no hay productos.</p>}
      </div>
    </div>
  );
}
