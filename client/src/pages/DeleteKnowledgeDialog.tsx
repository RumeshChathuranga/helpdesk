import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useKnowledge } from "@/hooks/useKnowledge";
import type { KnowledgeChunk } from "@/lib/knowledge";

interface DeleteKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chunk: KnowledgeChunk | null;
}

export function DeleteKnowledgeDialog({
  open,
  onOpenChange,
  chunk,
}: DeleteKnowledgeDialogProps) {
  const { deleteKnowledge, isDeleting } = useKnowledge();

  if (!chunk) return null;

  async function handleDelete() {
    try {
      await deleteKnowledge(chunk!.id);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      // Could add a toast here
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Knowledge Chunk</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this knowledge chunk? The AI will no longer use it for context when answering tickets.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted p-4 rounded-md text-sm text-muted-foreground overflow-hidden">
          <p className="truncate line-clamp-3 whitespace-pre-wrap">{chunk.text}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Chunk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
