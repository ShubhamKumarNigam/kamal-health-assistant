import { notFound } from "next/navigation";

// The prototype database viewer must not expose patient data.
// Use the database provider's access-controlled console for administration.
export default function DatabasePage() {
    notFound();
}