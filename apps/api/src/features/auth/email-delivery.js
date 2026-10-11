const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export const createVerificationUrl = (token, environment) => {
  const url = new URL('/verify-email', environment.VOXEL_PUBLIC_APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
};

export const sendVerificationEmail = async ({ email, displayName, token, environment, fetchImpl = fetch }) => {
  const verificationUrl = createVerificationUrl(token, environment);
  if (!environment.VOXEL_EMAIL_DELIVERY_URL) return { delivered: false, verificationUrl };

  const name = displayName || 'there';
  const text = `Hi ${name},\n\nVerify your Voxel email address by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create a Voxel account, you can ignore this email.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>Verify your Voxel email address to finish creating your account.</p><p><a href="${escapeHtml(verificationUrl)}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create a Voxel account, you can ignore this email.</p>`;
  const response = await fetchImpl(environment.VOXEL_EMAIL_DELIVERY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${environment.VOXEL_EMAIL_DELIVERY_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: environment.VOXEL_EMAIL_FROM,
      to: email,
      subject: 'Verify your Voxel email address',
      text,
      html,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Email delivery service rejected the verification message.');
  return { delivered: true };
};
