import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Телефонная книга" },
  { to: "/birthdays", label: "Дни рождения" },
  { to: "/org", label: "Оргструктура" },
  { to: "/hr", label: "HR-панель" },
  { to: "/audit", label: "Аудит" },
];

export function Nav() {
  return (
    <nav style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid #ddd" }}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          style={({ isActive }) => ({
            color: isActive ? "#1d4ed8" : "#1f2937",
            textDecoration: "none",
            fontWeight: 600,
          })}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
