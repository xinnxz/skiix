/**
 * Supabase Auth "Send Email" hook — sends OTP via Resend REST API.
 * Replaces broken custom SMTP (avoids "Error sending confirmation email").
 *
 * Deploy: supabase functions deploy send-email --no-verify-jwt
 * Secrets: RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET, AUTH_EMAIL_FROM (optional)
 * Dashboard: Authentication → Hooks → Send Email → this function URL
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
const hookSecretRaw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const hookSecret = hookSecretRaw.replace(/^v1,whsec_/, "");
const fromEmail =
  Deno.env.get("AUTH_EMAIL_FROM") ?? "Skiix <onboarding@resend.dev>";

type EmailAction =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "email_change_new"
  | "reauthentication";

const subjects: Record<EmailAction, string> = {
  signup: "Your Skiix verification code",
  recovery: "Reset your Skiix password",
  invite: "You are invited to Skiix",
  magiclink: "Your Skiix sign-in code",
  email_change: "Confirm your Skiix email change",
  email_change_new: "Confirm your new Skiix email",
  reauthentication: "Your Skiix verification code",
};

function buildBody(action: EmailAction, token: string, tokenNew: string): string {
  const code = token || tokenNew;
  switch (action) {
    case "signup":
      return `Welcome to Skiix!\n\nYour verification code is: ${code}\n\nEnter this 6-digit code in the app. It expires in about an hour.\n\nIf you did not create an account, you can ignore this email.`;
    case "recovery":
      return `Reset your Skiix password.\n\nYour code is: ${code}\n\nEnter it in the app to continue.`;
    case "magiclink":
      return `Sign in to Skiix.\n\nYour code is: ${code}\n\nEnter it in the app.`;
    default:
      return `Your Skiix code is: ${code}`;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  if (!Deno.env.get("RESEND_API_KEY")) {
    return new Response(
      JSON.stringify({
        error: { message: "RESEND_API_KEY is not set on the edge function" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!hookSecret) {
    return new Response(
      JSON.stringify({
        error: { message: "SEND_EMAIL_HOOK_SECRET is not set" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const { user, email_data } = wh.verify(payload, headers) as {
      user: { email: string };
      email_data: {
        token: string;
        token_new: string;
        email_action_type: EmailAction;
      };
    };

    const action = email_data.email_action_type;
    const token = email_data.token || email_data.token_new || "";
    const subject = subjects[action] ?? "Your Skiix verification code";
    const text = buildBody(action, email_data.token, email_data.token_new);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      subject,
      text,
    });

    if (error) {
      console.error("[send-email] Resend error:", error);
      return new Response(
        JSON.stringify({
          error: {
            http_code: (error as { statusCode?: number }).statusCode ?? 500,
            message: error.message ?? "Resend failed to send email",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-email] hook error:", message);
    return new Response(
      JSON.stringify({ error: { message } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
});
