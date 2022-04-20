import { StringNullableFilter } from "../../util/StringNullableFilter";
import { FloatNullableFilter } from "../../util/FloatNullableFilter";
import { OrderListRelationFilter } from "../order/OrderListRelationFilter";
import { StringFilter } from "../../util/StringFilter";

export type ProductWhereInput = {
  name?: StringNullableFilter;
  itemPrice?: FloatNullableFilter;
  description?: StringNullableFilter;
  orders?: OrderListRelationFilter;
  id?: StringFilter;
};
