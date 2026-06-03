import { MemoryClient } from "mem0ai";

const apiKey = process.env.MEM0_API_KEY?.trim();

const mem0 = apiKey
  ? new MemoryClient({
      apiKey,
    })
  : null;

export async function getMemories(userId: string): Promise<string> {
  if (!mem0 || !userId) {
    return "";
  }

  try {
    const memories = await mem0.search("company department roles change risks org structure AI readiness", {
      user_id: userId,
    });

    if (!Array.isArray(memories) || memories.length === 0) {
      return "";
    }

    return memories
      .map((memory) => (memory && typeof memory === "object" && "memory" in memory ? String(memory.memory || "").trim() : ""))
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    console.error("Mem0 search error:", error);
    return "";
  }
}

export async function saveMemory(userId: string, userMessage: string, assistantMessage: string): Promise<void> {
  if (!mem0 || !userId || !userMessage || !assistantMessage) {
    return;
  }

  try {
    await mem0.add(
      [
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage },
      ],
      { user_id: userId },
    );
  } catch (error) {
    console.error("Mem0 save error:", error);
  }
}
