import AuthScreen from "@/components/auth/AuthScreen";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSafeReturnTo } from "@/lib/returnTo";

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

  return <AuthScreen redirectTo={redirectTo} />;
}
