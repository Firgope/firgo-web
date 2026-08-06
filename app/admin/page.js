'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCatFilter, setAdminCatFilter] = useState('all');
  const [migrating, setMigrating] = useState(false);
  const [migrateLog, setMigrateLog] = useState('');
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
    () => editPhotos.map((item) => (item.kind === 'existing' ? item.url : URL.createObjectURL(item.file))),
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
    }
  }, [unlocked]);

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

  async function toJpegIfNeeded(file) {
    const isWebp = /\.webp$/i.test(file.name) || file.type === 'image/webp';
    if (isWebp) return file;

    async function encodeBitmap(bitmap) {
      const MAX_DIM = 1600;
      let width = bitmap.width;
      let height = bitmap.height;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
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
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
      let ext = 'webp';
      let type = 'image/webp';
      if (!blob) {
        // Respaldo: si el navegador no sabe codificar WebP, usamos JPG
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        ext = 'jpg';
        type = 'image/jpeg';
      }
      if (!blob) throw new Error('canvas.toBlob devolvio vacio');
      return { blob, ext, type };
    }

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

  function isNonJpgUrl(url) {
    return !/\.webp(\?|$)/i.test(url);
  }

  function urlLoadsOk(url) {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function needsFix(url) {
    if (isNonJpgUrl(url)) return true;
    const ok = await urlLoadsOk(url);
    return !ok;
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

  async function migrateHeicPhotos() {
    setMigrating(true);
    setMigrateLog('Revisando fotos...');

    const allRefs = [];
    products.forEach((p) => (p.image_urls || []).forEach((url, idx) => allRefs.push({ p, url, idx })));

    let checked = 0;
    const flags = new Array(allRefs.length);
    await runWithConcurrency(allRefs, 6, async (ref, i) => {
      flags[i] = await needsFix(ref.url);
      checked++;
      setMigrateLog('Revisando fotos... (' + checked + '/' + allRefs.length + ')');
    });

    const toFix = allRefs.filter((_, i) => flags[i]);

    if (toFix.length === 0) {
      setMigrateLog('No se encontraron fotos pendientes de convertir. Todo en orden.');
      setMigrating(false);
      return;
    }

    // Agrupar por URL unica: si dos productos comparten la misma foto (por
    // ejemplo un producto duplicado), se convierte UNA sola vez y el
    // resultado se aplica a todos los que la usan. Antes cada referencia se
    // procesaba por separado, y si dos referencias apuntaban al mismo
    // archivo, la primera lo borraba del storage y la segunda encontraba un
    // 404 y perdia la foto (asi se producia el bug de "duplicar danha el
    // original": ambos comparten URL, y el que perdia la carrera se quedaba
    // sin foto).
    const refsByUrl = new Map();
    toFix.forEach((ref) => {
      if (!refsByUrl.has(ref.url)) refsByUrl.set(ref.url, []);
      refsByUrl.get(ref.url).push(ref);
    });
    const uniqueUrls = Array.from(refsByUrl.keys());

    const resultsByProductId = {};
    products.forEach((p) => {
      resultsByProductId[p.id] = [...(p.image_urls || [])];
    });

    let convertedCount = 0;
    let errorCount = 0;
    let ghostCount = 0;
    const ghostProductNames = new Set();
    let firstErrorMsg = '';
    let done = 0;

    await runWithConcurrency(uniqueUrls, 3, async (url) => {
      const refsForUrl = refsByUrl.get(url);
      const namesForLog = Array.from(new Set(refsForUrl.map((r) => r.p.name))).join(', ');
      setMigrateLog('Convirtiendo foto ' + (done + 1) + ' de ' + uniqueUrls.length + ': "' + namesForLog + '"...');
      let newUrl = null;
      let isGhost = false;
      try {
        const res = await fetch(url);
        if (res.status === 400 || res.status === 404) {
          // El archivo ya no existe en el storage, no hay nada que convertir: se limpia la referencia
          isGhost = true;
        } else {
          if (!res.ok) throw new Error('fetch fallo con status ' + res.status);
          const blob = await res.blob();
          const guessedExt = (url.split('.').pop() || 'img').split('?')[0];
          const oldFile = new File([blob], 'old.' + guessedExt, { type: blob.type || 'application/octet-stream' });
          const jpgFile = await toJpegIfNeeded(oldFile);
          const path = Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
          const { error: uploadError } = await supabase.storage.from('product-images').upload(path, jpgFile);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          newUrl = pub.publicUrl;
          const oldPath = url.split('/product-images/')[1];
          if (oldPath) await supabase.storage.from('product-images').remove([oldPath]);
          convertedCount++;
        }
      } catch (err) {
        errorCount++;
        if (!firstErrorMsg) firstErrorMsg = (err && err.message) ? err.message : String(err);
        console.error('Error convirtiendo foto:', url, err);
        done++;
        return;
      }

      if (isGhost) {
        ghostCount++;
        refsForUrl.forEach((ref) => ghostProductNames.add(ref.p.name));
      }
      refsForUrl.forEach((ref) => {
        resultsByProductId[ref.p.id][ref.idx] = newUrl; // null si era un enlace roto (ghost)
      });
      done++;
    });

    for (const p of products) {
      resultsByProductId[p.id] = resultsByProductId[p.id].filter((u) => u !== null);
      const changed = JSON.stringify(resultsByProductId[p.id]) !== JSON.stringify(p.image_urls || []);
      if (changed) {
        await supabase.from('products').update({ image_urls: resultsByProductId[p.id] }).eq('id', p.id);
      }
    }

    setMigrateLog(
      convertedCount === 0 && errorCount === 0
        ? 'No se encontraron fotos pendientes de convertir. Todo en orden.'
        : convertedCount + ' foto(s) convertida(s).'
          + (ghostCount > 0 ? ' ' + ghostCount + ' enlace(s) roto(s) sin remedio, se quitaron de: ' + Array.from(ghostProductNames).join(', ') + '.' : '')
          + (errorCount > 0 ? ' ' + errorCount + ' con error. Detalle: ' + firstErrorMsg : '')
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
      image_urls = await Promise.all(
        files.map(async (f) => {
          const ext = f.name.split('.').pop();
          const path = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(path, f);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          return pub.publicUrl;
        })
      );

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
      const finalUrls = await Promise.all(
        editPhotos.map(async (item) => {
          if (item.kind === 'existing') return item.url;
          const ext = item.file.name.split('.').pop();
          const path = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(path, item.file);
          if (uploadError) throw uploadError;
          const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
          return pub.publicUrl;
        })
      );

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
          {'Convierte a WebP (mas liviano) las fotos que hayas subido antes en otro formato (JPG, HEIC, PNG, etc), y revisa una por una si realmente cargan bien (a veces una queda rota por dentro aunque diga .jpg).'}
        </p>
        <button
          type="button"
          onClick={migrateHeicPhotos}
          disabled={migrating}
          style={{ background: 'var(--fg)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          {migrating ? 'Convirtiendo...' : 'Convertir fotos que no sean WebP'}
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
              {p.image_urls && p.image_urls[0] ? <img src={p.image_urls[0]} alt={p.name} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--pill-bg)' }} />}
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
