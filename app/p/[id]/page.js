import { supabase } from '../../../lib/supabaseClient';

export async function generateMetadata({ params }) {
  const { data: p } = await supabase.from('products').select('*').eq('id', params.id).single();
  if (!p) {
    return { title: 'Producto no encontrado - Firgo' };
  }
  const plainName = p.name.replace(/\*\*/g, '').replace(/\*/g, '');
  const photo = p.image_urls && p.image_urls[0] ? p.image_urls[0] : undefined;
  return {
    title: plainName + ' - Firgo',
    description: 'S/ ' + p.price + (p.medidas ? ' - ' + p.medidas : ''),
    openGraph: {
      title: plainName,
      description: 'S/ ' + p.price,
      images: photo ? [{ url: photo, width: 1200, height: 1200 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: plainName,
      description: 'S/ ' + p.price,
      images: photo ? [photo] : undefined,
    },
  };
}

export default async function ProductPage({ params }) {
  const { data: p } = await supabase.from('products').select('*').eq('id', params.id).single();

  if (!p) {
    return (
      <div className="wrap">
        <div className="body-content">
          <p>Producto no encontrado.</p>
          <a href="/">Volver al catalogo</a>
        </div>
      </div>
    );
  }

  const plainName = p.name.replace(/\*\*/g, '').replace(/\*/g, '');
  const waMsg = encodeURIComponent('Hola! Me interesa: ' + plainName + ' - S/ ' + p.price);
  const hasDiscount = p.original_price && Number(p.original_price) > Number(p.price);

  return (
    <div className="wrap">
      <div className="logo-band" style={{ padding: '18px 0', textAlign: 'center' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <h1 className="logo" style={{ fontSize: 48 }}>FIRGO</h1>
        </a>
      </div>
      <div className="body-content" style={{ maxWidth: 480, margin: '0 auto' }}>
        {p.image_urls && p.image_urls[0] && (
          <img src={p.image_urls[0]} alt={plainName} style={{ width: '100%', borderRadius: 18, marginBottom: 16 }} />
        )}
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{plainName}</h2>
        {p.description && <p style={{ color: '#666', marginBottom: 10 }}>{p.description}</p>}
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>
          {hasDiscount && (
            <span style={{ textDecoration: 'line-through', color: '#999', fontSize: 16, marginRight: 8 }}>
              {'S/ ' + p.original_price}
            </span>
          )}
          {'S/ ' + p.price}
        </div>
        {p.medidas && <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>{p.medidas}</p>}
        {p.sold ? (
          <div style={{ background: '#999', color: '#fff', padding: 12, borderRadius: 10, textAlign: 'center', fontWeight: 700 }}>
            VENDIDO
          </div>
        ) : (
          <a
            href={'https://wa.me/51994859150?text=' + waMsg}
            target="_blank"
            rel="noreferrer"
            className="whatsapp-btn"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            Contactar por WhatsApp
          </a>
        )}
        <p style={{ marginTop: 20 }}>
          <a href="/" style={{ color: 'var(--fg)', fontWeight: 600 }}>Ver todo el catalogo</a>
        </p>
      </div>
    </div>
  );
}
