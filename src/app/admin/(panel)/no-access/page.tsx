import Link from "next/link";
import { PageHead } from "@/components/admin/ui";
export const metadata = { title: "No access" };
export default function NoAccess() {
  return (
    <div>
      <PageHead title="No access" sub="Your role does not include this section. Ask the store owner to update your role if you need it." />
      <Link className="btn" href="/admin/me">Go to my account</Link>
    </div>
  );
}
