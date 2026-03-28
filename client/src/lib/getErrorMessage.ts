import { isAxiosError } from "axios";

export function getErrorMessage(e: unknown): string {
  if (isAxiosError(e)) {
    const d = e.response?.data;
    if (
      d &&
      typeof d === "object" &&
      "error" in d &&
      typeof (d as { error: unknown }).error === "string"
    ) {
      return (d as { error: string }).error;
    }
    return e.message;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return "Something went wrong";
}
