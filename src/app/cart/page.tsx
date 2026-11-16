import type { Metadata } from "next";
import CartPage from "@/components/cart";
export const metadata: Metadata = { title: "Your cart" };
export default function Cart() {
  return <CartPage />;
}
