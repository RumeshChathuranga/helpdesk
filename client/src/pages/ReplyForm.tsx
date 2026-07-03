import { zodResolver } from "@hookform/resolvers/zod";
import { createReplyBodySchema, FIELD_LIMITS } from "core";
import { Sparkles } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCreateReply } from "@/hooks/useCreateReply";
import { usePolishReply } from "@/hooks/usePolishReply";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";
import { FormRootErrorAlert } from "./UserAccountFormFields";

const replyFormSchema = createReplyBodySchema;

type ReplyFormValues = z.infer<typeof replyFormSchema>;

const textareaClassName = cn(
  "flex min-h-[120px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm",
  "placeholder:text-muted-foreground focus-visible:outline-none",
  "focus-visible:ring-1 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50 transition-all",
);

type ReplyFormProps = {
  ticketId: string;
};

export function ReplyForm({ ticketId }: ReplyFormProps) {
  const createMutation = useCreateReply(ticketId);
  const polishMutation = usePolishReply(ticketId);

  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema) as Resolver<ReplyFormValues>,
    defaultValues: {
      body: "",
    },
  });

  function onSubmit(values: ReplyFormValues) {
    form.clearErrors("root");
    createMutation.mutate(values, {
      onSuccess: () => {
        form.reset({ body: "" });
      },
      onError: (e) => {
        form.setError("root", { message: getErrorMessage(e) });
      },
    });
  }

  function handlePolish() {
    const draft = form.getValues("body");
    polishMutation.mutate(draft, {
      onSuccess: (polished) =>
        form.setValue("body", polished, { shouldValidate: true, shouldDirty: true }),
    });
  }

  const isPolishing = polishMutation.isPending;
  const bodyValue = form.watch("body");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
      <h2 className="mb-4 text-xs font-bold tracking-wider uppercase font-mono text-foreground">Add reply</h2>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormRootErrorAlert message={form.formState.errors.root?.message} />

          {polishMutation.isError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 font-mono">
              <span className="font-semibold text-red-500">Polish failed:</span>{" "}
              {getErrorMessage(polishMutation.error)}
            </div>
          )}

          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <textarea
                        className={cn(textareaClassName, isPolishing && "opacity-60")}
                        rows={5}
                        maxLength={FIELD_LIMITS.body}
                        placeholder="Write your reply…"
                        disabled={isPolishing}
                        {...field}
                      />
                    </FormControl>
                    {isPolishing && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm text-primary font-mono font-bold animate-pulse">
                          <svg
                            className="h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Polishing with AI…
                        </div>
                      </div>
                    )}
                  </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPolishing || !bodyValue.trim()}
              onClick={handlePolish}
              className="gap-1.5 text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/30 disabled:opacity-50 rounded-xl"
              id="polish-reply-btn"
              title="Use AI to improve your reply's grammar, clarity, and professionalism"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {isPolishing ? "Polishing…" : "Polish"}
            </Button>

            <Button
              type="submit"
              disabled={createMutation.isPending || isPolishing}
            >
              {createMutation.isPending ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
