import { type ChatGPTUser, getChatGPTUser } from "@/app/chatgpt-auth";

export type AppRole = "Admin" | "Checker";

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getRole(user: ChatGPTUser): AppRole {
  const admins = getAdminEmails();
  // If no admin emails specified or user's email is in admin list, grant Admin
  if (admins.length === 0) return "Admin";
  return admins.includes(user.email.toLowerCase()) ? "Admin" : "Checker";
}

export async function resolveAppUser(request?: Request): Promise<ChatGPTUser> {
  // 1. Check for real ChatGPT headers if running inside ChatGPT iframe
  try {
    const chatgptUser = await getChatGPTUser();
    if (chatgptUser) return chatgptUser;
  } catch {
    // Outside of Next request context
  }

  const admins = getAdminEmails();

  // 2. Check if client explicitly passed an admin/user email header (e.g. switcher)
  let customEmail: string | null = null;
  if (request) {
    customEmail = request.headers.get("x-user-email");
  }

  // 3. Fallback to first admin email in ADMIN_EMAILS, or default test admin
  const targetEmail = (customEmail && customEmail.trim().toLowerCase()) || admins[0] || "admin@rdc.local";
  const namePart = targetEmail.split("@")[0];
  const cleanName = namePart
    .split(/[._-]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  return {
    userId: `user-${targetEmail.replace(/[^a-z0-9]/g, "-")}`,
    displayName: `${cleanName}`,
    email: targetEmail,
    fullName: cleanName,
  };
}
