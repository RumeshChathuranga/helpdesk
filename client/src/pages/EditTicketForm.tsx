import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import {
  ticketCategorySchema,
  ticketStatusSchema,
  type TicketCategory,
  type TicketStatus,
} from "core";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { getErrorMessage } from "@/lib/getErrorMessage";
import type { AgentListItem, TicketDetail } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { useAgents, useUpdateTicket } from "@/hooks/useUpdateTicket";
import { FormRootErrorAlert } from "./UserAccountFormFields";
import { CATEGORY_LABEL, STATUS_LABEL } from "./TicketsTable";

const selectClassName = cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);

const editTicketFormSchema = z.object({
  status: ticketStatusSchema,
  category: ticketCategorySchema,
  assigneeId: z.string(),
});

type EditTicketFormValues = z.infer<typeof editTicketFormSchema>;

type EditTicketFormProps = {
  ticket: TicketDetail;
};

export function EditTicketForm({ ticket }: EditTicketFormProps) {
  const { agents } = useAgents();
  const updateMutation = useUpdateTicket(ticket.id);

  const form = useForm<EditTicketFormValues>({
    resolver: zodResolver(editTicketFormSchema) as Resolver<EditTicketFormValues>,
    defaultValues: {
      status: ticket.status,
      category: ticket.category,
      assigneeId: ticket.assignedToId ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      status: ticket.status,
      category: ticket.category,
      assigneeId: ticket.assignedToId ?? "",
    });
  }, [ticket, form]);

  async function onSubmit(values: EditTicketFormValues) {
    form.clearErrors("root");
    try {
      await updateMutation.mutateAsync({
        status: values.status,
        category: values.category,
        assignedToId:
          values.assigneeId === "" ? null : values.assigneeId,
      });
    } catch (e) {
      form.setError("root", { message: getErrorMessage(e) });
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">
        Edit ticket
      </h2>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormRootErrorAlert message={form.formState.errors.root?.message} />

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <select className={selectClassName} {...field}>
                      {ticketStatusSchema.options.map((value: TicketStatus) => (
                        <option key={value} value={value}>
                          {STATUS_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <select className={selectClassName} {...field}>
                      {ticketCategorySchema.options.map(
                        (value: TicketCategory) => (
                          <option key={value} value={value}>
                            {CATEGORY_LABEL[value]}
                          </option>
                        ),
                      )}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <FormControl>
                    <select className={selectClassName} {...field}>
                      <option value="">Unassigned</option>
                      {agents.map((agent: AgentListItem) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
