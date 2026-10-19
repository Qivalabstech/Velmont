import { requireStaff } from "@/lib/auth";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { PageHead, Card } from "@/components/admin/ui";
import { MeForms } from "./MeForms";

export const metadata = { title: "My account" };

export default async function Me() {
  const me = await requireStaff();
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHead title="My account" sub={`${me.email} · ${me.isOwner ? "Owner (full access)" : me.role?.name || "No role"}`} />
      <MeForms name={me.name} phone={me.phone || ""} />
      <Card title="What you can do">
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: ".9rem" }}>
          {[...me.perms].map((p) => <li key={p}>{PERMISSIONS[p as Permission]}</li>)}
        </ul>
      </Card>
    </div>
  );
}
