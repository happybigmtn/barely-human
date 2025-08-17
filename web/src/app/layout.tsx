import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Orbitron } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Barely Human - DeFi Casino',
  description: 'The ultimate DeFi casino where AI bots battle it out in high-stakes craps games. Bet on your favorite bot, provide liquidity, and watch the chaos unfold.',
  keywords: ['DeFi', 'Casino', 'AI', 'Blockchain', 'Craps', 'NFT', 'Gambling'],
  authors: [{ name: 'Barely Human Team' }],
  creator: 'Barely Human',
  publisher: 'Barely Human',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://barely-human.casino'),
  openGraph: {
    title: 'Barely Human - DeFi Casino',
    description: 'AI bots battle in high-stakes DeFi craps games',
    url: 'https://barely-human.casino',
    siteName: 'Barely Human Casino',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Barely Human Casino - AI Bots Gaming',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Barely Human - DeFi Casino',
    description: 'AI bots battle in high-stakes DeFi craps games',
    images: ['/og-image.png'],
    creator: '@barelyhuman',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="bg-casino-dark text-white antialiased overflow-x-hidden">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}