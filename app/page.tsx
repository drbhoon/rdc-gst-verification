import { chatGPTSignOutPath } from "./chatgpt-auth";
import { getAdminEmails, getRole, resolveAppUser } from "@/lib/auth";
import { VerificationWorkspace } from "./verification-workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await resolveAppUser();
  const role = getRole(user);
  const adminList = getAdminEmails();

  const currentUser = {
    displayName: user.displayName,
    email: user.email,
    role: role as "Admin" | "Checker",
    availableAdmins: adminList,
  };
  const signOutPath = chatGPTSignOutPath("/");

  return <VerificationWorkspace user={currentUser} signOutPath={signOutPath} />;
}
