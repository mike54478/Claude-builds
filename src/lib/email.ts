import { Resend } from "resend";

let _resend: Resend | undefined;

function resend() {
  _resend ??= new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id: string | null }> {
  const { data, error } = await resend().emails.send({
    from: process.env.EMAIL_FROM ?? "Repruv <requests@mail.repruv.dev>",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id ?? null };
}

export function reviewRequestEmailHtml(input: {
  firstName: string;
  businessName: string;
  link: string;
}): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <p>Hi ${input.firstName},</p>
  <p>Thanks for choosing ${input.businessName}. How did we do?</p>
  <p style="margin:24px 0">
    <a href="${input.link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
      Share your experience
    </a>
  </p>
  <p style="color:#666;font-size:13px">It takes under a minute — and it genuinely helps our small team.</p>
</div>`;
}
