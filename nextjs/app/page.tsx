import { ComposeForm } from "./compose-form";

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Compose & post</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Submits a text + optional image to bundle.social via a server action.
          Uses{" "}
          <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">
            upload.uploadCreate
          </code>{" "}
          and{" "}
          <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">
            post.postCreate
          </code>
          .
        </p>
      </header>
      <ComposeForm />
    </div>
  );
}
