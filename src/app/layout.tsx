import "./globals.css";


export const metadata = {
  title: "Meemorize App",
  description: "Application de transmission de mémoires",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      
      
      
      <body>
  {children}
</body>
    </html>
  );
}
