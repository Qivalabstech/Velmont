import { AdminForgotForm } from "../AuthForms";
export const metadata = { title: "Reset password" };
export default function F() {
  return <div className="adm-auth"><div className="box"><h1>Reset password</h1><p className="muted" style={{ margin: 0 }}>We will email a reset link to your staff address.</p><AdminForgotForm /></div></div>;
}
