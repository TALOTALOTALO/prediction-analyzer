"use client";

import Link from "next/link";
import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { Zap, Sparkles, BarChart2, MessageCircle, Clock } from "lucide-react";

type ActiveTab = "analyze" | "picks" | "portfolio" | "coach" | "history";

const TABS: { id: ActiveTab; label: string; href: string; icon: typeof Zap }[] = [
  { id: "analyze",   label: "Analyze",   href: "/analyze",   icon: Zap },
  { id: "picks",     label: "Picks",     href: "/picks",     icon: Sparkles },
  { id: "portfolio", label: "Portfolio", href: "/portfolio", icon: BarChart2 },
  { id: "coach",     label: "Coach",     href: "/coach",     icon: MessageCircle },
  { id: "history",   label: "History",   href: "/history",   icon: Clock },
];

export default function DashboardNav({ activeTab }: { activeTab: ActiveTab }) {
  return (
    <nav className="border-b border-border-subtle px-4 sm:px-6 bg-[#070d1a]/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center gap-2 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <Image src="/logo-icon.png" alt="FadeMe" width={22} height={22} className="rounded-md" />
          <span className="text-white font-semibold tracking-tight text-sm">
            Fade<span className="text-[#00dc82]">Me</span>
          </span>
        </Link>

        {/* Tab links — desktop only (mobile uses bottom MobileNav) */}
        <div className="hidden sm:flex items-center gap-0.5 flex-1">
          {TABS.map(({ id, label, href, icon: Icon }) => {
            const active = id === activeTab;
            return (
              <Link
                key={id}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "text-[#00dc82] bg-[#00dc82]/10"
                    : "text-text-dim hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={14} strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* UserButton */}
        <div className="ml-auto">
          <UserButton />
        </div>
      </div>
    </nav>
  );
}
