import { notFound } from "next/navigation";
import { ComponentGallery } from "./gallery";

export const metadata = { title: "Components" };

/** Review page for step 1.21 and the 1.23 checks. Not available in production. */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ComponentGallery />;
}
