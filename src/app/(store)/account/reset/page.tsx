import { ResetForm } from "../Forms";
export const metadata = { title: "Choose a new password", robots: { index: false } };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token || "";
  return (
    <div className="wrap"><div className="auth">
      <div className="eyebrow mono">Your account</div>
      <h1 className="display">New password</h1>
      <ResetForm token={token} signInHref="/account/login" />
    </div></div>
  );
}
