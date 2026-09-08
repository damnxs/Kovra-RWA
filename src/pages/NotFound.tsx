import { Link } from 'react-router-dom';
import { LuArrowRight } from 'react-icons/lu';

/** Plain 404: bad URLs get an honest page, never a silent homepage. */
export function NotFound() {
  return (
    <div className="fade-in mx-auto flex max-w-content flex-1 flex-col items-start justify-center px-5 py-24 sm:px-8 lg:px-12">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-serif font-light text-[36px] leading-tight sm:text-[44px]">
        Nothing here.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        This address does not exist. The link may be old, or the URL mistyped.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Link
          to="/"
          className="flex h-11 items-center whitespace-nowrap rounded-control bg-accent px-5 text-[15px] font-semibold text-ink transition-transform hover:-translate-y-px"
        >
          Back to home
        </Link>
        <Link
          to="/markets"
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-[15px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Browse markets <LuArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
