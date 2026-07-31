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
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [selectedCats, setSelectedCats] = useState([]);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateLog, setMigrateLog] = useState('');
  const [saving, setSaving] = useState(false);

  const [newCatName, setNewCatName] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMedidas, setEditMedidas] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOriginalPrice, setEditOriginalPrice] = useState('');
  const [editDiscountPct, setEditDiscountPct] = useState('');
  const [editCats, setEditCats] = useState([]);
  const [editSold, setEditSold] = useState(false);
  const [editPhotos, setEditPhotos] = useState([]); // [{kind:'existing', url}] o [{kind:'new', file}]
  const [editRemovedUrls, setEditRemovedUrls] = useState([]);

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

  function pctFromPrices(original, promo) {
    const o = Number(original);
    const pr = Number(promo);
    if (!o || !pr) return '';
    return String(Math.round((1 - pr / o) * 100));
  }
  function promoFromPct(original, pct) {
    const o = Number(original);
    const pc = Number(pct);
    if (!o || (!pc && pc !== 0)) return '';
    return String(Math.round(o * (1 - pc / 100)));
  }

  function moveItem(list, setList, index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    const next = [...list];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setList(next);
  }

  async function toJpegIfNeeded(file) {
    const isJpg = /\.jpe?g$/i.test(file.name) || file.type === 'image/jpeg';
    if (isJpg) return file;

    // Intento 1: decodificacion nativa del navegador (funciona en Safari incluso para HEIC)
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob) throw new Error('canvas.toBlob devolvio vacio');
      const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], newName, { type: 'image/jpeg' });
    } catch (nativeErr) {
      // Intento 2: respaldo con heic2any, solo para HEIC/HEIF
      const isHeic = /\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
      if (!isHeic) throw nativeErr;
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      const newName = file.name.replace(/\.hei[cf]$/i, '.jpg');
      return new File([blob], newName, { type: 'image/jpeg' });
    }
  }

  function isNonJpgUrl(url) {
    return !/\.jpe?g(\?|$)/i.test(url);
  }

  async function migrateHeicPhotos() {
    setMigrating(true);
    setMigrateLog('Buscando fotos que no sean JPG...');
    let convertedCount = 0;
    let errorCount = 0;
    let firstErrorMsg = '';

    for (const p of products) {
      const urls = p.image_urls || [];
      if (!urls.some(isNonJpgUrl)) continue;

      const newUrls = [];
      for (const url of urls) {
        if (!isNonJpgUrl(url)) {
          newUrls.push(url);
          continue;
        }
        try {
          setMigrateLog('Convirtiendo foto de "' + p.name + '"...');
          const res = await fetch(url);
          if (!res.ok) throw new Error('fetch fallo con status ' + res.status);
          const blob = await res.blob();
          const guessedExt = (url.split('.').pop() || 'img').split('?')[0];
          const oldFile = new File([blob], 'old.' + guessedExt, { type: blob.type || 'application/octet-stream' });
          const jpgFile = await toJpegIfNeeded(oldFile);
          const path = Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
          const { error: uploadError } = await supabase.storage.from('product-images').upload(path, jpgFile);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          newUrls.push(pub.publicUrl);
          const oldPath = url.split('/product-images/')[1];
          if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
          convertedCount++;
        } catch (err) {
          newUrls.push(url);
          errorCount++;
          if (!firstErrorMsg) firstErrorMsg = (err && err.message) ? err.message : String(err);
          console.error('Error convirtiendo foto:', url, err);
        }
      }

      await supabase.from('products').update({ image_urls: newUrls }).eq('id', p.id);
    }

    setMigrateLog(
      convertedCount === 0 && errorCount === 0
        ? 'No se encontraron fotos pendientes de convertir. Todo en orden.'
        : convertedCount + ' foto(s) convertida(s).' + (errorCount > 0 ? ' ' + errorCount + ' con error. Detalle: ' + firstErrorMsg : '')
    );
    setMigrating(false);
    loadProducts();
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
      for (const rawFile of files) {
        const f = await toJpegIfNeeded(rawFile);
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
        original_price: selectedCats.includes('sale') && originalPrice ? Number(originalPrice) : null,
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
      setOriginalPrice('');
      setDiscountPct('');
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

  async function handleDuplicate(p) {
    setStatus(null);
    const { error } = await supabase.from('products').insert({
      name: p.name + ' (copia)',
      description: p.description || '',
      medidas: p.medidas || '',
      price: p.price,
      original_price: p.original_price || null,
      categories: p.categories || [],
      image_urls: p.image_urls || [],
      sold: false,
    });
    if (error) {
      setStatus({ type: 'error', msg: 'Error al duplicar: ' + error.message });
      return;
    }
    loadProducts();
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name || '');
    setEditDescription(p.description || '');
    setEditMedidas(p.medidas || '');
    setEditPrice(p.price != null ? String(p.price) : '');
    setEditOriginalPrice(p.original_price != null ? String(p.original_price) : '');
    setEditDiscountPct(p.original_price ? pctFromPrices(p.original_price, p.price) : '');
    setEditCats(p.categories || []);
    setEditSold(!!p.sold);
    setEditPhotos((p.image_urls || []).map((url) => ({ kind: 'existing', url })));
    setEditRemovedUrls([]);
  }
  function cancelEdit() {
    setEditingId(null);
  }
  async function saveEdit(id) {
    setStatus(null);
    try {
      const finalUrls = [];
      for (const item of editPhotos) {
        if (item.kind === 'existing') {
          finalUrls.push(item.url);
        } else {
          const f = await toJpegIfNeeded(item.file);
          const ext = f.name.split('.').pop();
          const path = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(path, f);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          finalUrls.push(pub.publicUrl);
        }
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: editName,
          description: editDescription,
          medidas: editMedidas,
          price: Number(editPrice),
          original_price: editCats.includes('sale') && editOriginalPrice ? Number(editOriginalPrice) : null,
          categories: editCats,
          sold: editSold,
          image_urls: finalUrls,
        })
        .eq('id', id);
      if (error) throw error;

      const pathsToRemove = editRemovedUrls.map((u) => u.split('/product-images/')[1]).filter(Boolean);
      if (pathsToRemove.length > 0) await supabase.storage.from('product-images').remove(pathsToRemove);

      setEditingId(null);
      loadProducts();
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    }
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
        <h1>Herramientas</h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
          {'Convierte a JPG las fotos que hayas subido antes en otro formato (HEIC, PNG, WEBP, etc), para que se vean bien en todos los navegadores.'}
        </p>
        <button
          type="button"
          onClick={migrateHeicPhotos}
          disabled={migrating}
          style={{ background: 'var(--fg)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          {migrating ? 'Convirtiendo...' : 'Convertir fotos que no sean JPG'}
        </button>
        {migrateLog && <p style={{ fontSize: 13, marginTop: 10 }}>{migrateLog}</p>}
      </div>

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

          {selectedCats.includes('sale') ? (
            <>
              <label>Precio anterior (S/)</label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => {
                  setOriginalPrice(e.target.value);
                  if (discountPct !== '') setPrice(promoFromPct(e.target.value, discountPct));
                }}
              />

              <label>{'% descuento (opcional, calcula el precio promo)'}</label>
              <input
                type="number"
                value={discountPct}
                onChange={(e) => {
                  setDiscountPct(e.target.value);
                  setPrice(promoFromPct(originalPrice, e.target.value));
                }}
                style={{ gridColumn: '1/-1' }}
              />

              <label>Precio promo (S/)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setDiscountPct(pctFromPrices(originalPrice, e.target.value));
                }}
              />
            </>
          ) : (
            <>
              <label>Precio (S/)</label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            </>
          )}

          <label>Fotos (1 a 8)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async (e) => {
              const selected = Array.from(e.target.files).slice(0, 8);
              setStatus({ type: 'ok', msg: 'Procesando fotos...' });
              const converted = await Promise.all(selected.map((f) => toJpegIfNeeded(f)));
              setFiles(converted);
              setStatus(null);
            }}
          />
          {files.length > 0 && (
            <div className="photo-preview-row" style={{ gridColumn: '1/-1' }}>
              {files.map((f, i) => (
                <div key={i} className="photo-preview-item">
                  <img src={URL.createObjectURL(f)} alt={f.name} />
                  <div className="photo-preview-controls">
                    <button type="button" disabled={i === 0} onClick={() => moveItem(files, setFiles, i, -1)}>{'<'}</button>
                    <span>{i + 1}</span>
                    <button type="button" disabled={i === files.length - 1} onClick={() => moveItem(files, setFiles, i, 1)}>{'>'}</button>
                  </div>
                </div>
              ))}
            </div>
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
              <button onClick={() => handleDuplicate(p)} className="duplicate-btn">Duplicar</button>
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

                {editCats.includes('sale') ? (
                  <>
                    <label>Precio anterior (S/)</label>
                    <input
                      type="number"
                      value={editOriginalPrice}
                      onChange={(e) => {
                        setEditOriginalPrice(e.target.value);
                        if (editDiscountPct !== '') setEditPrice(promoFromPct(e.target.value, editDiscountPct));
                      }}
                    />

                    <label>{'% descuento (opcional, calcula el precio promo)'}</label>
                    <input
                      type="number"
                      value={editDiscountPct}
                      onChange={(e) => {
                        setEditDiscountPct(e.target.value);
                        setEditPrice(promoFromPct(editOriginalPrice, e.target.value));
                      }}
                      style={{ gridColumn: '1/-1' }}
                    />

                    <label>Precio promo (S/)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => {
                        setEditPrice(e.target.value);
                        setEditDiscountPct(pctFromPrices(editOriginalPrice, e.target.value));
                      }}
                    />
                  </>
                ) : (
                  <>
                    <label>Precio (S/)</label>
                    <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                  </>
                )}

                <label className="cat-check" style={{ gridColumn: '1/-1' }}>
                  <input type="checkbox" checked={editSold} onChange={(e) => setEditSold(e.target.checked)} />
                  Marcar como VENDIDO
                </label>

                {editPhotos.length > 0 && (
                  <>
                    <label style={{ gridColumn: '1/-1' }}>Fotos (arrastra el orden con las flechas, la "x" borra)</label>
                    <div className="photo-preview-row" style={{ gridColumn: '1/-1' }}>
                      {editPhotos.map((item, i) => (
                        <div key={item.kind === 'existing' ? item.url : 'new-' + i} className="photo-preview-item">
                          <button
                            type="button"
                            className="photo-remove-btn"
                            onClick={() => {
                              if (item.kind === 'existing') setEditRemovedUrls([...editRemovedUrls, item.url]);
                              setEditPhotos(editPhotos.filter((_, idx) => idx !== i));
                            }}
                          >
                            {'\u2715'}
                          </button>
                          <img src={item.kind === 'existing' ? item.url : URL.createObjectURL(item.file)} alt={'foto ' + (i + 1)} />
                          <div className="photo-preview-controls">
                            <button type="button" disabled={i === 0} onClick={() => moveItem(editPhotos, setEditPhotos, i, -1)}>{'<'}</button>
                            <span>{i + 1}</span>
                            <button type="button" disabled={i === editPhotos.length - 1} onClick={() => moveItem(editPhotos, setEditPhotos, i, 1)}>{'>'}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {editPhotos.length < 8 && (
                  <>
                    <label style={{ gridColumn: '1/-1' }}>{'Agregar fotos (hasta ' + (8 - editPhotos.length) + ' mas)'}</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ gridColumn: '1/-1' }}
                      onChange={async (e) => {
                        const selected = Array.from(e.target.files).slice(0, 8 - editPhotos.length);
                        setStatus({ type: 'ok', msg: 'Procesando fotos...' });
                        const converted = await Promise.all(selected.map((f) => toJpegIfNeeded(f)));
                        setEditPhotos([...editPhotos, ...converted.map((file) => ({ kind: 'new', file }))]);
                        setStatus(null);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}

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
