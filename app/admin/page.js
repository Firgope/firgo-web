'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { thumbUrl, storagePath } from '../../lib/photos';

// Plan gratis de Supabase: 1 GB para fotos.
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

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
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCatFilter, setAdminCatFilter] = useState('all');
  const [storageSizes, setStorageSizes] = useState(null); // { 'ruta/en/bucket.jpg': bytes }
  const [saving, setSaving] = useState(false);

  const [newCatName, setNewCatName] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMedidas, setEditMedidas] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOriginalPrice, setEditOriginalPrice] = useState('');
  const [editDiscountPct, setEditDiscountPct] = useState('');
  const [editCats, setEditCats] = useState([]);
  const [editSold, setEditSold] = useState(false);
  const [editPhotos, setEditPhotos] = useState([]); // [{kind:'existing', url}] o [{kind:'new', file}]

  // Las miniaturas de vista previa (URL.createObjectURL) se generan UNA sola
  // vez por cada cambio real en la lista de archivos, no en cada render del
  // componente (antes se regeneraban con cada tecla escrita en cualquier
  // campo del formulario, lo cual es lento y deja URLs sin liberar en
  // memoria). Se liberan automaticamente cuando la lista cambia o se
  // desmonta el componente.
  const filePreviewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => filePreviewUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [filePreviewUrls]);

  const editPhotoPreviewUrls = useMemo(
    () => editPhotos.map((item) => (item.kind === 'existing' ? thumbUrl(item.url) : URL.createObjectURL(item.file))),
    [editPhotos]
  );
  useEffect(() => {
    return () => {
      editPhotos.forEach((item, i) => {
        if (item.kind !== 'existing') URL.revokeObjectURL(editPhotoPreviewUrls[i]);
      });
    };
  }, [editPhotoPreviewUrls]);
  const [editRemovedUrls, setEditRemovedUrls] = useState([]);

  useEffect(() => {
    if (unlocked) {
      loadProducts();
      loadCats();
      loadStorage();
    }
  }, [unlocked]);

  // Suma el peso de todos los archivos del bucket (recorriendo carpetas) para
  // mostrar cuanto queda del 1 GB gratis.
  async function loadStorage() {
    try {
      const sizes = {};
      const folders = [''];
      while (folders.length > 0) {
        const prefix = folders.pop();
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.storage.from('product-images').list(prefix, { limit: 1000, offset });
          if (error) throw error;
          data.forEach((item) => {
            const path = prefix ? prefix + '/' + item.name : item.name;
            if (item.id === null) folders.push(path);
            else sizes[path] = (item.metadata && item.metadata.size) || 0;
          });
          if (data.length < 1000) break;
        }
      }
      setStorageSizes(sizes);
    } catch (err) {
      console.error('No se pudo calcular el espacio usado:', err);
    }
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
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

  // El orden manual de productos (drag y shuffle) solo se puede editar sobre
  // la lista completa, sin filtro de categoria ni busqueda activos: si se
  // arrastrara sobre una lista filtrada, no habria forma confiable de saber
  // donde insertar el producto respecto a los que estan ocultos por el filtro.
  const reorderEnabled = adminCatFilter === 'all' && adminSearch.trim() === '';

  async function persistOrder(newList) {
    setProducts(newList);
    await Promise.all(
      newList.map((p, i) => supabase.from('products').update({ sort_order: i + 1 }).eq('id', p.id))
    );
  }

  function handleDragStart(id) {
    if (!reorderEnabled) return;
    setDraggedId(id);
  }
  function handleDragOver(e) {
    if (!reorderEnabled) return;
    e.preventDefault();
  }
  async function handleDrop(targetId) {
    if (!reorderEnabled || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const current = [...products];
    const fromIndex = current.findIndex((p) => p.id === draggedId);
    const toIndex = current.findIndex((p) => p.id === targetId);
    setDraggedId(null);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    await persistOrder(current);
  }

  async function shuffleProducts() {
    if (products.length < 2) return;
    if (!confirm('\u00bfPoner los productos en orden aleatorio? Esto reemplaza el orden manual actual.')) return;
    const shuffled = [...products];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    await persistOrder(shuffled);
  }

  async function restoreOrderByDate() {
    if (products.length < 2) return;
    if (!confirm('\u00bfRestaurar el orden por fecha de agregado (mas reciente primero)? Esto reemplaza el orden manual actual.')) return;
    const sorted = [...products].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    await persistOrder(sorted);
  }

  function nextTopSortOrder() {
    if (products.length === 0) return 1;
    const min = Math.min(...products.map((p) => (p.sort_order == null ? 1 : p.sort_order)));
    return min - 1;
  }

  // maxDim/quality por defecto = foto grande (1600px, calidad 90). La
  // miniatura del catalogo se pide con 800px y calidad 85 (ver uploadPhoto).
  async function encodeBitmap(bitmap, maxDim = 1600, quality = 0.9) {
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    // JPEG en vez de WebP: Safari no respeta de forma confiable el
    // parametro de calidad al codificar WebP (guarda casi sin comprimir
    // aunque se le pida 80%), asi que las fotos seguian pesando varios MB.
    // JPEG si respeta la calidad en todos los navegadores, y para fotos de
    // producto sin transparencia no hay perdida visual relevante.
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('canvas.toBlob devolvio vacio');
    return { blob, ext: 'jpg', type: 'image/jpeg' };
  }

  async function toJpegIfNeeded(file) {
    // Intento 1: decodificacion nativa del navegador (funciona en Safari incluso para HEIC)
    try {
      const bitmap = await createImageBitmap(file);
      const { blob, ext, type } = await encodeBitmap(bitmap);
      const newName = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
      return new File([blob], newName, { type });
    } catch (nativeErr) {
      // Intento 2: respaldo con heic2any, solo para HEIC/HEIF
      const isHeic = /\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
      if (!isHeic) throw nativeErr;
      const heic2any = (await import('heic2any')).default;
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
      const bitmap = await createImageBitmap(jpegBlob);
      const { blob, ext, type } = await encodeBitmap(bitmap);
      const newName = file.name.replace(/\.hei[cf]$/i, '.' + ext);
      return new File([blob], newName, { type });
    }
  }

  async function runWithConcurrency(items, limit, worker) {
    let idx = 0;
    async function runner() {
      while (idx < items.length) {
        const i = idx++;
        await worker(items[i], i);
      }
    }
    const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
    await Promise.all(runners);
  }

  // Sube una foto ya convertida a JPEG (ver toJpegIfNeeded) en sus dos
  // versiones: la grande y la miniatura del catalogo (ver lib/photos.js).
  // Cada foto lleva un nombre unico, asi el navegador puede guardarla en
  // cache por un ano sin riesgo de mostrar una version vieja.
  async function uploadPhoto(file) {
    const base = 'v2/' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const opts = { contentType: 'image/jpeg', cacheControl: '31536000' };
    const { error: mainError } = await supabase.storage.from('product-images').upload(base + '.jpg', file, opts);
    if (mainError) throw mainError;
    // Si la miniatura falla no se pierde la foto: el catalogo usa la grande.
    try {
      const bitmap = await createImageBitmap(file);
      const { blob } = await encodeBitmap(bitmap, 800, 0.85);
      const { error: thumbError } = await supabase.storage.from('product-images').upload(base + '_thumb.jpg', blob, opts);
      if (thumbError) throw thumbError;
    } catch (err) {
      console.error('No se pudo crear la miniatura:', err);
    }
    const { data: pub } = supabase.storage.from('product-images').getPublicUrl(base + '.jpg');
    return pub.publicUrl;
  }

  // Sube varias fotos, de a 3 a la vez, respetando el orden. Si alguna
  // falla, se borran las que ya habian subido y se avisa el error: asi no
  // quedan archivos sueltos ocupando espacio.
  async function uploadPhotos(fileList) {
    const urls = new Array(fileList.length);
    let failure = null;
    await runWithConcurrency(fileList, 3, async (f, i) => {
      if (failure) return;
      try {
        urls[i] = await uploadPhoto(f);
      } catch (err) {
        if (!failure) failure = err;
      }
    });
    if (failure) {
      await removePhotos(urls.filter(Boolean));
      throw failure;
    }
    return urls;
  }

  async function removePhotos(urls) {
    const paths = [];
    urls.forEach((u) => {
      const path = storagePath(u);
      if (!path) return;
      paths.push(path);
      const thumbPath = storagePath(thumbUrl(u));
      if (thumbPath && thumbPath !== path) paths.push(thumbPath);
    });
    if (paths.length > 0) await supabase.storage.from('product-images').remove(paths);
  }

  // Borra del storage solo las fotos que ya no usa NINGUN producto. Un
  // producto duplicado comparte los mismos archivos que el original: antes,
  // borrar la copia borraba tambien las fotos del original. Se relee la base
  // justo antes, por si se edito algo desde otro dispositivo.
  async function removeUnusedPhotos(urls) {
    if (!urls || urls.length === 0) return;
    const { data, error } = await supabase.from('products').select('image_urls');
    if (error) return; // ante la duda, no se borra nada
    const inUse = new Set();
    (data || []).forEach((p) => (p.image_urls || []).forEach((u) => inUse.add(u)));
    await removePhotos(urls.filter((u) => !inUse.has(u)));
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
      image_urls = await uploadPhotos(files);

      const { error: insertError } = await supabase.from('products').insert({
        name,
        description,
        medidas,
        price: Number(price),
        original_price: selectedCats.includes('sale') && originalPrice ? Number(originalPrice) : null,
        categories: selectedCats,
        image_urls,
        sold: false,
        sort_order: nextTopSortOrder(),
      });
      if (insertError) {
        // El producto no se creo: las fotos recien subidas no las usa nadie.
        await removePhotos(image_urls);
        throw insertError;
      }

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
      loadStorage();
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    if (!confirm('\u00bfBorrar "' + p.name + '"?')) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) {
      setStatus({ type: 'error', msg: 'Error al borrar: ' + error.message });
      return;
    }
    await removeUnusedPhotos(p.image_urls || []);
    loadProducts();
    loadStorage();
  }

  async function toggleSold(p) {
    setStatus(null);
    const { error } = await supabase.from('products').update({ sold: !p.sold }).eq('id', p.id);
    if (error) {
      setStatus({ type: 'error', msg: 'Error: ' + error.message });
      return;
    }
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
      sort_order: nextTopSortOrder(),
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
      const newUrls = await uploadPhotos(editPhotos.filter((item) => item.kind !== 'existing').map((item) => item.file));
      let nextNew = 0;
      const finalUrls = editPhotos.map((item) => (item.kind === 'existing' ? item.url : newUrls[nextNew++]));

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
      if (error) {
        await removePhotos(newUrls);
        throw error;
      }

      await removeUnusedPhotos(editRemovedUrls);

      setEditingId(null);
      loadProducts();
      loadStorage();
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    }
  }

  function formatMB(bytes) {
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  }

  const storageUsed = storageSizes ? Object.values(storageSizes).reduce((a, b) => a + b, 0) : 0;
  const storagePct = Math.round((storageUsed / STORAGE_LIMIT_BYTES) * 100);
  const storageColor = storagePct >= 90 ? '#e33' : storagePct >= 80 ? '#e08a00' : '#25D366';

  // Sugerencias de que borrar: productos vendidos, los mas antiguos primero,
  // con cuanto espacio liberaria cada uno. No se cuentan las fotos que
  // comparte con un producto disponible (por ejemplo, un duplicado), porque
  // esas no se borrarian.
  const deleteSuggestions = useMemo(() => {
    if (!storageSizes) return [];
    const usedByAvailable = new Set();
    products.forEach((p) => { if (!p.sold) (p.image_urls || []).forEach((u) => usedByAvailable.add(u)); });
    const sizeOf = (u) => {
      const path = storagePath(u);
      const thumbPath = storagePath(thumbUrl(u));
      return (storageSizes[path] || 0) + (thumbPath !== path ? storageSizes[thumbPath] || 0 : 0);
    };
    return products
      .filter((p) => p.sold)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((p) => ({ p, bytes: (p.image_urls || []).filter((u) => !usedByAvailable.has(u)).reduce((s, u) => s + sizeOf(u), 0) }))
      .filter((x) => x.bytes > 0)
      .slice(0, 5);
  }, [products, storageSizes]);

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
        <h1>Espacio de fotos</h1>
        {storageSizes === null ? (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Calculando...</p>
        ) : (
          <>
            <div style={{ background: '#eee', borderRadius: 999, height: 12, overflow: 'hidden' }}>
              <div style={{ width: Math.min(storagePct, 100) + '%', background: storageColor, height: '100%' }} />
            </div>
            <p style={{ fontSize: 13, marginTop: 8 }}>
              {formatMB(storageUsed) + ' de 1 GB usados (' + storagePct + '%)'}
            </p>
            {storagePct >= 80 ? (
              <>
                <p style={{ fontSize: 13, color: storageColor, fontWeight: 700, marginTop: 10 }}>
                  {storagePct >= 90
                    ? 'Casi lleno: si se llena, la web puede dejar de mostrar las fotos. Borra productos vendidos.'
                    : 'Se está llenando. Conviene borrar productos vendidos antiguos:'}
                </p>
                {deleteSuggestions.map(({ p, bytes }) => (
                  <div key={p.id} className="admin-list-item">
                    <div className="info">
                      <div className="name">{p.name.replace(/\*/g, '')}</div>
                      <div className="meta">
                        {'Vendido · subido el ' + new Date(p.created_at).toLocaleDateString('es-PE') + ' · libera ' + formatMB(bytes)}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(p)}>Borrar</button>
                  </div>
                ))}
                {deleteSuggestions.length === 0 && (
                  <p style={{ fontSize: 12, opacity: 0.6 }}>{'No hay productos vendidos para borrar.'}</p>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12, opacity: 0.6 }}>
                {'Hay espacio de sobra. Cuando pase del 80%, aquí aparecerán los productos vendidos que conviene borrar.'}
              </p>
            )}
          </>
        )}
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
              const results = await Promise.allSettled(selected.map((f) => toJpegIfNeeded(f)));
              const okFiles = [];
              const failedNames = [];
              results.forEach((r, i) => {
                if (r.status === 'fulfilled') okFiles.push(r.value);
                else failedNames.push(selected[i].name);
              });
              setFiles(okFiles);
              if (failedNames.length > 0) {
                setStatus({ type: 'error', msg: 'No se pudo procesar: ' + failedNames.join(', ') + '. Prueba exportarla como JPG desde Fotos y subirla de nuevo.' });
              } else {
                setStatus(null);
              }
            }}
          />
          {files.length > 0 && (
            <div className="photo-preview-row" style={{ gridColumn: '1/-1' }}>
              {files.map((f, i) => (
                <div key={i} className="photo-preview-item">
                  <button
                    type="button"
                    className="photo-remove-btn"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  >
                    {'\u2715'}
                  </button>
                  <img src={filePreviewUrls[i]} alt={f.name} />
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Catalogo actual ({products.length})</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={restoreOrderByDate}
              disabled={products.length < 2}
              style={{ background: 'var(--fg)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Restaurar orden por fecha
            </button>
            <button
              type="button"
              onClick={shuffleProducts}
              disabled={products.length < 2}
              style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Orden aleatorio
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, opacity: 0.65, marginBottom: 14 }}>
          {reorderEnabled
            ? 'Arrastra los productos desde el icono \u2630 para reordenarlos. Ese orden es el que se usa en el catalogo cuando el filtro dice "Mas reciente".'
            : 'Para reordenar arrastrando, primero quita el filtro de categoria y la busqueda (el arrastre solo funciona sobre la lista completa; los botones de arriba si funcionan siempre).'}
        </p>

        <input
          type="text"
          placeholder="Buscar producto por nombre..."
          value={adminSearch}
          onChange={(e) => setAdminSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 999, border: '2px solid var(--pill-bg)', fontSize: 14, marginBottom: 12, fontFamily: 'inherit' }}
        />

        <div className="cat-checks" style={{ marginBottom: 16 }}>
          <span
            className={'cat-chip filterable' + (adminCatFilter === 'all' ? ' active' : '')}
            onClick={() => setAdminCatFilter('all')}
          >
            Todo
          </span>
          {cats.map((c) => (
            <span
              key={c.id}
              className={'cat-chip filterable' + (adminCatFilter === c.id ? ' active' : '')}
              onClick={() => setAdminCatFilter(c.id)}
            >
              {c.label}
            </span>
          ))}
        </div>

        {products
          .filter((p) => adminCatFilter === 'all' || (p.categories || []).includes(adminCatFilter))
          .filter((p) => p.name.toLowerCase().includes(adminSearch.trim().toLowerCase()))
          .map((p) => (
          <div
            key={p.id}
            className={'admin-list-item-wrap' + (draggedId === p.id ? ' dragging' : '')}
            draggable={reorderEnabled}
            onDragStart={() => handleDragStart(p.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(p.id)}
          >
            <div className="admin-list-item">
              {reorderEnabled && <span className="drag-handle" title="Arrastra para reordenar">{'\u2630'}</span>}
              {p.image_urls && p.image_urls[0] ? <img src={thumbUrl(p.image_urls[0])} alt={p.name} loading="lazy" /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--pill-bg)' }} />}
              <div className="info">
                <div className="name">{p.name} {p.sold && <span className="sold-tag">VENDIDO</span>}</div>
                <div className="meta">
                  S/ {p.price}
                  {p.categories && p.categories.length > 0 ? ' \u00b7 ' + p.categories.map((cid) => cats.find((c) => c.id === cid)?.label || cid).join(', ') : ''}
                  {p.image_urls && p.image_urls.length > 1 ? ' \u00b7 ' + p.image_urls.length + ' fotos' : ''}
                </div>
              </div>
              <button onClick={() => toggleSold(p)} className="sold-toggle-btn">{p.sold ? 'Marcar disponible' : 'Marcar vendido'}</button>
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
                          <img src={editPhotoPreviewUrls[i]} alt={'foto ' + (i + 1)} />
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
                        const results = await Promise.allSettled(selected.map((f) => toJpegIfNeeded(f)));
                        const okFiles = [];
                        const failedNames = [];
                        results.forEach((r, i) => {
                          if (r.status === 'fulfilled') okFiles.push(r.value);
                          else failedNames.push(selected[i].name);
                        });
                        setEditPhotos([...editPhotos, ...okFiles.map((file) => ({ kind: 'new', file }))]);
                        if (failedNames.length > 0) {
                          setStatus({ type: 'error', msg: 'No se pudo procesar: ' + failedNames.join(', ') + '. Prueba exportarla como JPG desde Fotos y subirla de nuevo.' });
                        } else {
                          setStatus(null);
                        }
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
