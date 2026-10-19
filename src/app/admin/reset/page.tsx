import { AdminResetForm } from "../AuthForms";
export const metadata = { title: "New password" };
export default async function R({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token || "";
  return <div className="adm-auth"><div className="box"><h1>New password</h1><AdminResetForm token={token} /></div></div>;
}
