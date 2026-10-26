import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { validMathsHostToken } from "@/lib/infoCards/mathsHostAuth";
import Host from "./Host";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!validMathsHostToken((await headers()).get("x-info-maths-host"))) notFound();
  return <Host />;
}
