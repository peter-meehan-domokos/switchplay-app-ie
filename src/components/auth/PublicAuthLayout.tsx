import AuthScreen from "@/components/auth/AuthScreen";
import PublicHeader from "@/components/public-site/PublicHeader";
import PublicLayout from "@/components/public-site/PublicLayout";

type PublicAuthLayoutProps = {
  authScreenWrapperClassName?: string;
  redirectTo?: string;
};

export default function PublicAuthLayout({ authScreenWrapperClassName, redirectTo }: PublicAuthLayoutProps) {
  const authScreen = <AuthScreen redirectTo={redirectTo} />;

  return (
    <PublicLayout>
      <PublicHeader showJoinLink={false} />
      {authScreenWrapperClassName ? <div className={authScreenWrapperClassName}>{authScreen}</div> : authScreen}
    </PublicLayout>
  );
}
