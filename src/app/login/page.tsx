import AuthScreen from "@/components/auth/AuthScreen";
import PublicHeader from "@/components/public-site/PublicHeader";
import PublicLayout from "@/components/public-site/PublicLayout";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSafeReturnTo } from "@/lib/returnTo";
import styles from "./page.module.css";

type LoginPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnTo } = await searchParams;
  const redirectTo = getSafeReturnTo(returnTo);
  const user = await getCurrentUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      <div className={styles.standaloneLogin}>
        <AuthScreen redirectTo={redirectTo} />
      </div>
    </PublicLayout>
  );
}
