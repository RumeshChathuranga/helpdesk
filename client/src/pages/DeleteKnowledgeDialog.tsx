import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useKnowledge } from "@/hooks/useKnowledge";
import type { KnowledgeDocumentSummary } from "@/lib/knowledge";

type DeleteKnowledgeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: KnowledgeDocumentSummary | null;
};

export function DeleteKnowledgeDialog({
  open,
  onOpenChange,
  // Aliased so it doesn't shadow the global `document`.
  document: doc,
}: DeleteKnowledgeDialogProps) {
  const { deleteKnowledge, isDeleting } = useKnowledge();
  const [error, setError] = useState<string | null>(null);

  if (!doc) return null;

  async function handleDelete() {
    if (!doc) return;
    setError(null);
    try {
      await deleteKnowledge(doc.id);
      onOpenChange(false);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete knowledge document</DialogTitle>
          <DialogDescription>
            This deletes “{doc.title}” and its {doc.chunkCount} embedded{" "}
            {doc.chunkCount === 1 ? "passage" : "passages"}. The AI will no
            longer use it as context when answering tickets.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
