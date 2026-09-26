export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__quote">
        &ldquo;A better developer, a clearer communicator, a more curious human.&rdquo;
      </p>
      <p className="site-footer__meta">
        <span>IDEAS</span>
        <span aria-hidden="true">/</span>
        <span>CODE</span>
        <span aria-hidden="true">/</span>
        <span>LANGUAGE</span>
        <span aria-hidden="true">/</span>
        <span>A BRIGHTER TOMORROW</span>
      </p>
      <p className="site-footer__source">
        Built in the open.{" "}
        <a href="https://github.com/maxlie12/blog">Source on GitHub</a>.
      </p>
    </footer>
  );
}
