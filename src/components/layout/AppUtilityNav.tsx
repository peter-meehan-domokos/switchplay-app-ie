import Link from "next/link";

type AppUtilityNavProps = {
  className?: string;
};

export default function AppUtilityNav({ className }: AppUtilityNavProps) {
  return (
    <nav className={className ?? "app-utility-nav"} aria-label="App contact navigation">
      <Link href="/">Home</Link>
      <Link href="/contact">Contact</Link>
    </nav>
  );
}
