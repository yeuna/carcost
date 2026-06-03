export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; min?: string }>;
}) {
  const { error, min } = await searchParams;
  const locked = error === "locked";

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        action="/api/login"
        method="POST"
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-xl ring-1 ring-white/10"
      >
        <div className="mb-6 text-center">
          <div className="text-3xl">🚗</div>
          <h1 className="mt-2 text-xl font-semibold">CarCost</h1>
          <p className="mt-1 text-sm text-zinc-400">Enter your password to continue</p>
        </div>

        {locked ? (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
            Too many attempts. Try again in {min ?? 15} minute{min === "1" ? "" : "s"}.
          </p>
        ) : (
          error && (
            <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-400">
              Incorrect password.
            </p>
          )
        )}

        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Password"
          className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-base outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-medium active:bg-blue-700"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
