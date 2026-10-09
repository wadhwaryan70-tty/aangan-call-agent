import fs from "node:fs";
import path from "node:path";

// pricing.md is deliberately NOT loaded anywhere (check 06: the agent never quotes a price).
const read = (f: string) => fs.readFileSync(path.join(process.cwd(), "knowledge", f), "utf8");

export const knowledge = () => ({
  qualified: read("qualified.md"),
  services: read("services.md"),
});
