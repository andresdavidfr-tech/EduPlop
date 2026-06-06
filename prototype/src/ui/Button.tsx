import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";

const CLASS: Record<Variant, string> = {
  primary: "primary",
  secondary: "ghost",
  ghost: "ghost",
  danger: "ghost danger",
  link: "link",
};

/**
 * Botón del sistema de diseño: unifica variantes y agrega estado de carga
 * accesible (aria-busy + spinner). Mapea a las clases existentes para mantener
 * el look y permitir una migración gradual.
 */
export function Button({
  variant = "secondary", big, loading, children, className, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean; loading?: boolean; children: ReactNode }) {
  const cls = `${CLASS[variant]}${big ? " big" : ""}${className ? ` ${className}` : ""}`;
  return (
    <button className={cls} aria-busy={loading || undefined} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" style={{ marginRight: 8, verticalAlign: "-2px" }} />}
      {children}
    </button>
  );
}
