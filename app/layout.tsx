import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kokouma.teto66.chatgpt.site"),
  title: "KOKOUMA — 友だちの『ここ、うまい』を地図に。",
  description: "信頼できる友だちのおすすめだけで、次の一軒に出会うソーシャルグルメマップ。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "KOKOUMA — 友だちの『ここ、うまい』を地図に。",
    description: "星より、あの人のひとこと。友だち発のソーシャルグルメマップ。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "KOKOUMA" }],
  },
  twitter: { card: "summary_large_image", title: "KOKOUMA", description: "友だちの『ここ、うまい』を地図に。", images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17130f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Kaisei+Decol:wght@700&family=M+PLUS+Rounded+1c:wght@400;500;700&display=swap" rel="stylesheet" />
    <link href="https://unpkg.com/maplibre-gl@5.20.2/dist/maplibre-gl.css" rel="stylesheet" />
  </head><body>{children}</body></html>;
}
