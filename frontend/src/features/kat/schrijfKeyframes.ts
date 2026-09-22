// Writes chuck-keyframes.css from the choreography (FB-071). Run with `pnpm kat:keyframes`; Node runs this file
// directly, which is why it and everything it imports use only erasable TypeScript.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bakKeyframes } from "./choreografie.ts";

const doel = fileURLToPath(new URL("./chuck-keyframes.css", import.meta.url));
writeFileSync(doel, bakKeyframes());
console.log(`Wrote ${doel}`);
