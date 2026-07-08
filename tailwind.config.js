const config = {
    content: [
        "./app/**/*.{js,jsx,mdx}",
        "./components/**/*.{js,jsx,mdx}",
        "./lib/**/*.{js,jsx,mdx}"
    ],
    theme: {
        extend: {
            colors: {
                primary: "#324C4A",
                "primary-dark": "#000000",
                secondary: "#609665",
                accent: "#609665",
                warning: "#F59E0B",
                emergency: "#DC2626",
                bg: "#DAF8EF",
                surface: "#FFFFFF",
                "text-primary": "#000000",
                "text-secondary": "#5B605D",
                border: "rgba(50, 76, 74, 0.14)"
            },
            fontFamily: {
                sans: [
                    "Manrope",
                    "Noto Sans",
                    "Noto Sans Bengali",
                    "Noto Sans Tamil",
                    "Noto Nastaliq Urdu",
                    "system-ui",
                    "sans-serif"
                ]
            },
            boxShadow: {
                soft: "0 18px 45px rgba(50, 76, 74, 0.10)"
            }
        }
    },
    plugins: []
};
export default config;
