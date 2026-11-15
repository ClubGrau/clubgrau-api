import { PingUrlPort } from '@modules/health/application/ports/outbound/ping-url.port';

export class FetchPingUrlAdapter implements PingUrlPort {
  async ping(url: string): Promise<void> {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(
        `Keep-alive ping to ${url} failed with status ${response.status}`,
      );
    }
  }
}
