/**
 * Test script for Orchestrator-Worker Research Workflow
 *
 * This script demonstrates how to invoke the rebuilt researcher workflow
 * that follows the Orchestrator-Worker pattern with LangSmith tracing.
 *
 * Usage:
 *   npm run dev (in one terminal to start the dev server)
 *   npx tsx scripts/test-orchestrator-workflow.ts (in another terminal)
 *
 * Or test directly with LangGraph CLI:
 *   langgraph dev
 *   Then use the LangGraph Studio UI to invoke the workflow
 */
/** biome-ignore-all lint/style/noMagicNumbers: <Mathematical constants are used throughout the code> */

import { getGraph } from "../src/server/workflows/researcher/graph/index-orchestrator";

async function testOrchestratorWorkflow() {
  console.log("🚀 Testing Orchestrator-Worker Research Workflow\n");

  try {
    // Get the compiled graph
    const graph = getGraph();

    console.log("✅ Graph compiled successfully");
    console.log("📊 Graph structure:");
    console.log("   - Nodes:", Object.keys(graph.nodes || {}).join(", "));
    console.log("\n");

    // Test invocation with a simple research goal
    const testGoal =
      "What are the latest developments in AI agents and LangGraph?";
    const threadId = `test-${Date.now()}`;

    console.log(`📝 Test Goal: ${testGoal}`);
    console.log(`🧵 Thread ID: ${threadId}\n`);

    console.log("🔄 Invoking workflow...\n");

    // Invoke the workflow
    const result = await graph.invoke(
      {
        threadId,
        userInputs: {
          goal: testGoal,
          modeOverride: "auto", // Use auto mode to skip HITL
        },
      },
      {
        configurable: {
          thread_id: threadId,
        },
      }
    );

    console.log("\n✅ Workflow completed successfully!\n");

    // Display results
    console.log("📊 Results Summary:");
    console.log("==================\n");

    if (result.workerResults && result.workerResults.length > 0) {
      console.log(
        `✓ Worker Results: ${result.workerResults.length} workers completed`
      );
      for (const workerResult of result.workerResults) {
        console.log(`  - ${workerResult.aspect}:`);
        console.log(`    Queries: ${workerResult.queriesExecuted}`);
        console.log(
          `    Documents: ${workerResult.documentsFound} found, ${workerResult.documentsSelected} selected`
        );
        console.log(
          `    Confidence: ${(workerResult.confidence * 100).toFixed(1)}%`
        );
        console.log(`    Summary: ${workerResult.summary}\n`);
      }
    }

    if (result.draft) {
      console.log("✓ Draft Report:");
      console.log(
        `  Confidence: ${(result.draft.confidence * 100).toFixed(1)}%`
      );
      console.log(`  Citations: ${result.draft.citations.length}`);
      console.log(`  Length: ${result.draft.text.length} characters\n`);
      console.log("  Preview (first 500 chars):");
      console.log(`  ${result.draft.text.substring(0, 500)}...\n`);
    }

    if (result.issues && result.issues.length > 0) {
      console.log(`⚠️  Issues: ${result.issues.length}`);
      for (const issue of result.issues) {
        console.log(`  - ${issue}`);
      }
    }

    console.log("\n🎉 Test completed successfully!");
    console.log("\n💡 To view in LangSmith:");
    console.log("   1. Ensure LANGCHAIN_TRACING_V2=true in .env.local");
    console.log("   2. Check your LangSmith dashboard for the trace");
    console.log(
      "   3. You should see the Orchestrator-Worker pattern with parallel workers\n"
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error);

    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack trace:", error.stack);
    }

    process.exit(1);
  }
}

// Run the test
testOrchestratorWorkflow().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
