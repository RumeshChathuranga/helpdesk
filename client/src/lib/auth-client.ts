import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientOptions } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

const authClientOptions = {
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
        },
      },
    }),
  ],
} satisfies BetterAuthClientOptions;

export const authClient: ReturnType<
  typeof createAuthClient<typeof authClientOptions>
> = createAuthClient(authClientOptions);
