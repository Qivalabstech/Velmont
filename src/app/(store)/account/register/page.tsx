import Link from "next/link";
import { RegisterForm } from "../Forms";

export const metadata = { title: "Create account", robots: { index: false } };

export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="wrap">
      <div className="auth">
        <div className="eyebrow mono">Your account</div>
        <h1 className="display">Create account</h1>
        <p className="muted" style={{ margin: 0 }}>Track orders, save addresses and keep a wishlist.</p>
        <RegisterForm next={sp.next || "/account"} email={sp.email || ""} />
        <p className="alt">Already have an account? <Link href="/account/login">Sign in</Link></p>
      </div>
    </div>
  );
}
