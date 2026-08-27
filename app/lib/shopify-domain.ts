export function cleanShopDomain(value: string) {
  let domain = value.trim().toLowerCase();

  if (domain.startsWith("https://")) {
    domain = domain.slice("https://".length);
  } else if (domain.startsWith("http://")) {
    domain = domain.slice("http://".length);
  }

  while (domain.endsWith("/")) {
    domain = domain.slice(0, -1);
  }

  if (domain.endsWith(".myshopify.com.myshopify.com")) {
    domain = domain.slice(
      0,
      -".myshopify.com".length
    );
  }

  return domain;
}

export function isValidShopDomain(value: string) {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(value);
}

export function resolveShopDomain(value: string) {
  const shop = cleanShopDomain(value);

  return isValidShopDomain(shop) ? shop : "";
}
