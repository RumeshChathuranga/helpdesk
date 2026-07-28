import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { KnowledgeStatus } from "core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/Pagination";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useKnowledge } from "@/hooks/useKnowledge";
import { AddKnowledgeDialog } from "./AddKnowledgeDialog";
import { DeleteKnowledgeDialog } from "./DeleteKnowledgeDialog";
import type { KnowledgeDocumentSummary } from "@/lib/knowledge";

const STATUS_STYLES: Record<KnowledgeStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PROCESSING: "bg-brand-100 text-brand-700",
  READY: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  PENDING: "Queued",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
};

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function KnowledgePage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<KnowledgeDocumentSummary | null>(null);

  const {
    documents,
    searchInput,
    setSearchInput,
    page,
    pageSize,
    total,
    setPage,
    isPending,
    isError,
    error,
    isSuccess,
  } = useKnowledge();

  const hasSearch = searchInput.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the documents the AI uses to resolve tickets. Each document is
            split into passages and embedded for semantic search.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-xl"
          onClick={() => setIsAddOpen(true)}
        >
          Add Knowledge
        </Button>
      </div>

      <AddKnowledgeDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      <DeleteKnowledgeDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        document={deleteTarget}
      />

      <div className="max-w-sm">
        <Input
          type="search"
          aria-label="Search knowledge documents"
          placeholder="Search documents…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load knowledge documents</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isSuccess && documents.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {hasSearch ? "No matching documents" : "No knowledge found"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {hasSearch
              ? "Try a different search term."
              : "Add information to help the AI better understand how to solve incoming tickets."}
          </p>
          {!hasSearch && (
            <Button onClick={() => setIsAddOpen(true)} variant="outline">
              Add your first document
            </Button>
          )}
        </div>
      )}

      {isSuccess && documents.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group relative bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-foreground line-clamp-2">
                    {doc.title}
                  </h2>
                  <StatusBadge status={doc.status} />
                </div>

                {doc.status === "FAILED" && doc.error && (
                  <p className="mt-3 text-xs text-destructive line-clamp-3">
                    {doc.error}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {doc.chunkCount}{" "}
                    {doc.chunkCount === 1 ? "passage" : "passages"} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${doc.title}`}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    onClick={() => setDeleteTarget(doc)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            ariaLabel="Knowledge pagination"
          />
        </>
      )}
    </div>
  );
}
