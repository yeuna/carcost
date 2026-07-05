"use client";

// Submit button that asks for confirmation before letting its form submit.
// Guards log-entry deletes against accidental taps (they are hard deletes,
// unlike the soft-deleted car itself).
export function ConfirmSubmitButton({
  message,
  className,
  ariaLabel,
  children,
}: {
  message: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
