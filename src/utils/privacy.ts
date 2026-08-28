export function maskPhone(value?: string | number | null) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  return text.replace(/^(\d{3})\d{6}(\d{2})$/, '$1******$2');
}

export function displayNameWithMaskedPhone(
  user?: { name?: string | null; realName?: string | null; phone?: string | number | null } | null,
  fallback = '-',
) {
  if (!user) return fallback;
  const name = String(user.name || user.realName || '').trim();
  const phone = maskPhone(user.phone);
  if (name && phone !== '-') return `${name}（${phone}）`;
  return name || phone || fallback;
}
