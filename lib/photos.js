// Cada foto en v2/ tiene dos versiones en el storage:
//   v2/<nombre>.jpg        -> grande (1600px), para el visor y la pagina del producto
//   v2/<nombre>_thumb.jpg  -> miniatura (800px), para el catalogo y las vistas chicas
// En la base solo se guarda la URL de la grande; la miniatura se deduce del nombre.
// Las fotos viejas (fuera de v2/) no tienen miniatura y se muestran tal cual.
export function thumbUrl(url) {
  if (!url || url.indexOf('/product-images/v2/') === -1 || /_thumb\.jpg$/i.test(url)) return url;
  return url.replace(/\.jpg$/i, '_thumb.jpg');
}

// Ruta dentro del bucket a partir de la URL publica.
export function storagePath(url) {
  return (url || '').split('/product-images/')[1] || null;
}
