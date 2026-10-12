const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export const createVerificationUrl = (token, environment) => {
  const url = new URL('/verify-email', environment.VOXEL_PUBLIC_APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
};

export const createWorkspaceInviteUrl = (token, environment) => (
  new URL(`/invite/${encodeURIComponent(token)}`, environment.VOXEL_PUBLIC_APP_URL).toString()
);

const deliverEmail = async ({ to, subject, text, html, environment, fetchImpl }) => {
  if (!environment.VOXEL_EMAIL_DELIVERY_URL) return { delivered: false };

  const response = await fetchImpl(environment.VOXEL_EMAIL_DELIVERY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${environment.VOXEL_EMAIL_DELIVERY_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: environment.VOXEL_EMAIL_FROM,
      to,
      subject,
      text,
      html,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Email delivery service rejected the message.');
  return { delivered: true };
};

export const sendWorkspaceInviteEmail = async ({
  email,
  inviterName,
  workspaceName,
  role,
  token,
  expiresAt,
  environment,
  fetchImpl = fetch,
}) => {
  const inviteUrl = createWorkspaceInviteUrl(token, environment);
  const inviter = inviterName || 'A teammate';
  const workspace = workspaceName || 'a Voxel workspace';
  const expires = new Date(expiresAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  const subject = `${inviter} invited you to ${workspace}`;
  const text = `${inviter} invited you to join ${workspace} as a ${role.toLowerCase()}.\n\nAccept your invitation: ${inviteUrl}\n\nThis invitation expires on ${expires}. If you were not expecting this invitation, you can ignore this email.`;
  const html = `<p>${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(workspace)}</strong> as a ${escapeHtml(role.toLowerCase())}.</p><p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p><p>This invitation expires on ${escapeHtml(expires)}. If you were not expecting this invitation, you can ignore this email.</p>`;
  const delivery = await deliverEmail({
    to: email,
    subject,
    text,
    html,
    environment,
    fetchImpl,
  });
  return { ...delivery, inviteUrl };
};

export const sendVerificationEmail = async ({ email, displayName, token, environment, fetchImpl = fetch }) => {
  const verificationUrl = createVerificationUrl(token, environment);
  if (!environment.VOXEL_EMAIL_DELIVERY_URL) return { delivered: false, verificationUrl };

  const name = displayName || 'there';
  const text = `Hi ${name},\n\nVerify your Voxel email address by opening this link:\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not create a Voxel account, you can ignore this email.`;
  const html = `<p>Hi ${escapeHtml(name)},</p><p>Verify your Voxel email address to finish creating your account.</p><p><a href="${escapeHtml(verificationUrl)}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create a Voxel account, you can ignore this email.</p>`;
  return deliverEmail({
    to: email,
    subject: 'Verify your Voxel email address',
    text,
    html,
    environment,
    fetchImpl,
  });
};
