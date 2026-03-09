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
      
      <style jsx global>{`
  .glass {
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.35);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
`}</style>
      
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
