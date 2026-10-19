import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { AdminLoginForm } from "../AuthForms";

export const metadata = { title: "Staff sign in" };

export default async function AdminLogin() {
  if (await getStaff()) redirect("/admin");
  return (
    <div className="adm-auth">
      <div className="box">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="patch">V</span><span className="mono">VELMONT · Staff</span></div>
        <h1>Sign in</h1>
        <AdminLoginForm />
      </div>
    </div>
  );
}
