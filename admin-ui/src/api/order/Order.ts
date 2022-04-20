import { Product } from "../product/Product";
import { Customer } from "../customer/Customer";

export type Order = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  quantity: number | null;
  discount: number | null;
  totalPrice: number | null;
  product?: Array<Product>;
  customer?: Customer | null;
};
