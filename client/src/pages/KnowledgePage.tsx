import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useKnowledge } from "@/hooks/useKnowledge";
import { AddKnowledgeDialog } from "./AddKnowledgeDialog";
import { DeleteKnowledgeDialog } from "./DeleteKnowledgeDialog";
import type { KnowledgeChunk } from "@/lib/knowledge";
import { Trash2 } from "lucide-react";

export function KnowledgePage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteChunk, setDeleteChunk] = useState<KnowledgeChunk | null>(null);

  const { chunks, isPending, isError, error, isSuccess } = useKnowledge();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the text snippets and documents the AI uses to resolve tickets.
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
        open={!!deleteChunk}
        onOpenChange={(open) => {
          if (!open) setDeleteChunk(null);
        }}
        chunk={deleteChunk}
      />

      {isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load knowledge chunks</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
      )}

      {isSuccess && chunks.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">No knowledge found</h3>
          <p className="text-muted-foreground mb-6">
            Add information to help the AI better understand how to solve incoming tickets.
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline">
            Add your first knowledge chunk
          </Button>
        </div>
      )}

      {isSuccess && chunks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chunks.map((chunk) => (
            <div
              key={chunk.id}
              className="group relative bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col"
            >
              <div className="flex-1 overflow-hidden">
                <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-6">
                  {chunk.text}
                </p>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-mono">
                  ID: {chunk.id.slice(0, 8)}...
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteChunk(chunk)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
