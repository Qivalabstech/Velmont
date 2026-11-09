import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth";
import { safeNext } from "@/lib/utils";
import { LoginForm } from "../Forms";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCustomer()) redirect(next);
  return (
    <div className="wrap">
      <div className="auth">
        <div className="eyebrow mono">Your account</div>
        <h1 className="display">Sign in</h1>
        <LoginForm next={next} />
        <p className="alt">New here? <Link href={`/account/register?next=${encodeURIComponent(next)}`}>Create an account</Link>. You can also check out as a guest.</p>
      </div>
    </div>
  );
}
