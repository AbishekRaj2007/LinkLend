import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // drizzle-kit resolves `schema` through a glob matcher (tinyglobby), which
  // treats backslashes as escape characters — so a native Windows path from
  // path.join ("...\\src\\schema\\index.ts") matches nothing. Normalise to
  // forward slashes; POSIX paths already pass through unchanged. Kept anchored
  // to __dirname so it works regardless of the cwd `drizzle-kit` runs from.
  schema: path.join(__dirname, "./src/schema/index.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
