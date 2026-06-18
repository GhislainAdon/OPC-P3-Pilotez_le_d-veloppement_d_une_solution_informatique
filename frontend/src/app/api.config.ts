export function getApiBaseUrl(): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  if (hostname.endsWith('.github.dev')) {
    if (hostname.includes('-80.')) {
      return `${protocol}//${hostname.replace('-80.', '-8080.')}`;
    } else {
      return `${protocol}//${hostname.replace('.app.github.dev', '-8080.app.github.dev')}`;
    }
  }

  return 'http://localhost:8080';
}
