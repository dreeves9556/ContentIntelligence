// Quick edge-case tests for prompt-budget.ts
// Run: npx tsx src/lib/__tests__/prompt-budget.test.ts

import { buildBudgetedPrompt, type PromptBlock } from "../prompt-budget";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// Test 1: All blocks fit — nothing trimmed or omitted
{
  const blocks: PromptBlock[] = [
    { id: "a", content: "hello", priority: "CRITICAL" },
    { id: "b", content: "world", priority: "HIGH" },
    { id: "c", content: "foo", priority: "LOW" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 1000 });
  assert(result.included.length === 3, "T1: all 3 blocks included");
  assert(result.trimmed.length === 0, "T1: nothing trimmed");
  assert(result.omitted.length === 0, "T1: nothing omitted");
  assert(result.totalChars === "hello\n\nworld\n\nfoo".length, "T1: totalChars correct");
}

// Test 2: LOW block omitted when over budget
{
  const blocks: PromptBlock[] = [
    { id: "critical", content: "A".repeat(100), priority: "CRITICAL" },
    { id: "high", content: "B".repeat(100), priority: "HIGH" },
    { id: "low", content: "C".repeat(100), priority: "LOW", trimStrategy: "omit_if_over" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 250 });
  assert(result.included.length === 2, `T2: 2 blocks included (got ${result.included.length})`);
  assert(result.omitted.length === 1, `T2: 1 block omitted (got ${result.omitted.length})`);
  assert(result.omitted[0].id === "low", "T2: low block omitted");
}

// Test 3: CRITICAL blocks always included even when over budget
{
  const blocks: PromptBlock[] = [
    { id: "c1", content: "A".repeat(1000), priority: "CRITICAL" },
    { id: "c2", content: "B".repeat(1000), priority: "CRITICAL" },
    { id: "c3", content: "C".repeat(1000), priority: "CRITICAL" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 500 });
  assert(result.included.length === 3, `T3: all 3 CRITICAL blocks included even over budget (got ${result.included.length})`);
  assert(result.omitted.length === 0, "T3: no CRITICAL blocks omitted");
}

// Test 4: Empty blocks filtered out
{
  const blocks: PromptBlock[] = [
    { id: "a", content: "hello", priority: "CRITICAL" },
    { id: "b", content: "", priority: "HIGH" },
    { id: "c", content: "   ", priority: "HIGH" },
    { id: "d", content: "world", priority: "LOW" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 1000 });
  assert(result.included.length === 2, `T4: 2 non-empty blocks included (got ${result.included.length})`);
  assert(result.omitted.length === 0, "T4: empty blocks not in omitted");
}

// Test 5: Trim strategy preserve_start
{
  const blocks: PromptBlock[] = [
    { id: "a", content: "0123456789ABCDEF0123456789ABCDEF", priority: "MEDIUM", trimStrategy: "preserve_start" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 20 });
  assert(result.included.length === 1, "T5: block included");
  assert(result.trimmed.length === 1, `T5: block trimmed (got trimmed: ${result.trimmed.length})`);
  assert(result.included[0].finalChars < result.included[0].originalChars, `T5: finalChars (${result.included[0].finalChars}) < originalChars (${result.included[0].originalChars})`);
  assert(result.prompt.includes("…[trimmed]"), "T5: trimmed marker present");
}

// Test 6: Trim strategy omit_if_over — block dropped when over budget
{
  const blocks: PromptBlock[] = [
    { id: "critical", content: "A".repeat(50), priority: "CRITICAL" },
    { id: "low", content: "B".repeat(100), priority: "LOW", trimStrategy: "omit_if_over" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 60 });
  // Budget: 60. Critical takes 50. Remaining: 10. Low block is 100 chars, > 10, omit_if_over → omitted
  assert(result.omitted.length === 1, `T6: low block omitted (got omitted: ${result.omitted.length})`);
  assert(result.omitted[0].id === "low", "T6: correct block omitted");
}

// Test 7: Priority ordering — CRITICAL before HIGH before MEDIUM before LOW
{
  const blocks: PromptBlock[] = [
    { id: "low", content: "D".repeat(100), priority: "LOW" },
    { id: "critical", content: "A".repeat(100), priority: "CRITICAL" },
    { id: "medium", content: "C".repeat(100), priority: "MEDIUM" },
    { id: "high", content: "B".repeat(100), priority: "HIGH" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 150 });
  // Budget 150. CRITICAL (100) included, remaining 50. HIGH (100) trimmed to ~50. MEDIUM and LOW omitted.
  assert(result.included[0].id === "critical", "T7: CRITICAL first");
  assert(result.included[1]?.id === "high", `T7: HIGH second (got ${result.included[1]?.id})`);
}

// Test 8: Zero blocks
{
  const result = buildBudgetedPrompt([], { maxChars: 1000 });
  assert(result.prompt === "", "T8: empty prompt for zero blocks");
  assert(result.included.length === 0, "T8: zero included");
  assert(result.totalChars === 0, "T8: zero totalChars");
}

// Test 9: Single block exceeding budget with preserve_start
{
  const blocks: PromptBlock[] = [
    { id: "big", content: "X".repeat(200), priority: "CRITICAL" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 50 });
  assert(result.included.length === 1, "T9: CRITICAL block included even over budget");
  // CRITICAL blocks get blockMax (which defaults to originalChars), so no trimming
  assert(result.trimmed.length === 0, "T9: CRITICAL block not trimmed (blockMax = originalChars)");
}

// Test 10: Metadata correctness — finalChars matches actual content length
{
  const blocks: PromptBlock[] = [
    { id: "a", content: "hello world", priority: "CRITICAL" },
    { id: "b", content: "foo bar baz", priority: "HIGH" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 1000 });
  for (const meta of result.included) {
    const block = blocks.find((b) => b.id === meta.id)!;
    assert(meta.originalChars === block.content.length, `T10: originalChars correct for ${meta.id}`);
    assert(meta.finalChars === block.content.length, `T10: finalChars correct for ${meta.id}`);
    assert(meta.trimmed === false, `T10: not trimmed for ${meta.id}`);
    assert(meta.omitted === false, `T10: not omitted for ${meta.id}`);
  }
}

// Test 11: No raw prompt in metadata
{
  const blocks: PromptBlock[] = [
    { id: "a", content: "secret prompt content", priority: "CRITICAL" },
  ];
  const result = buildBudgetedPrompt(blocks, { maxChars: 1000 });
  const metadataJson = JSON.stringify(result.included) + JSON.stringify(result.trimmed) + JSON.stringify(result.omitted);
  assert(!metadataJson.includes("secret prompt content"), "T11: no raw prompt content in metadata arrays");
}

console.log("\n--- All tests complete ---");
