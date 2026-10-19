import { asc, desc, eq } from "drizzle-orm";
import { db, addresses } from "@/db";
import { requireCustomer } from "@/lib/auth";
import { deleteAddress, makeDefaultAddress } from "../../actions";
import { AddressEditor, NewAddress } from "../../Forms";

export default async function Addresses() {
  const c = await requireCustomer("/account/addresses");
  const list = await db.select().from(addresses).where(eq(addresses.userId, c.id)).orderBy(desc(addresses.isDefault), asc(addresses.name));
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Saved addresses</h2>
      {list.length > 0 && (
        <div className="addr-grid">
          {list.map((a) => (
            <div className="addr" key={a.id}>
              {a.isDefault && <span className="pill good" style={{ justifySelf: "start" }}>Default</span>}
              <div><b>{a.name}</b><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</div>
              <div className="acts">
                <AddressEditor a={a} />
                {!a.isDefault && <form action={makeDefaultAddress}><input type="hidden" name="id" value={a.id} /><button className="link-btn">Make default</button></form>}
                <form action={deleteAddress}><input type="hidden" name="id" value={a.id} /><button className="link-btn" style={{ color: "var(--bad)" }}>Delete</button></form>
              </div>
            </div>
          ))}
        </div>
      )}
      <NewAddress />
    </section>
  );
}
