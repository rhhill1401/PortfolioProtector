import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { runWithTimeout } from "../index.ts";

Deno.test("runWithTimeout resolves when task finishes in time", async () => {
  const result = await runWithTimeout(50, async (_signal) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 42;
  });
  assertEquals(result, 42);
});

Deno.test("runWithTimeout aborts when task exceeds timeout", async () => {
  await assertRejects(
    () => runWithTimeout(10, async (signal) => {
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }),
    DOMException,
    undefined,
    "Expected runWithTimeout to reject with AbortError"
  );
});
