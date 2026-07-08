import { useState } from "react";
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

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddKnowledgeDialog({ open, onOpenChange }: AddKnowledgeDialogProps) {
  const { addKnowledge, isAdding } = useKnowledge();
  const [text, setText] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      await addKnowledge(text);
      setText("");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      // Optional: error toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add to Knowledge Base</DialogTitle>
            <DialogDescription>
              Paste the text or documentation you want the AI to use. The background worker will generate embeddings and make it searchable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <textarea
              placeholder="Enter knowledge chunk here..."
              className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isAdding || !text.trim()}>
              {isAdding ? "Queueing..." : "Add Knowledge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
