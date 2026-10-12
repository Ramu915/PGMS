import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/layout/Layout";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — PGMS" }] }),
  component: () => (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h1 className="font-display">About PGMS</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          The Public Grievance Management System (PGMS) is a transparent platform that connects
          citizens directly with government departments to report and resolve public issues efficiently.
        </p>
      </div>
    </Layout>
  ),
});
