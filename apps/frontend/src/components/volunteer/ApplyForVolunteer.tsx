import { Link } from "react-router-dom";

interface ApplyForVolunteerProps {
  className?: string;
  /** If true, render as Link to volunteer sign-in; otherwise as button (for use in header). */
  asLink?: boolean;
}

export function ApplyForVolunteer({ className = "", asLink = true }: ApplyForVolunteerProps) {
  const baseClass =
    "inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-sm tracking-wide rounded-lg transition-colors duration-200";

  if (asLink) {
    return (
      <Link to="/volunteer-apply" className={`${baseClass} ${className}`}>
        <span>APPLY FOR VOLUNTEER</span>
      </Link>
    );
  }

  return (
    <button type="button" className={`${baseClass} ${className}`}>
      <span>APPLY FOR VOLUNTEER</span>
    </button>
  );
}
