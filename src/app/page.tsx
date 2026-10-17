import { FontSizeControl } from "@/components/ui/font-size-control";

export default function Home() {
  return (
    <main
      style={{
        padding: "var(--space-3)",
        maxWidth: "var(--content-width)",
        display: "grid",
        gap: "var(--space-3)",
      }}
    >
      <h1
        style={{
          fontSize: "var(--font-size-large)",
          fontWeight: "var(--font-weight-strong)",
        }}
      >
        Capstone
      </h1>
      <p>Foundation in progress. Layout shells come in step 1.20.</p>
      <FontSizeControl />
    </main>
  );
}
