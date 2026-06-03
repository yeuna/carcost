import Link from "next/link";

export function Header({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        {back ? (
          <Link href={back.href} className="text-sm text-zinc-400 active:text-white">
            ‹ {back.label}
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span>🚗</span> CarCost
          </Link>
        )}
        <form action="/api/logout" method="POST">
          <button className="text-sm text-zinc-500 active:text-white">Log out</button>
        </form>
      </div>
    </header>
  );
}
