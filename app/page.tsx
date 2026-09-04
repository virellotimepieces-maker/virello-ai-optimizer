import { headers } from "next/headers";
import Home from "./home-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const search = (await headers()).get("x-virello-search") || "";
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const embeddedInstall =
    params.get("embedded") === "1" ||
    Boolean(params.get("host")) ||
    Boolean(params.get("id_token"));
  return <Home embeddedInstall={embeddedInstall} />;
}
