import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

function Tabs({ value, onValueChange, className, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-11 items-center rounded-full border border-border/70 bg-[rgba(255,250,242,0.74)] p-1 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        className,
      )}
      {...props}
    />
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }

  const active = context.value === value;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 font-label text-[10px] uppercase tracking-[0.22em] transition-all",
        active
          ? "bg-card text-foreground shadow-[0_10px_24px_rgba(53,39,21,0.1)]"
          : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
        className,
      )}
      data-state={active ? "active" : "inactive"}
      onClick={() => context.setValue(value)}
      type="button"
      {...props}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }

  if (context.value !== value) {
    return null;
  }

  return (
    <div className={cn("outline-none", className)} {...props}>
      {children}
    </div>
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
