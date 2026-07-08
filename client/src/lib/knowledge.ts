import axios from "axios";

export type KnowledgeChunk = {
  id: string;
  text: string;
};

export type KnowledgeResponse = { chunks: KnowledgeChunk[] };

export const knowledgeKeys = {
  all: ["admin", "knowledge"] as const,
};

export async function fetchKnowledge(): Promise<KnowledgeChunk[]> {
  const { data } = await axios.get<KnowledgeResponse>("/api/knowledge", {
    withCredentials: true,
  });
  if (!Array.isArray(data.chunks)) {
    throw new Error("Invalid response from server");
  }
  return data.chunks;
}

export async function addKnowledge(text: string): Promise<void> {
  await axios.post(
    "/api/knowledge",
    { text },
    { withCredentials: true }
  );
}

export async function deleteKnowledge(id: string): Promise<void> {
  await axios.delete(`/api/knowledge/${id}`, { withCredentials: true });
}
