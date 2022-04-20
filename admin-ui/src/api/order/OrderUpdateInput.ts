import { ProductUpdateManyWithoutOrdersInput } from "./ProductUpdateManyWithoutOrdersInput";
import { CustomerWhereUniqueInput } from "../customer/CustomerWhereUniqueInput";

export type OrderUpdateInput = {
  quantity?: number | null;
  discount?: number | null;
  totalPrice?: number | null;
  product?: ProductUpdateManyWithoutOrdersInput;
  customer?: CustomerWhereUniqueInput | null;
};
