export const dynamic = "force-dynamic";
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#ECEBE6", minHeight: "100vh", padding: "1px 0" }}>{children}</div>;
}
