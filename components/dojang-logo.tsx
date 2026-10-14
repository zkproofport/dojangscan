export function DojangWordmark() {
  return <span className="dojang-wordmark">Dojangscan</span>;
}

/** The mark is decorative when paired with the Dojangscan wordmark. */
export function DojangLogo() {
  const base = import.meta.env.BASE_URL;
  return (
    <span className="dojang-logo" aria-hidden="true">
      <img
        className="dojang-logo-light"
        src={`${base}brand/dojang-scan.svg?v=6`}
        alt=""
        width="64"
        height="64"
      />
      <img
        className="dojang-logo-dark"
        src={`${base}brand/dojang-scan-dark.svg?v=6`}
        alt=""
        width="64"
        height="64"
      />
    </span>
  );
}
