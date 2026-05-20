import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("rr-theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("rr-theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Brand: college logo + name + app name */}
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <img
            src="/college-logo.png"
            alt="Jharsuguda Engineering School"
            className="h-10 w-10 rounded-full object-contain"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-normal text-muted-foreground tracking-wide hidden sm:block">
              Jharsuguda Engineering School
            </span>
            <span>
              Result <span className="text-gradient">Radar</span>
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {!user && (
            <>
              <Link to="/" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Home</Link>
              <Link to="/login" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Login</Link>
              <Link to="/signup" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Sign up</Link>
            </>
          )}
          {user && role === "admin" && (
            <>
              <Link to="/admin" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
              <Link to="/admin/upload" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Upload</Link>
              <Link to="/admin/all" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">All Students</Link>
              <Link to="/admin/batch" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Batch</Link>
              <Link to="/admin/subject" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Subject</Link>
              <Link to="/admin/manage" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Manage</Link>
            </>
          )}
          {user && role === "student" && (
            <Link to="/student" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">My Results</Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          ) : (
            <Button asChild variant="hero" size="sm">
              <Link to="/login">Get started</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Hide Lovable's injected floating badge */}
      <style>{`
        [data-lovable-badge],
        #lovable-badge,
        .lovable-badge,
        a[href*="lovable.app"][style*="position: fixed"],
        a[href*="lovable.dev"][style*="position: fixed"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
    </header>
  );
}
