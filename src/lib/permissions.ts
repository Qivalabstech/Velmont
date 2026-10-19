export const PERMISSIONS = {
  "dashboard.view": "See the dashboard and sales reports",
  "orders.view": "See orders",
  "orders.manage": "Update order status, tracking and notes",
  "orders.refund": "Cancel orders and issue refunds",
  "products.view": "See products",
  "products.manage": "Add, edit and delete products and categories",
  "inventory.manage": "Update stock levels",
  "customers.view": "See customers",
  "customers.manage": "Edit and block customers",
  "marketing.manage": "Coupons and email subscribers",
  "reviews.manage": "Approve and reject reviews",
  "content.manage": "Homepage text, pages, FAQ and contact inbox",
  "seo.manage": "SEO titles, redirects and AI crawler settings",
  "health.view": "See site health, speed and SEO scores",
  "staff.manage": "Add staff and edit roles",
  "settings.manage": "Store, tax, shipping and payment settings",
  "activity.view": "See the activity log",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "Sales", perms: ["dashboard.view", "orders.view", "orders.manage", "orders.refund"] },
  { label: "Catalogue", perms: ["products.view", "products.manage", "inventory.manage", "reviews.manage"] },
  { label: "Customers & marketing", perms: ["customers.view", "customers.manage", "marketing.manage"] },
  { label: "Website", perms: ["content.manage", "seo.manage", "health.view"] },
  { label: "Administration", perms: ["staff.manage", "settings.manage", "activity.view"] },
];

export const PRESET_ROLES: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: "Store Manager",
    description: "Runs the store day to day. Everything except staff and settings.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "staff.manage" && p !== "settings.manage"),
  },
  {
    name: "Order Manager",
    description: "Packs and ships orders, updates tracking, handles cancellations.",
    permissions: ["dashboard.view", "orders.view", "orders.manage", "orders.refund", "customers.view", "inventory.manage", "products.view"],
  },
  {
    name: "SEO Manager",
    description: "Owns search and AI visibility: SEO fields, redirects, content and site health.",
    permissions: ["products.view", "seo.manage", "content.manage", "health.view"],
  },
  {
    name: "Catalogue Manager",
    description: "Adds and edits products, photos, stock and reviews.",
    permissions: ["products.view", "products.manage", "inventory.manage", "reviews.manage"],
  },
  {
    name: "Customer Support",
    description: "Answers customers, looks up orders and the contact inbox.",
    permissions: ["orders.view", "orders.manage", "customers.view", "content.manage"],
  },
];

/** Which admin sections exist and what permission opens them. Used for the sidebar and route guards. */
export const ADMIN_NAV: { href: string; label: string; perm: Permission; group: string }[] = [
  { href: "/admin", label: "Dashboard", perm: "dashboard.view", group: "Overview" },
  { href: "/admin/orders", label: "Orders", perm: "orders.view", group: "Sales" },
  { href: "/admin/customers", label: "Customers", perm: "customers.view", group: "Sales" },
  { href: "/admin/products", label: "Products", perm: "products.view", group: "Catalogue" },
  { href: "/admin/inventory", label: "Inventory", perm: "inventory.manage", group: "Catalogue" },
  { href: "/admin/categories", label: "Categories", perm: "products.manage", group: "Catalogue" },
  { href: "/admin/reviews", label: "Reviews", perm: "reviews.manage", group: "Catalogue" },
  { href: "/admin/discounts", label: "Discounts", perm: "marketing.manage", group: "Marketing" },
  { href: "/admin/subscribers", label: "Subscribers", perm: "marketing.manage", group: "Marketing" },
  { href: "/admin/content", label: "Homepage & pages", perm: "content.manage", group: "Website" },
  { href: "/admin/inbox", label: "Inbox", perm: "content.manage", group: "Website" },
  { href: "/admin/seo", label: "SEO & AI search", perm: "seo.manage", group: "Website" },
  { href: "/admin/health", label: "Site health", perm: "health.view", group: "Website" },
  { href: "/admin/staff", label: "Staff & roles", perm: "staff.manage", group: "Admin" },
  { href: "/admin/activity", label: "Activity log", perm: "activity.view", group: "Admin" },
  { href: "/admin/settings", label: "Settings", perm: "settings.manage", group: "Admin" },
];
