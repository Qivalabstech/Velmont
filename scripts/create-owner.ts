// Creates or resets the store owner account.
// Usage: npm run create-owner -- owner@yourdomain.com "Your Name" "StrongPassword1"
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import * as s from "../src/db/schema";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Usage: npm run create-owner -- email@domain.com "Full Name" "Password123"');
    process.exit(1);
  }
  if (password.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1); }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: s });
  const hash = await bcrypt.hash(password, 12);
  const existing = await db.query.users.findFirst({ where: eq(s.users.email, email.toLowerCase()) });
  if (existing) {
    await db.update(s.users).set({ passwordHash: hash, kind: "STAFF", isOwner: true, active: true, name })
      .where(eq(s.users.id, existing.id));
    console.log(`Updated ${email}: now the owner, password reset.`);
  } else {
    await db.insert(s.users).values({ email: email.toLowerCase(), name, passwordHash: hash, kind: "STAFF", isOwner: true });
    console.log(`Owner ${email} created.`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
