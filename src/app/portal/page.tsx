import { Suspense } from "react";
import { PortalCliente } from "@/components/portal/PortalCliente";

export default function PortalInicio() {
  return (
    <Suspense>
      <PortalCliente />
    </Suspense>
  );
}
