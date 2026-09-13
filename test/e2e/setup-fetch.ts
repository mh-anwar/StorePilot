// Installed before any app module loads: the Shopify library captures
// globalThis.fetch at import time, so we hand it a forwarding function.
import { FakeShopify } from "./fake-shopify";

declare global {
  // eslint-disable-next-line no-var
  var fakeShopify: FakeShopify;
}

globalThis.fakeShopify = new FakeShopify();
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fakeShopify.handle(input, init)) as typeof fetch;
