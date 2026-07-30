'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [medidas, setMedidas] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCats, setSelectedCats] = useState([]);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newCatName, setNewCatName] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMedidas, setEditMedidas] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCats, setEditCats] = useState([]);
  const [editSold, setEditSold] = useState(false);

  useEffect(() => {
    if (unlocked) {
      loadProducts();
      loadCats();
    }
  }, [unlocked]);

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
  }

  async function loadCats() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) setCats(data);
  }

  function checkPassword() {
    if (passInput === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setUnlocked(true);
    } else {
      setStatus({ type: 'error', msg: 'Contrase\u00f1a incorrecta' });
    }
  }

  function toggleCat(id, list, setList) {
    if (list.includes(id)) setList(list.filter((c) => c !== id));
    else setList([...list, id]);
  }

  async function addCategory() {
    const label = newCatName.trim();
    if (!label) return;
    const id = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!id) return;
    const nextOrder = cats.length > 0 ? Math.max(...cats.map((c) => c.sort_order)) + 1 : 1;
    const { error } = await supabase.from('categories').insert({ id, label, color: 'default', sort_order: nextOrder });
    if (!error) {
      setNewCatName('');
      loadCats();
    } else {
      setStatus({ type: 'error', msg: 'Error creando categoria: ' + error.message });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !price) {
      setStatus({ type: 'error', msg: 'Completa nombre y precio' });
      return;
    }
    if (files.length > 8) {
      setStatus({ type: 'error', msg: 'M\u00e1ximo 8 fotos por producto' });
      return;
    }
    setSaving(true);
    setStatus(null);

    let image_urls = [];
    try {
      for (const f of files) {
        const ext = f.name.split('.').pop();
        const path = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, f);
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
        image_urls.push(pub.publicUrl);
      }

      const { error: insertError } = await supabase.from('products').insert({
        name,
        description,
        medidas,
        price: Number(price),
        categories: selectedCats,
        image_urls,
        sold: false,
      });
      if (insertError) throw insertError;

      setStatus({ type: 'ok', msg: 'Producto agregado' });
      setName('');
      setDescription('');
      setMedidas('');
      setPrice('');
      setSelectedCats([]);
      setFiles([]);
      loadProducts();
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    if (!confirm('\u00bfBorrar "' + p.name + '"?')) return;
    await supabase.from('products').delete().eq('id', p.id);
    const urls = p.image_urls || [];
    const paths = urls.map((u) => u.split('/product-images/')[1]).filter(Boolean);
    if (paths.length > 0) await supabase.storage.from('product-images').remove(paths);
    loadProducts();
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name || '');
    setEditDescription(p.description || '');
    setEditMedidas(p.medidas || '');
    setEditPrice(p.price != null ? String(p.price) : '');
    setEditCats(p.categories || []);
    setEditSold(!!p.sold);
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(id) {
    const { error } = await supabase
      .from('products')
      .update({
        name: editName,
        description: editDescription,
        medidas: editMedidas,
        price: Number(editPrice),
        categories: editCats,
        sold: editSold,
      })
      .eq('id', id);
    if (error) {
      setStatus({ type: 'error', msg: 'Error: ' + error.message });
      return;
    }
    setEditingId(null);
    loadProducts();
  }

  if (!unlocked) {
    return (
      <div className="admin-wrap">
        <div className="admin-card">
          <h1>Firgo - Admin</h1>
          <input
            type="password"
            placeholder="Contrase&#241;a"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkPassword()}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 12 }}
          />
          <button onClick={checkPassword} style={{ width: '100%', background: 'var(--fg)', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontWeight: 700, cursor: 'pointer' }}>
            Entrar
          </button>
          {status && <p className={'status ' + status.type}>{status.msg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div className="admin-card">
        <h1>Categorias</h1>
        <div className="cat-checks">
          {cats.map((c) => (
            <span key={c.id} className="cat-chip">{c.label}</span>
          ))}
        </div>
        <div className="new-cat-row">
          <input
            placeholder="Nueva categoria (ej: Navidad)"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button onClick={addCategory}>+ Crear</button>
        </div>
      </div>

      <div className="admin-card">
        <h1>Agregar producto</h1>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />

          <label>Descripcion</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ gridColumn: '1/-1', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 14 }}
          />

          <label>Medidas</label>
          <input value={medidas} onChange={(e) => setMedidas(e.target.value)} placeholder="Ej: 60 x 40 x 90 cm" style={{ gridColumn: '1/-1' }} />

          <label>Precio (S/)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />

          <label>Categorias (puedes elegir varias)</label>
          <div className="cat-checks" style={{ gridColumn: '1/-1' }}>
            {cats.map((c) => (
              <label key={c.id} className={'cat-check ' + (selectedCats.includes(c.id) ? 'checked' : '')}>
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c.id)}
                  onChange={() => toggleCat(c.id, selectedCats, setSelectedCats)}
                />
                {c.label}
              </label>
            ))}
          </div>

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
            {saving ? 'Guardando...' : '+ Publicar producto'}
          </button>

          {status && <p className={'status ' + status.type}>{status.msg}</p>}
        </form>
      </div>

      <div className="admin-card">
        <h1>Catalogo actual ({products.length})</h1>
        {products.map((p) => (
          <div key={p.id} className="admin-list-item-wrap">
            <div className="admin-list-item">
              {p.image_urls && p.image_urls[0] ? <img src={p.image_urls[0]} alt={p.name} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--pill-bg)' }} />}
              <div className="info">
                <div className="name">{p.name} {p.sold && <span className="sold-tag">VENDIDO</span>}</div>
                <div className="meta">
                  S/ {p.price}
                  {p.categories && p.categories.length > 0 ? ' \u00b7 ' + p.categories.map((cid) => cats.find((c) => c.id === cid)?.label || cid).join(', ') : ''}
                  {p.image_urls && p.image_urls.length > 1 ? ' \u00b7 ' + p.image_urls.length + ' fotos' : ''}
                </div>
              </div>
              <button onClick={() => startEdit(p)} className="edit-btn">Editar</button>
              <button onClick={() => handleDelete(p)}>Borrar</button>
            </div>

            {editingId === p.id && (
              <div className="edit-panel">
                <label>Nombre</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />

                <label>Descripcion</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  style={{ gridColumn: '1/-1', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 14 }}
                />

                <label>Medidas</label>
                <input value={editMedidas} onChange={(e) => setEditMedidas(e.target.value)} style={{ gridColumn: '1/-1' }} />

                <label>Precio (S/)</label>
                <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />

                <label>Categorias</label>
                <div className="cat-checks" style={{ gridColumn: '1/-1' }}>
                  {cats.map((c) => (
                    <label key={c.id} className={'cat-check ' + (editCats.includes(c.id) ? 'checked' : '')}>
                      <input
                        type="checkbox"
                        checked={editCats.includes(c.id)}
                        onChange={() => toggleCat(c.id, editCats, setEditCats)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>

                <label className="cat-check" style={{ gridColumn: '1/-1' }}>
                  <input type="checkbox" checked={editSold} onChange={(e) => setEditSold(e.target.checked)} />
                  Marcar como VENDIDO
                </label>

                <button type="button" onClick={() => saveEdit(p.id)}>Guardar cambios</button>
                <button type="button" onClick={cancelEdit} className="cancel-btn">Cancelar</button>
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && <p style={{ opacity: 0.5 }}>Todavia no hay productos.</p>}
      </div>
    </div>
  );
}
