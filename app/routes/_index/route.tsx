import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "StorePilot — Chargeback defense for Shopify Payments" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.name}>StorePilot</h1>
        <p className={styles.pitch}>
          Chargeback defense for Shopify Payments: an evidence pack and a
          drafted rebuttal, reviewed by you before anything is sent.
        </p>

        <ul className={styles.bullets}>
          <li>An evidence pack in seconds.</li>
          <li>A rebuttal drafted for your dispute&apos;s reason code.</li>
          <li>You approve before anything is submitted.</li>
        </ul>

        {showForm && (
          <Form
            method="post"
            action="/auth/login"
            className={styles.form}
          >
            <label htmlFor="shop" className={styles.label}>
              Shop domain
            </label>
            <input
              type="text"
              name="shop"
              id="shop"
              placeholder="my-store.myshopify.com"
              className={styles.input}
            />
            <button type="submit" className={styles.button}>
              Log in
            </button>
          </Form>
        )}

        <nav className={styles.nav} aria-label="Footer">
          <a className={styles.link} href="/demo">
            Try the demo
          </a>
          <a className={styles.link} href="/privacy">
            Privacy
          </a>
        </nav>
      </section>
    </main>
  );
}
