import Link from "next/link";
import { Activity, AlertTriangle, Boxes, CircleDot, PlayCircle, RefreshCcw } from "lucide-react";
import { cx } from "../lib/format";

const items = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/orders", label: "Pedidos", icon: Boxes },
  { href: "/issues", label: "Pendências", icon: AlertTriangle },
  { href: "/reprocess", label: "Reprocessamento", icon: RefreshCcw },
  { href: "/steps", label: "Passo a passo", icon: PlayCircle },
];

export function Nav({ pathname }: { pathname: string }) {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden="true">
          <CircleDot size={18} />
        </span>
        <div>
          <span className="sidebar__eyebrow">Operação</span>
          <strong>Integração J&T</strong>
        </div>
      </div>

      <div className="sidebar__links">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx("sidebar__link", active && "sidebar__link--active")}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
