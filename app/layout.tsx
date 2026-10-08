import type { Metadata } from "next";
import { Chakra_Petch, Share_Tech_Mono, VT323 } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { NaviUiProvider } from "@/components/navi_ui";

const sans = Chakra_Petch({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const mono = Share_Tech_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "400",
});

const crt = VT323({
  variable: "--font-crt",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Navi",
  description: "Present day, present time. Navi terminal for the Wired - chat, vision, image synthesis and edits.",
  icons: {
    icon: "/darkwired.png",
    shortcut: "/darkwired.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sans.variable} ${mono.variable} ${crt.variable} antialiased bodyfx`}
      >
        <NaviUiProvider>
          <div className="appwrap">
            <LayoutWrapper>{children}</LayoutWrapper>
          </div>
        </NaviUiProvider>
      </body>
    </html>
  );
}
