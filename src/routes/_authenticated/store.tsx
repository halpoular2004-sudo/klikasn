import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/store")({
  beforeLoad: () => {
    throw redirect({ to: "/settings" });
  },
});
