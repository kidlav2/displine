import { toast } from "sonner";

// Low-stakes confirmations auto-dismiss; errors stay until the user closes them.
export const notify = {
  success: (message: string) => toast.success(message, { duration: 2500 }),
  error: (message: string) => toast.error(message, { duration: Infinity, closeButton: true }),
};

/** Runs a write and reports a failure instead of swallowing it. */
export async function withErrorToast<T>(action: () => Promise<T>, message: string): Promise<T | undefined> {
  try {
    return await action();
  } catch (err) {
    console.error(message, err);
    notify.error(message);
    return undefined;
  }
}
