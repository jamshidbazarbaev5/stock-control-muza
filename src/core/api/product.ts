import { createResourceApiHooks } from "../helpers/createResourceApi";
import type { Attribute } from "@/types/attribute";
import api from "./api";

// Types
export interface ProductMeasurement {
  to_unit: number;
  from_unit: number;
  id?: number;
  measurement_write?: number;
  measurement_read?: {
    id: number;
    measurement_name: string;
    short_name?: string;
  };
  number: number | string;
  for_sale: boolean;
}

// Attribute value interface for API responses
export interface AttributeValueResponse {
  id: number;
  attribute: Attribute;
  value: string | number | boolean | number[];
}

export interface Product {
  id?: number;
  is_imported?:boolean;
  has_barcode?: boolean;
  barcode?: string;
  product_name: string;
  color?: string;
  category_write: number;
  store_write?: number;
  has_color?: boolean;
  measurement?: ProductMeasurement[];
  category_read?: {
    id: number;
    category_name: string;
    store_write?: number;
    attributes_read?: Attribute[];
    sell_from_stock?: boolean;
  };
  min_price?: number;
  selling_price?: number;
  selling_price_in_currency?: number | string;
  sell_in_currency_unit?: {
    label: string;
    exchange_rate: number;
    action: string;
    conversion: number;
  };
  quantity?: number | string;
  is_default?: boolean;
  // For form submission (create/update)
  attribute_values?: Array<{
    attribute_id: number;
    value: string | number | boolean | number[];
  }>;
  // For API response (get)
  attribute_values_response?: AttributeValueResponse[];
  has_kub?: boolean;
  kub?: number;
  has_recycling?: boolean;
  categories_for_recycling?: number[];
  is_list?: boolean;
  length?: number;
  static_weight?: number;
  has_metr?: boolean;
  has_shtuk?: boolean;
  base_unit?: number;
  ikpu?: string;
  history?: any;
  available_units?: Array<{
    id: number;
    short_name: string;
    factor: number;
    is_base: boolean;
  }>;
}

// API endpoints
const PRODUCT_URL = "items/product/";

// Create product API hooks using the factory function
export const {
  useGetResources: useGetProducts,
  useGetResource: useGetProduct,
  useCreateResource: useCreateProduct,
  useUpdateResource: useUpdateProduct,
  useDeleteResource: useDeleteProduct,
} = createResourceApiHooks<Product>(PRODUCT_URL, "products");

// Search products by barcode
export const searchProductByBarcode = async (
  barcode: string,
): Promise<Product | null> => {
  try {
    const response = await api.get(`${PRODUCT_URL}?barcode=${barcode}`);
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0]; // Return the first matching product
    }
    return null;
  } catch (error) {
    console.error("Error searching product by barcode:", error);
    return null;
  }
};
