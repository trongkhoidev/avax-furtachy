import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container page-wrap" style={{ textAlign: "center", padding: "80px 20px" }}>
      <p className="eyebrow">404 · Not Found</p>
      <h1 style={{ marginTop: 12 }}>Page not found</h1>
      <p className="muted" style={{ maxWidth: 480, margin: "12px auto 24px" }}>
        The requested page or market could not be found.
      </p>
      <Link href="/" className="button button-primary">
        Back to markets
      </Link>
    </div>
  );
}
