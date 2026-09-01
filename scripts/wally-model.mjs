export const wallyOllamaUrl =
  process.env.WALLY_OLLAMA_URL ?? "http://cor-che-lt-675.local:11434/v1";
export const wallyOllamaModel =
  process.env.WALLY_OLLAMA_MODEL ?? "qwen3:4b-instruct";

const expectedModel = "qwen3:4b-instruct";

export async function verifyWallyModel() {
  if (wallyOllamaModel !== expectedModel) {
    throw new Error(
      `Wally requires ${expectedModel}; refusing configured model ${wallyOllamaModel}.`,
    );
  }

  const ollamaBase = wallyOllamaUrl.replace(/\/v1\/?$/, "");
  const response = await fetch(`${ollamaBase}/api/show`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: wallyOllamaModel }),
  });
  if (!response.ok) {
    throw new Error(
      `Wally model preflight failed at ${ollamaBase} (${response.status}).`,
    );
  }

  const manifest = await response.json();
  if (manifest?.details?.family !== "qwen3") {
    throw new Error(
      `Wally expected the qwen3 family but the remote host returned ${manifest?.details?.family ?? "unknown"}.`,
    );
  }

  console.log(`Wally model verified: ${wallyOllamaModel} on ${ollamaBase}.`);
}
