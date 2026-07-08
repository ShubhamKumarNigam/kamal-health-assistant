import "./globals.css";
import { LanguageProvider } from "@/components/LanguageProvider";
export const metadata = {
    title: "KAMAL Health Assistant",
    description: "A multilingual voice-first health and wellness assistant for India."
};
export default function RootLayout({ children }) {
    return (<html lang="en">
      <body className="font-sans antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>);
}
