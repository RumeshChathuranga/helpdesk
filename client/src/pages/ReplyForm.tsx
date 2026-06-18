import { zodResolver } from "@hookform/resolvers/zod";
import { createReplyBodySchema } from "core";
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
import { getErrorMessage } from "@/lib/getErrorMessage";
import { cn } from "@/lib/utils";
import { FormRootErrorAlert } from "./UserAccountFormFields";

const replyFormSchema = createReplyBodySchema;

type ReplyFormValues = z.infer<typeof replyFormSchema>;

const textareaClassName = cn(
  "flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

type ReplyFormProps = {
  ticketId: string;
};

export function ReplyForm({ ticketId }: ReplyFormProps) {
  const createMutation = useCreateReply(ticketId);

  const form = useForm<ReplyFormValues>({
    resolver: zodResolver(replyFormSchema) as Resolver<ReplyFormValues>,
    defaultValues: {
      body: "",
    },
  });

  async function onSubmit(values: ReplyFormValues) {
    form.clearErrors("root");
    try {
      await createMutation.mutateAsync(values);
      form.reset({ body: "" });
    } catch (e) {
      form.setError("root", { message: getErrorMessage(e) });
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Add reply</h2>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormRootErrorAlert message={form.formState.errors.root?.message} />

          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <textarea
                    className={textareaClassName}
                    rows={5}
                    placeholder="Write your reply…"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
