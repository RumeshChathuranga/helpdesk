import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FIELD_LIMITS, loginBodySchema, type LoginBody } from "core";
import { authClient } from "@/lib/auth-client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginPage() {
  const navigate = useNavigate();

  const form = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginBody) {
    const { error: authError } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      form.setError("root", { message: authError.message ?? "Login failed" });
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#070A0F] text-foreground relative overflow-hidden p-4">
      {/* Glow backgrounds */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 select-none">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-mono font-black text-xl shadow-[0_0_25px_rgba(59,130,246,0.45)]">
              H
            </div>
            <span className="font-mono text-xl font-extrabold tracking-wider text-foreground">
              HELPDESK<span className="text-primary font-black">.OS</span>
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            Terminal Triage Environment
          </p>
        </div>

        <Card className="border border-border bg-card/60 backdrop-blur-md shadow-2xl rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <CardHeader className="space-y-1.5 p-6 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground text-center">Sign in</CardTitle>
            <CardDescription className="text-center font-mono text-xs text-muted-foreground">Authorized personnel access only</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            {form.formState.errors.root && (
              <Alert variant="destructive" className="mb-4 border-red-500/20 bg-red-500/5">
                <AlertDescription className="text-red-400 font-mono text-xs">
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          autoComplete="email"
                          maxLength={FIELD_LIMITS.email}
                          placeholder="you@company.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          maxLength={FIELD_LIMITS.password}
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
