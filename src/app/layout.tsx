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
      <body
  style={{
    margin: 0,
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #b2f7ef 0%, #a0c4ff 25%, #cdb4db 50%, #ffc8dd 75%, #ffafcc 100%)",
    backgroundAttachment: "fixed",
  }}
>
  {children}
</body>
    </html>
  );
}
