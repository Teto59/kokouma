import type { Metadata, Viewport } from "next";
import "@fontsource/kaisei-decol/700.css";
import "@fontsource/m-plus-rounded-1c/400.css";
import "@fontsource/m-plus-rounded-1c/500.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kokouma.jp"),
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
  return <html lang="ja"><body>{children}</body></html>;
}
