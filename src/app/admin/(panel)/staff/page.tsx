import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, users, roles } from "@/db";
import { requireStaff } from "@/lib/auth";
import { PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { addStaff, updateStaff, resetStaffPassword, removeStaff, saveRole, deleteRole } from "./actions";

export const metadata = { title: "Staff & roles" };

export default async function Staff({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireStaff("staff.manage");
  const tab = (await searchParams).tab || "team";
  const [team, roleRows] = await Promise.all([
    db.query.users.findMany({ where: eq(users.kind, "STAFF"), with: { role: true }, orderBy: [asc(users.createdAt)] }),
    db.select({ r: roles, n: sql<number>`(select count(*) from users u where u.role_id = ${roles.id})::int` }).from(roles).orderBy(asc(roles.name)),
  ]);
  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead title="Staff & roles" sub="Give each person only the sections they need. The owner always has full access." />
      <nav className="tabs"><Link href="/admin/staff" aria-current={tab === "team" ? "page" : undefined}>Team<span className="n">{team.length}</span></Link><Link href="/admin/staff?tab=roles" aria-current={tab === "roles" ? "page" : undefined}>Roles<span className="n">{roleRows.length}</span></Link></nav>

      {tab === "team" && (
        <div className="stack">
          <Card flush>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
              <tbody>{team.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b>{u.id === me.id && <span className="sub"> (you)</span>}<div className="sub">{u.email}</div></td>
                  <td>{u.isOwner ? <Pill tone="info">Owner</Pill> : u.role?.name || <span className="sub">No role</span>}</td>
                  <td>{u.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Access off</Pill>}</td>
                  <td>{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : "Never"}</td>
                  <td className="r"><a className="btn sm" href={`#edit-${u.id}`}>Edit</a></td>
                </tr>
              ))}</tbody>
            </table></div>
          </Card>

          <Card title="Add a team member" sub="They sign in at /admin/login with their email and the password below.">
            <AForm action={addStaff} reset className="fgrid three">
              <div className="field"><label htmlFor="ns-n">Name</label><input id="ns-n" name="name" className="input" /></div>
              <div className="field"><label htmlFor="ns-e">Email</label><input id="ns-e" name="email" type="email" className="input" /></div>
              <div className="field"><label htmlFor="ns-r">Role</label><select id="ns-r" name="roleId" className="select">{roleRows.map(({ r }) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div className="field"><label htmlFor="ns-p">Phone <span className="muted">(optional)</span></label><input id="ns-p" name="phone" className="input" /></div>
              <div className="field"><label htmlFor="ns-w">Password <span className="muted">(blank = generate)</span></label><input id="ns-w" name="password" className="input" autoComplete="new-password" /></div>
              <div style={{ alignSelf: "end" }}><Submit>Add to team</Submit></div>
            </AForm>
          </Card>

          {team.map((u) => (
            <Card key={u.id} id={`edit-${u.id}`} title={`Edit ${u.name}`} sub={u.email}>
              <AForm action={updateStaff} className="fgrid three">
                <input type="hidden" name="id" value={u.id} />
                <div className="field"><label htmlFor={`sn-${u.id}`}>Name</label><input id={`sn-${u.id}`} name="name" className="input" defaultValue={u.name} /></div>
                <div className="field"><label htmlFor={`sr-${u.id}`}>Role</label>
                  <select id={`sr-${u.id}`} name="roleId" className="select" defaultValue={u.roleId || ""} disabled={u.isOwner}>
                    {u.isOwner && <option value="">Owner (all access)</option>}{roleRows.map(({ r }) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" name="active" defaultChecked={u.active} disabled={u.isOwner} />{u.isOwner && <input type="hidden" name="active" value="on" />}Access on</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Submit className="btn sm solid">Save</Submit></div>
              </AForm>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <AForm action={resetStaffPassword}><input type="hidden" name="id" value={u.id} /><ConfirmSubmit className="btn sm" confirmText="Click again to reset">Reset password</ConfirmSubmit></AForm>
                {!u.isOwner && u.id !== me.id && <AForm action={removeStaff}><input type="hidden" name="id" value={u.id} /><ConfirmSubmit confirmText="Click again to remove">Remove from team</ConfirmSubmit></AForm>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "roles" && (
        <div className="stack">
          {roleRows.map(({ r, n }) => (
            <Card key={r.id} title={r.name} sub={`${n} staff · ${r.permissions.length} permissions`}>
              <RoleForm r={r} />
              <AForm action={deleteRole} style={{ marginTop: 10 }}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit>Delete role</ConfirmSubmit></AForm>
            </Card>
          ))}
          <Card title="Create a role" sub="For example a part-time packer who only sees orders."><RoleForm /></Card>
        </div>
      )}
    </div>
  );
}

function RoleForm({ r }: { r?: { id: string; name: string; description: string; permissions: string[] } }) {
  const k = r?.id || "new";
  return (
    <AForm action={saveRole} reset={!r} className="stack">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="fgrid">
        <div className="field"><label htmlFor={`rn-${k}`}>Role name</label><input id={`rn-${k}`} name="name" className="input" defaultValue={r?.name} /></div>
        <div className="field"><label htmlFor={`rd-${k}`}>Description</label><input id={`rd-${k}`} name="description" className="input" defaultValue={r?.description} /></div>
      </div>
      <div className="perm-grid">
        {PERMISSION_GROUPS.map((g) => (
          <fieldset key={g.label}><legend>{g.label}</legend>
            {g.perms.map((p) => (
              <label key={p} className="check"><input type="checkbox" name="perms" value={p} defaultChecked={r?.permissions.includes(p)} />
                <span>{PERMISSIONS[p as Permission]}<small>{p}</small></span></label>
            ))}
          </fieldset>
        ))}
      </div>
      <div><Submit>{r ? "Save role" : "Create role"}</Submit></div>
    </AForm>
  );
}
