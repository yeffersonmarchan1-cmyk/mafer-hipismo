import Image from "next/image";

export function BrandMark({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <Image
      alt=""
      className={className}
      height={size}
      src="/pwa/brand-mark.png"
      width={size}
    />
  );
}
