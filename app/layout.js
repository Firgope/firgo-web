import './globals.css';

export const metadata = {
  metadataBase: new URL('https://firgo-web.vercel.app'),
  title: 'Firgo',
  description: 'Cosas cheveres para casas cheveres :) - Muebles, ropa vintage, libros y decoracion',
  openGraph: {
    title: 'Firgo',
    description: 'Cosas cheveres para casas cheveres :)',
    url: 'https://firgo-web.vercel.app',
    siteName: 'Firgo',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'es_PE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Firgo',
    description: 'Cosas cheveres para casas cheveres :)',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bungee+Shade&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
