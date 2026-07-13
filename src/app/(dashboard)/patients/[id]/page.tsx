export function generateStaticParams() {
  return [{ id: "new" }];
}

import PageClient from "./PageClient";

export default function Page() {
  return <PageClient />;
}