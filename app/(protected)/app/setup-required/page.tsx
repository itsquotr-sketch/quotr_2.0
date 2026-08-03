import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Controlled recovery for authenticated users without a valid company profile.
 * No organisation writes occur on this page.
 *
 * Authenticated users cannot open `/signup` (middleware redirects them), and
 * `/app/setup` requires an existing organisation — so recovery asks them to
 * sign out, then complete company signup.
 */
export default function SetupRequiredPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Company setup incomplete</CardTitle>
        <CardDescription>
          Your account is signed in, but it is not linked to a company yet.
          Complete company setup to continue using Quotr.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Sign out, then use Sign up to create your company account and finish
          setup. If you already belong to a company, ask your company owner for
          help or contact support.
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        <form action={logout}>
          <Button type="submit">Sign out to retry setup</Button>
        </form>
      </CardFooter>
    </Card>
  );
}
