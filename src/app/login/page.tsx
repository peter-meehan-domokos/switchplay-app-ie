import AuthScreen from "@/components/auth/AuthScreen";
import PublicHeader from "@/components/public-site/PublicHeader";
import PublicLayout from "@/components/public-site/PublicLayout";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSafeReturnTo } from "@/lib/returnTo";
import { getCurrentSite } from "@/lib/sites/getCurrentSite";
import { siteBrands } from "@/lib/sites/siteBrands";
import styles from "./page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();

  return { title: { absolute: `Sign in | ${siteBrands[site].titleName}` } };
}

type LoginPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo } = await searchParams;
  const redirectTo = getSafeReturnTo(returnTo);
  const user = await getCurrentUser();
  const site = await getCurrentSite();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} showStepVisualsLink={false} site={site} />
      <div className={styles.standaloneLogin}>
        <AuthScreen redirectTo={redirectTo} site={site} />
      </div>
    </PublicLayout>
  );
}
