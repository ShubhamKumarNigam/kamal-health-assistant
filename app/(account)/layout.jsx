import "../globals.css";
import '@fontsource-variable/dm-sans';
import './care.css';
import { LanguageProvider } from "@/components/LanguageProvider";
export const metadata = {
    title: "KAMAL Health Assistant",
    description: "A multilingual voice-first health and wellness assistant for India."
};
export default function RootLayout({ children }) {
    return (<html lang="en">
      <body className="font-sans antialiased">
        <LanguageProvider>{children}</LanguageProvider>
        <footer className="flex flex-wrap justify-center gap-6 px-6 py-6 text-base underline">
          <a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a>
        </footer>
      </body>
    </html>);
}
