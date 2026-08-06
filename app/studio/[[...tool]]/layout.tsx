export const metadata = { title: "FadeMe Studio" };

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      {children}
    </div>
  );
}
