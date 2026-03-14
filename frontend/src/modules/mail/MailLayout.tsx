import { Outlet } from "react-router-dom";

export function MailLayout() {
  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden">
      <Outlet />
    </div>
  );
}
