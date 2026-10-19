import Link from "next/link";
import { ForgotForm } from "../Forms";
export const metadata = { title: "Reset password", robots: { index: false } };
export default function Forgot() {
  return (
    <div className="wrap"><div className="auth">
      <div className="eyebrow mono">Your account</div>
      <h1 className="display">Forgot password</h1>
      <p className="muted" style={{ margin: 0 }}>Enter your email and we will send a link to choose a new password.</p>
      <ForgotForm />
      <p className="alt"><Link href="/account/login">Back to sign in</Link></p>
    </div></div>
  );
}
