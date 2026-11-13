export default function Home() {
  return (
    <main className="container flex flex-1 items-center py-8 lg:py-12">
      <section className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Local planning
        </p>
        <h1>Plan agentique</h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          A local workspace for planning and supervising development agents.
        </p>
      </section>
    </main>
  );
}
