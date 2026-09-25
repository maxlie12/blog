import Link from "next/link";

export default function NotFound() {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        There&apos;s nothing here yet.
      </p>
      <Link href="/" className="mt-4 inline-block underline underline-offset-2">
        Back home
      </Link>
    </div>
  );
}
