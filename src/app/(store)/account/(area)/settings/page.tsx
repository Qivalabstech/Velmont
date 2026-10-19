import { requireCustomer } from "@/lib/auth";
import { ProfileForm, PasswordForm } from "../../Forms";

export default async function Settings() {
  const c = await requireCustomer("/account/settings");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ProfileForm name={c.name} phone={c.phone || ""} email={c.email} optin={c.marketingOptIn} />
      <PasswordForm />
    </div>
  );
}
