export const metadata = { title: "Aangan Call Desk" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#F3F5F4", color: "#16211F", fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
