import { StringFilter } from "../../util/StringFilter";
import { IntNullableFilter } from "../../util/IntNullableFilter";
import { FloatNullableFilter } from "../../util/FloatNullableFilter";
import { ProductListRelationFilter } from "../product/ProductListRelationFilter";
import { CustomerWhereUniqueInput } from "../customer/CustomerWhereUniqueInput";

export type OrderWhereInput = {
  id?: StringFilter;
  quantity?: IntNullableFilter;
  discount?: FloatNullableFilter;
  totalPrice?: IntNullableFilter;
  product?: ProductListRelationFilter;
  customer?: CustomerWhereUniqueInput;
};
