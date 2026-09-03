const SANS  = `'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif`;
const MONO  = `'IBM Plex Mono',ui-monospace,monospace`;
const SERIF = `'Playfair Display',Georgia,serif`;

const GF_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;700&family=IBM+Plex+Mono:wght@400;700&family=Playfair+Display:ital@1&display=swap');`;

// ── Shared blocks ─────────────────────────────────────────────────────────────

const LOGO = `
  <tr>
    <td style="padding:40px 48px 32px;">
      <img src="https://lab.djandykofficial.com/logo-3d.png" alt="Andy'K Music Lab" width="200" style="display:block;margin:0 auto 24px auto;" />
    </td>
  </tr>
  <tr><td style="height:1px;background:#e5e5e5;font-size:0;line-height:0;">&nbsp;</td></tr>`;

const FOOTER = `
  <tr><td style="height:1px;background:#e5e5e5;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr>
    <td style="padding:24px 48px 28px;">
      <p style="margin:0;font-family:${MONO};font-size:10px;color:#a3a3a3;letter-spacing:0.08em;text-transform:uppercase;line-height:1.7;">
        &#8471; &amp; &copy; 2026 ANDY&rsquo;K GROUP INTERNATIONAL LTD
      </p>
    </td>
  </tr>`;

function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${GF_IMPORT}</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:${SANS};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;">
        ${LOGO}
        ${inner}
        ${FOOTER}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Subscription lifecycle emails ────────────────────────────────────────────

export function expiryWarningHtml(planLabel: string, expiresAt: string): string {
  const dateStr = new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">
      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">ACCESS EXPIRING SOON</p>
      <h1 style="margin:0 0 28px;font-family:${SANS};font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.25;">Your access expires in 7 days</h1>
      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;color:#111111;line-height:1.75;">
        Your <strong>${planLabel}</strong> access to Andy&rsquo;K Music Lab will expire on <strong>${dateStr}</strong>. Renew to keep access to all your tools.
      </p>
      <a href="https://lab.djandykofficial.com/#pricing"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        RENEW ACCESS &rarr;
      </a>
    </td>
  </tr>`);
}

export function expiryHtml(planLabel: string): string {
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">
      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">ACCESS EXPIRED</p>
      <h1 style="margin:0 0 28px;font-family:${SANS};font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.25;">Your access has expired</h1>
      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;color:#111111;line-height:1.75;">
        Your <strong>${planLabel}</strong> access has ended. Renew to continue using Andy&rsquo;K Music Lab.
      </p>
      <a href="https://lab.djandykofficial.com/#pricing"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        RENEW NOW &rarr;
      </a>
    </td>
  </tr>`);
}

export function paymentFailedHtml(): string {
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">
      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">PAYMENT FAILED</p>
      <h1 style="margin:0 0 28px;font-family:${SANS};font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.25;">Your payment could not be processed</h1>
      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;color:#111111;line-height:1.75;">
        We were unable to process your subscription payment. Please update your payment method to keep access.
      </p>
      <a href="https://lab.djandykofficial.com/client"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        UPDATE PAYMENT &rarr;
      </a>
    </td>
  </tr>`);
}

// ── Template: Signup email confirmation ────────────────────────────────────────

export function confirmSignupHtml(confirmUrl: string): string {
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">
      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">CONFIRM YOUR EMAIL</p>
      <h1 style="margin:0 0 28px;font-family:${SANS};font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.25;">One last step</h1>
      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;color:#111111;line-height:1.75;">
        Confirm your email address to activate your Andy&rsquo;K Music Lab account and link any access you&rsquo;ve already paid for.
      </p>
      <a href="${confirmUrl}"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        CONFIRM EMAIL &rarr;
      </a>
      <p style="margin:24px 0 0;font-family:${SANS};font-size:12px;color:#a3a3a3;line-height:1.6;">
        If you didn&rsquo;t create this account, you can safely ignore this email.
      </p>
    </td>
  </tr>`);
}

// ── Template: Education access approved ────────────────────────────────────────

export function educationApprovedHtml(planLabel: string): string {
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">
      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">EDUCATION ACCESS APPROVED</p>
      <h1 style="margin:0 0 28px;font-family:${SANS};font-size:26px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.25;">Your request has been approved</h1>
      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;color:#111111;line-height:1.75;">
        Your Limited Education Access request has been approved. You now have <strong>${planLabel}</strong> access to Andy&rsquo;K Music Lab.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #111111;margin:0 0 28px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">Create Your Account</p>
          <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;color:#111111;line-height:1.65;">
            Register (or sign in, if you already have an account) using <strong>the same email address</strong> this request was submitted with — your access will link automatically.
          </p>
          <a href="https://lab.djandykofficial.com/register" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">
            CREATE ACCOUNT &rarr;
          </a>
        </td></tr>
      </table>
      <a href="https://lab.djandykofficial.com/login"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        SIGN IN &rarr;
      </a>
    </td>
  </tr>`);
}

// ── Template 0: Payment success (triggered server-side after Revolut verify) ──

export function paymentSuccessHtml(planLabel: string): string {
  const earlyAccessBlock = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;margin:0 0 32px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">Early Access Notice</p>
          <p style="margin:0;font-family:${SANS};font-size:13px;color:#737373;line-height:1.65;">Andy&rsquo;K Music Lab is currently in early access. Some tools may continue to improve based on user feedback. Your access includes updates during the selected access period.</p>
        </td></tr>
      </table>`;

  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">

      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">
        PAYMENT CONFIRMED
      </p>

      <h1 style="margin:0 0 32px;font-family:${SANS};font-size:28px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
        Welcome to Andy&rsquo;K <span style="font-family:${SERIF};font-style:italic;font-weight:400;">Music Lab</span>
      </h1>

      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;font-weight:400;color:#111111;line-height:1.75;">
        Your <strong style="font-weight:600;">${planLabel}</strong> access is now active. Create your account to access all the tools.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #111111;margin:0 0 28px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">Important — Create Your Account</p>
          <p style="margin:0 0 12px;font-family:${SANS};font-size:14px;color:#111111;line-height:1.65;">
            Create your account using <strong>the same email address you used at checkout</strong>. This links your payment to your account automatically.
          </p>
          <a href="https://lab.djandykofficial.com/register" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">
            CREATE ACCOUNT &rarr;
          </a>
        </td></tr>
      </table>

      <p style="margin:0 0 28px;font-family:${SANS};font-size:13px;color:#737373;line-height:1.65;">
        Already have an account? <a href="https://lab.djandykofficial.com/login" style="color:#111111;">Sign in here</a> — your access will activate automatically on login.
      </p>

      ${earlyAccessBlock}

      <a href="https://lab.djandykofficial.com/register"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        ACCESS THE LAB &rarr;
      </a>

    </td>
  </tr>`);
}

// ── Template 0b: Personal discount (admin-sent) ───────────────────────────────

export function personalDiscountHtml(discountPercent: number, code: string, expiryHours: number): string {
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">

      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">
        PERSONAL DISCOUNT
      </p>

      <h1 style="margin:0 0 32px;font-family:${SANS};font-size:28px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
        You got a special offer from <span style="font-family:${SERIF};font-style:italic;font-weight:400;">DJ Andy&rsquo;K</span>
      </h1>

      <p style="margin:0 0 28px;font-family:${SANS};font-size:15px;font-weight:400;color:#111111;line-height:1.75;">
        DJ Andy&rsquo;K is giving you a personal <strong style="font-weight:600;">${discountPercent}%</strong> discount on Andy&rsquo;K Music Lab. This offer was created exclusively for you.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #111111;margin:0 0 24px;">
        <tr><td style="padding:24px;text-align:center;">
          <p style="margin:0 0 10px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">Your Discount Code</p>
          <p style="margin:0;font-family:${MONO};font-size:26px;font-weight:700;color:#111111;letter-spacing:0.08em;">${code}</p>
        </td></tr>
      </table>

      <p style="margin:0 0 32px;font-family:${SANS};font-size:13px;color:#737373;line-height:1.65;">
        Valid for <strong>${expiryHours} hours</strong> only. Use at checkout on lab.djandykofficial.com.
      </p>

      <a href="https://lab.djandykofficial.com/#pricing"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        CLAIM YOUR DISCOUNT &rarr;
      </a>

    </td>
  </tr>`);
}

// ── Template 1: Waitlist confirmation (to user) ───────────────────────────────

export function confirmationHtml(email: string, name: string | null, planLabel: string, discountCode?: string): string {
  const displayName = name || email.split("@")[0];
  const discountBlock = discountCode ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;margin:24px 0 32px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 8px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">Your Early Access Code</p>
          <p style="margin:0 0 8px;font-family:${MONO};font-size:20px;font-weight:700;color:#111111;letter-spacing:0.05em;">${discountCode}</p>
          <p style="margin:0;font-family:${SANS};font-size:13px;color:#525252;line-height:1.6;">Use this code at checkout for <strong>40% off</strong> your first year.</p>
        </td></tr>
      </table>` : "";

  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">

      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">
        WAITLIST &middot; EARLY ACCESS
      </p>

      <h1 style="margin:0 0 32px;font-family:${SANS};font-size:28px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
        You&rsquo;re on the <span style="font-family:${SERIF};font-style:italic;font-weight:400;">list</span>
      </h1>

      <p style="margin:0 0 12px;font-family:${SANS};font-size:15px;font-weight:400;color:#111111;line-height:1.75;">
        Hi <strong style="font-weight:600;">${displayName}</strong>,
      </p>
      <p style="margin:0 0 12px;font-family:${SANS};font-size:15px;font-weight:400;color:#111111;line-height:1.75;">
        You&rsquo;re on the waitlist for <strong style="font-weight:600;">${planLabel}</strong>.
        We&rsquo;ll email you the moment Andy&rsquo;K Music Lab goes live.
      </p>
      <p style="margin:0 0 24px;font-family:${SANS};font-size:14px;font-weight:300;color:#8a8a8a;line-height:1.75;">
        Thank you for your interest.
      </p>

      ${discountBlock}

      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;margin:0 0 32px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">Early Access Notice</p>
          <p style="margin:0;font-family:${SANS};font-size:13px;color:#737373;line-height:1.65;">Andy&rsquo;K Music Lab is currently in early access. Some tools may continue to improve based on user feedback. Your access includes updates during the selected access period.</p>
        </td></tr>
      </table>

      <a href="https://lab.djandykofficial.com"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        LAB.DJANDYKOFFICIAL.COM &rarr;
      </a>

    </td>
  </tr>`);
}

// ── Template 2: Admin notification ───────────────────────────────────────────

export function adminHtml(email: string, name: string | null, planLabel: string, timestamp: string): string {
  const rows: [string, string][] = [
    ["Name",  name || "—"],
    ["Email", email],
    ["Plan",  planLabel],
    ["Time",  timestamp],
  ];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #e5e5e5;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.1em;width:72px;vertical-align:top;">
        ${label}
      </td>
      <td style="padding:14px 0 14px 24px;border-bottom:1px solid #e5e5e5;font-family:${SANS};font-size:14px;font-weight:400;color:#111111;line-height:1.55;">
        ${value}
      </td>
    </tr>`).join("");

  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">

      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">
        NEW SIGNUP
      </p>

      <h1 style="margin:0 0 40px;font-family:${SANS};font-size:28px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
        New <span style="font-family:${SERIF};font-style:italic;font-weight:400;">waitlist</span> entry
      </h1>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;">
        ${tableRows}
      </table>

    </td>
  </tr>`);
}

// ── Template 3: Launch notification (to user) ─────────────────────────────────

export function launchHtml(email: string, name: string | null): string {
  const displayName = name || email.split("@")[0];
  return wrap(`
  <tr>
    <td style="padding:48px 48px 56px;">

      <p style="margin:0 0 20px;font-family:${MONO};font-size:10px;font-weight:700;color:#a3a3a3;letter-spacing:0.2em;text-transform:uppercase;">
        ANDY&rsquo;K MUSIC LAB &middot; NOW LIVE
      </p>

      <h1 style="margin:0 0 32px;font-family:${SANS};font-size:28px;font-weight:700;color:#111111;letter-spacing:-0.02em;line-height:1.2;">
        The Lab is <span style="font-family:${SERIF};font-style:italic;font-weight:400;">live</span>
      </h1>

      <p style="margin:0 0 12px;font-family:${SANS};font-size:15px;font-weight:400;color:#111111;line-height:1.75;">
        Hi <strong style="font-weight:600;">${displayName}</strong>,
      </p>
      <p style="margin:0 0 44px;font-family:${SANS};font-size:15px;font-weight:400;color:#111111;line-height:1.75;">
        Andy&rsquo;K Music Lab is now open. Join today.
      </p>

      <a href="https://lab.djandykofficial.com"
         style="display:block;width:100%;box-sizing:border-box;padding:16px 24px;background:#111111;color:#ffffff;font-family:${MONO};font-size:11px;font-weight:700;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;text-align:center;">
        JOIN NOW &rarr;
      </a>

    </td>
  </tr>`);
}
