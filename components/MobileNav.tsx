"use client";

import Link from "next/link";
import { Zap, Sparkles, MessageCircle, Clock, BarChart2 } from "lucide-react";

type ActiveTab = "analyze" | "picks" | "coach" | "history" | "portfolio";

const TABS: { id: ActiveTab; label: string; href: string; icon: typeof Zap }[] = [
  { id: "analyze",   label: "Analyze",   href: "/analyze",   icon: Zap },
  { id: "picks",     label: "Picks",     href: "/picks",     icon: Sparkles },
  { id: "portfolio", label: "Portfolio", href: "/portfolio", icon: BarChart2 },
  { id: "coach",     label: "Coach",     href: "/coach",     icon: MessageCircle },
  { id: "history",   label: "History",   href: "/history",   icon: Clock },
];

export default function MobileNav({ activeTab }: { activeTab: ActiveTab }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 sm:hidden z-40 border-t border-border-subtle bg-[#070d1a]/95 backdrop-blur-sm pb-4">
      <div className="flex items-stretch">
        {TABS.map(({ id, label, href, icon: Icon }) => {
          const active = id === activeTab;
          return (
            <Link
              key={id}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors relative ${
                active ? "text-[#00dc82]" : "text-[#6b7280] hover:text-white"
              }`}
            >
              {active && (
                <span className="nav-indicator absolute top-0 left-1/2 w-8 h-[2px] rounded-full bg-[#00dc82]" />
              )}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} className="transition-transform duration-150 active:scale-90" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
