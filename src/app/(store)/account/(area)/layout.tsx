import { requireCustomer } from "@/lib/auth";
import { AccountNav } from "./AccountNav";

export const metadata = { title: "My account", robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const c = await requireCustomer();
  return (
    <div className="wrap">
      <header className="page-head"><div className="eyebrow mono">My account</div><h1 className="display">Hello, {c.name.split(" ")[0]}</h1></header>
      <div className="acct"><AccountNav /><div style={{ minWidth: 0 }}>{children}</div></div>
    </div>
  );
}
