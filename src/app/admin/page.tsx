import { redirect } from "next/navigation";

// Framateam is the only admin section for now.
export default function AdminPage() {
  redirect("/admin/framateam");
}
