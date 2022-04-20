import { ProductCreateNestedManyWithoutOrdersInput } from "./ProductCreateNestedManyWithoutOrdersInput";
import { CustomerWhereUniqueInput } from "../customer/CustomerWhereUniqueInput";

export type OrderCreateInput = {
  quantity?: number | null;
  discount?: number | null;
  totalPrice?: number | null;
  product?: ProductCreateNestedManyWithoutOrdersInput;
  customer?: CustomerWhereUniqueInput | null;
};
