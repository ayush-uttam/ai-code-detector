let lastLlmCallTime = 0;

export async function rateLimitLlmCall() {
  const minSpacing = 4250; // 4.25 seconds spacing to stay strictly under 15 RPM
  const now = Date.now();
  const elapsed = now - lastLlmCallTime;
  if (elapsed < minSpacing) {
    const delayMs = minSpacing - elapsed;
    console.log(`[RATE LIMIT] Delaying next LLM call by ${delayMs}ms to respect the 15 RPM limit.`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  lastLlmCallTime = Date.now();
}
