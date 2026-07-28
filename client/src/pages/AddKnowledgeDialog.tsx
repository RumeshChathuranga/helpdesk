import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  FIELD_LIMITS,
  createKnowledgeBodySchema,
  type CreateKnowledgeBody,
} from "core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { useKnowledge } from "@/hooks/useKnowledge";
import { FormRootErrorAlert } from "./UserAccountFormFields";

type AddKnowledgeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddKnowledgeDialog({ open, onOpenChange }: AddKnowledgeDialogProps) {
  const { addKnowledge, isAdding } = useKnowledge();

  const form = useForm<CreateKnowledgeBody>({
    resolver: zodResolver(createKnowledgeBodySchema),
    defaultValues: { title: "", text: "" },
  });

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      form.reset();
      form.clearErrors("root");
    }
  }

  async function onSubmit(values: CreateKnowledgeBody) {
    form.clearErrors("root");
    try {
      await addKnowledge(values);
      onOpenChange(false);
      form.reset();
    } catch (e) {
      form.setError("root", { message: getErrorMessage(e) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add to Knowledge Base</DialogTitle>
          <DialogDescription>
            Paste the article or documentation you want the AI to use. A
            background worker splits it into passages and embeds each one, so
            long documents are fine.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormRootErrorAlert message={form.formState.errors.root?.message} />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Refund policy"
                      maxLength={FIELD_LIMITS.subject}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the full article text here…"
                      className="min-h-[220px]"
                      maxLength={FIELD_LIMITS.body}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Up to {FIELD_LIMITS.body.toLocaleString()} characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? "Adding…" : "Add Knowledge"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
