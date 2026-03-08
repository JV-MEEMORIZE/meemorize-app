"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string; // emoji (pictogramme simple)
  description: string; // aide (texte court sous le label)
};

export default function AppNav() {
  const pathname = usePathname(); // pathname (chemin URL = page actuelle)

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠", description: "Vue d’ensemble" },
    { href: "/timeline", label: "Frise", icon: "🕰️", description: "Périodes & événements" },
    { href: "/memories", label: "Souvenirs", icon: "💭", description: "Raconter & dicter" },
    { href: "/chapters", label: "Chapitres", icon: "📖", description: "Écrire le livre" },
    { href: "/people", label: "Personnes", icon: "👥", description: "Contacts & témoins" },
  ];

  return (
    <nav
      aria-label="Navigation"
      style={{
        position: "sticky", // sticky (collant = reste visible)
        top: 0,
        zIndex: 50, // zIndex (ordre d’empilement = au-dessus du contenu)
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(6px)", // blur (flou = effet vitre)
        border: "1px solid #eee",
        borderRadius: 14,
        padding: 10,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {items.map((it) => {
          const isActive =
            pathname === it.href ||
            (it.href !== "/dashboard" && pathname?.startsWith(it.href)); // startsWith (préfixe = sous-pages)

          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                textDecoration: "none",
                color: "inherit",
                flex: "1 1 170px",
                minWidth: 170,
              }}
            >
              <div
                role="button"
                aria-current={isActive ? "page" : undefined}
                style={{
                  borderRadius: 14,
                  border: isActive ? "2px solid #111" : "1px solid #e5e7eb",
                  background: isActive ? "#f3f4f6" : "#fff",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: isActive ? "0 1px 0 rgba(0,0,0,0.06)" : "none",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    background: isActive ? "#fff" : "#fafafa",
                    flex: "0 0 auto",
                  }}
                >
                  {it.icon}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.1 }}>
                    {it.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.8,
                      lineHeight: 1.2,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={it.description}
                  >
                    {it.description}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}