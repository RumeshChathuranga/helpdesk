import type { CreateKnowledgeBody, KnowledgeStatus } from "core";
import { api } from "@/lib/api";

export type KnowledgeDocumentSummary = {
  id: string;
  title: string;
  status: KnowledgeStatus;
  chunkCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeChunk = {
  id: string;
  chunkIndex: number;
  text: string;
};

export type KnowledgeDocumentDetail = KnowledgeDocumentSummary & {
  text: string;
  chunks: KnowledgeChunk[];
};

export type KnowledgeListParams = {
  page: number;
  pageSize: number;
  status?: KnowledgeStatus;
  search?: string;
};

export type KnowledgeListResult = {
  documents: KnowledgeDocumentSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export const knowledgeKeys = {
  all: ["admin", "knowledge"] as const,
  list: (params: KnowledgeListParams) =>
    [...knowledgeKeys.all, "list", params] as const,
  detail: (id: string) => [...knowledgeKeys.all, "detail", id] as const,
};

type KnowledgeDetailResponse = { document: KnowledgeDocumentDetail };

export async function fetchKnowledgeDocuments(
  params: KnowledgeListParams,
): Promise<KnowledgeListResult> {
  const { data: body } = await api.get<KnowledgeListResult>("/knowledge", {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });

  if (
    !Array.isArray(body.documents) ||
    typeof body.total !== "number" ||
    typeof body.page !== "number" ||
    typeof body.pageSize !== "number"
  ) {
    throw new Error("Invalid response from server");
  }

  return body;
}

export async function fetchKnowledgeDocument(
  id: string,
): Promise<KnowledgeDocumentDetail> {
  const { data: body } = await api.get<KnowledgeDetailResponse>(
    `/knowledge/${id}`,
  );

  if (!body.document) {
    throw new Error("Invalid response from server");
  }

  return body.document;
}

export async function createKnowledgeDocument(
  values: CreateKnowledgeBody,
): Promise<void> {
  await api.post("/knowledge", values);
}

export async function deleteKnowledgeDocument(id: string): Promise<void> {
  await api.delete(`/knowledge/${id}`);
}
