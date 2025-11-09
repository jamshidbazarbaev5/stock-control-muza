import { useNavigate, useParams } from "react-router-dom";
import { ResourceForm } from "../helpers/ResourceForm";
import type { Product } from "../api/product";
import { useUpdateProduct, useGetProduct } from "../api/product";
import {
  useGetCategories,
  fetchCategoriesWithAttributes,
} from "../api/category";
import { useGetMeasurements } from "../api/measurement";
import type { Attribute } from "@/types/attribute";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MultiSelect } from "@/components/MultiSelect";

// Utility function to parse numeric values from API
const parseNumericValue = (value: any): string => {
  if (value === null || value === undefined) return "";

  // Convert to string first
  let stringValue = value.toString();

  // Replace comma with dot for proper decimal parsing
  stringValue = stringValue.replace(",", ".");

  // Parse as float and return as string without trailing zeros
  const numericValue = parseFloat(stringValue);

  // Return empty string if not a valid number
  if (isNaN(numericValue)) return "";

  // Return formatted number without unnecessary trailing zeros
  return numericValue.toString();
};

interface AttributeValue {
  attribute_id: number;
  value: string | number | boolean | number[];
}

export default function EditProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const updateProduct = useUpdateProduct();
  const { data: product } = useGetProduct(Number(id));
  const [barcode, setBarcode] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [attributeValues, setAttributeValues] = useState<AttributeValue[]>([]);
  const [measurements, setMeasurements] = useState([
    { from_unit: 0, to_unit: 0, number: "" },
  ]);
  const [baseUnit, setBaseUnit] = useState("");
  const [isImported, setIsImported] = useState(false);

  // Fetch categories and measurements for the select dropdowns
  const { data: categoriesData } = useGetCategories({});
  const { data: measurementsData } = useGetMeasurements({});

  // Get the arrays from response data
  const categories = Array.isArray(categoriesData)
    ? categoriesData
    : categoriesData?.results || [];
  const availableMeasurements = Array.isArray(measurementsData)
    ? measurementsData
    : measurementsData?.results || [];

  // Fetch attributes and filter by selected category
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        if (selectedCategory) {
          // First check if we already have attributes from the product's category_read
          if (product?.category_read?.attributes_read) {
            setAttributes(product.category_read.attributes_read);
            return;
          }

          // Otherwise fetch from API
          const selectedCategoryData = categories.find(
            (cat) => cat.id === selectedCategory,
          );
          if (selectedCategoryData) {
            const response = await fetchCategoriesWithAttributes(
              selectedCategoryData.category_name,
            );
            const categoryWithAttributes = response.results.find(
              (cat) => cat.id === selectedCategory,
            );
            if (categoryWithAttributes?.attributes_read) {
              setAttributes(categoryWithAttributes.attributes_read);
            } else {
              setAttributes([]);
            }
          }
        } else {
          setAttributes([]);
        }
      } catch (error) {
        console.error("Failed to fetch attributes:", error);
        setAttributes([]);
      }
    };

    fetchAttributes();
  }, [selectedCategory, categories, product]);

  useEffect(() => {
    if (product) {
      // Set initial values from product data
      setBarcode(product.barcode || "");
      setMinPrice(parseNumericValue(product.min_price));
      setSellingPrice(parseNumericValue(product.selling_price));
      setBaseUnit(product.base_unit?.toString() || "");
      setIsImported(product.is_imported || false);

      // Set measurements
      if (product.measurement) {
        setMeasurements(
          product.measurement.map((m: any) => ({
            from_unit: m.from_unit?.id || 0,
            to_unit: m.to_unit?.id || 0,
            number: parseNumericValue(m.number),
          })),
        );
      }

      // Set selected category for attributes
      if (product.category_read?.id || product.category_write) {
        setSelectedCategory(
          product.category_read?.id || product.category_write,
        );
      }

      // Set attribute values if they exist - convert from API format to form format
      if (product.attribute_values) {
        const formattedAttributeValues = product.attribute_values.map(
          (av: any) => {
            // Handle both API response format (with nested attribute) and form format
            if (av.attribute && av.attribute.id) {
              return {
                attribute_id: av.attribute.id,
                value: av.value,
              };
            } else {
              // Already in form format
              return av;
            }
          },
        );
        setAttributeValues(formattedAttributeValues);
      }
    }
  }, [product]);

  const handleSubmit = async (data: any) => {
    if (!id) return;

    console.log("Form data received:", data);

    try {
      const formattedData: Product = {
        id: Number(id),
        product_name: data.product_name,
        category_write:
          typeof data.category_write === "string"
            ? parseInt(data.category_write, 10)
            : data.category_write,
        barcode: barcode,
        base_unit: baseUnit ? parseInt(baseUnit, 10) : undefined,
        min_price:
          typeof data.min_price === "string"
            ? parseFloat(data.min_price)
            : data.min_price,
        selling_price:
          typeof data.selling_price === "string"
            ? parseFloat(data.selling_price)
            : data.selling_price,
        measurement: measurements
          .filter((m) => m.from_unit && m.to_unit && m.number)
          .map((m) => ({
            from_unit: m.from_unit,
            to_unit: m.to_unit,
            number: parseFloat(m.number.replace(",", ".")).toString(),
            for_sale: false,
          })),
        attribute_values: attributeValues.map((av) => ({
          ...av,
          value:
            typeof av.value === "string" && !isNaN(Number(av.value))
              ? Number(av.value)
              : av.value,
        })),
        is_imported: isImported,
      };

      console.log("Formatted data:", formattedData);

      await updateProduct.mutateAsync(formattedData);
      toast.success(
        t("messages.success.updated", { item: t("table.product") }),
      );
      navigate("/products");
    } catch (error) {
      toast.error(t("messages.error.update", { item: t("table.product") }));
      console.error("Failed to update product:", error);
    }
  };

  if (!product) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <ResourceForm<Product>
        fields={[
          {
            name: "product_name",
            label: t("forms.product_name"),
            type: "text",
            placeholder: t("placeholders.enter_name"),
            required: true,
          },
          {
            name: "category_write",
            label: t("table.category"),
            type: "select",
            placeholder: t("placeholders.select_category"),
            required: true,
            options: categories.map((category) => ({
              value: category.id,
              label: category.category_name,
            })),
            onChange: (value: string) => setSelectedCategory(Number(value)),
          },
          {
            name: "base_unit",
            label: t("forms.base_unit"),
            type: "select",
            placeholder: t("forms.base_unit"),
            options: availableMeasurements.map((measurement) => ({
              value: measurement.id,
              label: measurement.measurement_name,
            })),
            value: baseUnit,
            onChange: (value: string) => setBaseUnit(value),
          },
          {
            name: "barcode",
            label: t("forms.barcode"),
            type: "number",
            placeholder: t("forms.barcode"),
            value: barcode,
            onChange: (value: string) => setBarcode(value),
          },
          {
            name: "min_price",
            label: t("forms.min_price"),
            type: "number",
            placeholder: t("forms.min_price"),
            required: true,
            value: minPrice,
            onChange: (value: string) => setMinPrice(value),
          },
          {
            name: "selling_price",
            label: t("forms.selling_price"),
            type: "number",
            placeholder: t("forms.selling_price"),
            required: true,
            value: sellingPrice,
            onChange: (value: string) => setSellingPrice(value),
          },
          {
            name: "is_imported",
            label: "Импортный товар",
            type: "checkbox",
            value: isImported,
            onChange: (value: boolean) => setIsImported(value),
          },
        ]}
        onSubmit={handleSubmit}
        isSubmitting={updateProduct.isPending}
        title={t("common.edit") + " " + t("table.product")}
        defaultValues={
          {
            product_name: product.product_name,
            category_write: product.category_read?.id || product.category_write,
            base_unit: product.base_unit?.toString() || "",
            barcode: product.barcode || "",
            min_price: parseNumericValue(product.min_price),
            selling_price: parseNumericValue(product.selling_price),
            is_imported: product.is_imported || false,
          } as any
        }
      >
        {/* Measurements Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Ед измерения</h3>
          {measurements.map((measurement, index) => (
            <div key={index} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">ИЗ</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={measurement.from_unit || ""}
                  onChange={(e) => {
                    const newMeasurements = [...measurements];
                    newMeasurements[index] = {
                      ...newMeasurements[index],
                      from_unit: parseInt(e.target.value, 10),
                    };
                    setMeasurements(newMeasurements);
                  }}
                >
                  <option value="">ИЗ</option>
                  {availableMeasurements.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.measurement_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">К</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={measurement.to_unit || ""}
                  onChange={(e) => {
                    const newMeasurements = [...measurements];
                    newMeasurements[index] = {
                      ...newMeasurements[index],
                      to_unit: parseInt(e.target.value, 10),
                    };
                    setMeasurements(newMeasurements);
                  }}
                >
                  <option value="">К</option>
                  {availableMeasurements.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.measurement_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Число</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Число"
                  value={measurement.number || ""}
                  onChange={(e) => {
                    const newMeasurements = [...measurements];
                    newMeasurements[index] = {
                      ...newMeasurements[index],
                      number: e.target.value,
                    };
                    setMeasurements(newMeasurements);
                  }}
                />
              </div>
              {index > 0 && (
                <button
                  type="button"
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  onClick={() => {
                    setMeasurements(measurements.filter((_, i) => i !== index));
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            onClick={() => {
              setMeasurements([
                ...measurements,
                { from_unit: 0, to_unit: 0, number: "" },
              ]);
            }}
          >
            Добавить
          </button>
        </div>
        {/* Dynamic Attribute Fields */}
        {selectedCategory && attributes.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">{t("forms.attributes")}</h3>
            {attributes.map((attribute) => {
              const existingValue = attributeValues.find(
                (v) => v.attribute_id === attribute.id,
              )?.value;

              const handleAttributeChange = (
                value: string | boolean | number[],
              ) => {
                setAttributeValues((prev) => {
                  const existing = prev.find(
                    (v) => v.attribute_id === attribute.id,
                  );
                  if (existing) {
                    return prev.map((v) =>
                      v.attribute_id === attribute.id ? { ...v, value } : v,
                    );
                  }
                  return [...prev, { attribute_id: attribute.id!, value }];
                });
              };

              switch (attribute.field_type) {
                case "string":
                  return (
                    <div key={attribute.id} className="form-control">
                      <label className="label">
                        <span className="label-text">
                          {attribute.translations.ru}
                        </span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-md"
                        value={existingValue?.toString() || ""}
                        onChange={(e) => handleAttributeChange(e.target.value)}
                      />
                    </div>
                  );
                case "number":
                  return (
                    <div key={attribute.id} className="form-control">
                      <label className="label">
                        <span className="label-text">
                          {attribute.translations.ru}
                        </span>
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border rounded-md"
                        value={existingValue?.toString() || ""}
                        onChange={(e) => handleAttributeChange(e.target.value)}
                      />
                    </div>
                  );
                case "boolean":
                  return (
                    <div key={attribute.id} className="form-control">
                      <label className="label cursor-pointer">
                        <span className="label-text">
                          {attribute.translations.ru}
                        </span>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={!!existingValue}
                          onChange={(e) =>
                            handleAttributeChange(e.target.checked)
                          }
                        />
                      </label>
                    </div>
                  );
                case "choice":
                  return attribute.choices ? (
                    <div key={attribute.id} className="form-control">
                      <label className="label">
                        <span className="label-text">
                          {attribute.translations.ru}
                        </span>
                      </label>
                      <select
                        className="w-full px-3 py-2 border rounded-md"
                        value={existingValue?.toString() || ""}
                        onChange={(e) => handleAttributeChange(e.target.value)}
                      >
                        <option value="">
                          {t("placeholders.select_option")}
                        </option>
                        {attribute.choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null;
                case "date":
                  return (
                    <div key={attribute.id} className="form-control">
                      <label className="label">
                        <span className="label-text">
                          {attribute.translations.ru}
                        </span>
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border rounded-md"
                        value={existingValue?.toString() || ""}
                        onChange={(e) => handleAttributeChange(e.target.value)}
                      />
                    </div>
                  );
                case "many2many":
                  return attribute.related_objects ? (
                    <div key={attribute.id} className="mb-4">
                      <MultiSelect
                        label={attribute.translations.ru}
                        options={attribute.related_objects.map(
                          (obj: { id: number; name: string }) => ({
                            id: obj.id,
                            name: obj.name,
                          }),
                        )}
                        value={
                          Array.isArray(existingValue)
                            ? (existingValue as number[])
                            : []
                        }
                        onChange={(selectedIds) =>
                          handleAttributeChange(selectedIds)
                        }
                        placeholder={t("placeholders.select_options")}
                      />
                    </div>
                  ) : null;
                default:
                  return null;
              }
            })}
          </div>
        )}
      </ResourceForm>
    </div>
  );
}
