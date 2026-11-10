"use server";

import { redirect } from "next/navigation";
import { orderDocument } from "@/lib/data/requests";
import { isDocumentCode, readForm } from "@/lib/documents/forms";

export type OrderState = {
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
};

/** Заказ документа. code привязывается на странице через bind и всё равно проверяется здесь. */
export async function orderAction(code: string, _prev: OrderState, form: FormData): Promise<OrderState> {
  if (!isDocumentCode(code)) return { error: "Такого документа нет в каталоге" };
  const input = readForm(code, form);
  const result = await orderDocument(code, input);
  if (!result.ok) return { error: result.error, fields: result.fields, values: input };
  redirect(`/requests/${result.requestId}?new=1`);
}
