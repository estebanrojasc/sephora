import Image from "next/image";
import Link from "next/link";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  href?: string;
  /** Muestra el nombre del producto junto al logo. */
  showName?: boolean;
  /** Estilo del nombre: sutil en chrome, gradiente solo en hero/marketing. */
  nameVariant?: "subtle" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

const SIZE = {
  sm: { h: 24, w: 88 },
  md: { h: 32, w: 118 },
  lg: { h: 44, w: 162 },
} as const;

export function BrandLogo({
  href,
  showName = true,
  nameVariant = "subtle",
  size = "md",
  className,
  onClick,
}: BrandLogoProps) {
  const dims = SIZE[size];

  const inner = (
    <>
      <Image
        src={BRAND_LOGO_SRC}
        alt="404LAB"
        width={dims.w}
        height={dims.h}
        className="brand-logo h-auto w-auto"
        style={{ height: dims.h, width: "auto", maxWidth: dims.w }}
        priority
      />
      {showName && (
        <span
          className={cn(
            "font-display font-semibold tracking-tight",
            nameVariant === "subtle" && "text-foreground/90",
            nameVariant === "accent" && "text-gradient-sunset",
            size === "lg" && "text-2xl sm:text-3xl",
            size === "md" && "text-lg",
            size === "sm" && "text-sm"
          )}
        >
          {BRAND_NAME}
        </span>
      )}
    </>
  );

  const wrapperClass = cn(
    "inline-flex min-w-0 items-center gap-2.5",
    className
  );

  if (href) {
    return (
      <Link href={href} className={wrapperClass} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={wrapperClass} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={wrapperClass}>{inner}</div>;
}
