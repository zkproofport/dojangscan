// The surrounding link/button supplies the accessible name.
export function ZkProofportLogo({ size = 16 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/zkproofport.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}
