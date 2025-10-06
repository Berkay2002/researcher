import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

// Load environment variables from .env.local
function loadEnvLocal(): void {
  try {
    const envPath = join(process.cwd(), ".env.local");
    const envContent = readFileSync(envPath, "utf-8");

    // biome-ignore lint/complexity/noForEach: <>
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.warn("Could not load .env.local file:", error);
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  console.log("Setting up LangGraph Postgres persistence...");

  try {
    // Short-term memory / checkpoints
    const checkpointer = PostgresSaver.fromConnString(url);
    await checkpointer.setup(); // creates & migrates the checkpointer tables

    console.log("✅ Persistence setup completed successfully!");
    console.log(
      "📊 LangGraph checkpointer tables have been created in your Neon database"
    );
  } catch (error) {
    console.error("❌ Failed to set up persistence:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
