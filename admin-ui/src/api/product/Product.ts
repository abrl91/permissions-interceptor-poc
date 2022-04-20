import { Order } from "../order/Order";

export type Product = {
  createdAt: Date;
  name: string | null;
  itemPrice: number | null;
  description: string | null;
  orders?: Array<Order>;
  id: string;
  updatedAt: Date;
};
