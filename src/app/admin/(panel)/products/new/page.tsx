import { requireStaff } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { PageHead } from "@/components/admin/ui";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Add product" };

export default async function NewProduct() {
  await requireStaff("products.manage");
  return (
    <div>
      <PageHead title="Add product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm categories={(await listCategories()).map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
