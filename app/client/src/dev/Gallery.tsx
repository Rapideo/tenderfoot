/* The dev-only design-system gallery. Renders a heading and nothing else --
 * primitives arrive with SP2 Tasks 4-9, each appending its own section
 * (progress.md, Ruling 2: append-only, T9 is the sole reorganiser).
 *
 * "dev-gallery-marker" below is not a UI string; it exists only so Task 3
 * step 4 can grep a production build for it. A string that cannot occur
 * anywhere else in the bundle turns "the guard in router.tsx works" from an
 * assumption into something a command either finds or does not. */
export function Gallery() {
  return (
    <main>
      <h1>dev-gallery-marker — Design system gallery</h1>
    </main>
  );
}
