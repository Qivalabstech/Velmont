import "@/styles/admin.css";
export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · VELMONT Admin" }, robots: { index: false, follow: false } };
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
