import "@/styles/admin.css";
export const dynamic = "force-dynamic";
// "notranslate": browser auto-translate (e.g. Chrome → Hindi) rewrites text nodes React owns and crashes the page.
export const metadata = {
  title: { default: "Admin", template: "%s · VELMONT Admin" },
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div translate="no" className="notranslate">{children}</div>;
}
