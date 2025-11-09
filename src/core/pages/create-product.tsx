import { useNavigate } from "react-router-dom";
import { ResourceForm } from "../helpers/ResourceForm";
import {
  type Product,
  useCreateProduct,
  searchProductByBarcode,
} from "../api/product";
import {
  useGetCategories,
  fetchCategoriesWithAttributes,
} from "../api/category";
import { useGetMeasurements } from "../api/measurement";
import type { Attribute } from "@/types/attribute";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { MultiSelect } from "@/components/MultiSelect";

interface AttributeValue {
  attribute_id: number;
  value: string | number | boolean | number[];
}

export default function CreateProduct() {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const { t } = useTranslation();
  const [barcode, setBarcode] = useState("");

  // Create form instance to control the form programmatically
  const form = useForm<Product>();

  // Debug barcode changes
  useEffect(() => {
    console.log("Barcode state changed:", barcode);
  }, [barcode]);
  const [minPrice, setMinPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [attributeValues, setAttributeValues] = useState<AttributeValue[]>([]);
  const [measurements, setMeasurements] = useState([
    { from_unit: 0, to_unit: 0, number: "" },
  ]);
  const [baseUnit, setBaseUnit] = useState("");
  const [isImported, setIsImported] = useState(false);

  // Barcode scanner state
  const [scanBuffer, setScanBuffer] = useState("");
  const [_isScanning, setIsScanning] = useState(false);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          // Find the selected category name
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
  }, [selectedCategory, categories]);

  const populateFormWithProduct = (product: Product) => {
    // Set basic fields
    form.setValue("product_name", product.product_name);
    form.setValue("barcode", product.barcode || "");

    if (product.category_write) {
      form.setValue("category_write", product.category_write);
      setSelectedCategory(product.category_write);
    }

    if (product.base_unit) {
      setBaseUnit(product.base_unit.toString());
    }

    if (product.min_price) {
      setMinPrice(product.min_price.toString());
    }

    if (product.selling_price) {
      setSellingPrice(product.selling_price.toString());
    }

    if (product.is_imported !== undefined) {
      setIsImported(product.is_imported);
    }

    // Set measurements if available
    if (product.measurement && product.measurement.length > 0) {
      const formattedMeasurements = product.measurement.map((m) => ({
        from_unit: m.from_unit || 0,
        to_unit: m.to_unit || 0,
        number: m.number.toString(),
      }));
      setMeasurements(formattedMeasurements);
    }

    // Set attribute values if available
    if (
      product.attribute_values_response &&
      product.attribute_values_response.length > 0
    ) {
      const formattedAttributes = product.attribute_values_response.map(
        (av) => ({
          attribute_id: av.attribute.id!,
          value: av.value,
        }),
      );
      setAttributeValues(formattedAttributes);
    }

    setBarcode(product.barcode || "");
  };

  // Barcode scanner functionality
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      // Clear any existing timeout
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      // Start scanning mode
      setIsScanning(true);

      // Handle Enter key (end of barcode scan)
      if (event.key === "Enter") {
        event.preventDefault();
        if (scanBuffer.trim()) {
          console.log("Searching for product with barcode:", scanBuffer.trim());

          // Search for product by barcode
          searchProductByBarcode(scanBuffer.trim())
            .then((product) => {
              if (product) {
                populateFormWithProduct(product);
                toast.success(`Product found: ${product.product_name}`);
              } else {
                // No product found, just set the barcode
                setBarcode(scanBuffer.trim());
                form.setValue("barcode", scanBuffer.trim());
                toast.info(
                  `No product found with barcode: ${scanBuffer.trim()}. You can create a new product.`,
                );
              }
            })
            .catch((error) => {
              console.error("Error searching for product:", error);
              // Fallback: just set the barcode
              setBarcode(scanBuffer.trim());
              form.setValue("barcode", scanBuffer.trim());
              toast.error(
                "Error searching for product. Barcode set for new product.",
              );
            });
        }
        setScanBuffer("");
        setIsScanning(false);
        return;
      }

      // Accumulate characters for barcode
      if (event.key.length === 1) {
        // Only single characters, not special keys
        setScanBuffer((prev) => prev + event.key);

        // Set timeout to reset buffer if scanning stops
        scanTimeoutRef.current = setTimeout(() => {
          setScanBuffer("");
          setIsScanning(false);
        }, 100); // 100ms timeout between characters
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyPress);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [scanBuffer]);

  const handleSubmit = async (data: any) => {
    console.log("Form data received:", data);

    try {
      // @ts-ignore
      const formattedData: Product = {
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
            number: m.number,
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

      await createProduct.mutateAsync(formattedData);
      toast.success(
        t("messages.success.created", { item: t("table.product") }),
      );
      navigate("/products");
    } catch (error) {
      toast.error(t("messages.error.create", { item: t("table.product") }));
      console.error("Failed to create product:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <ResourceForm<Product>
        form={form}
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
            type: "text",
            placeholder: t("forms.barcode"),
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
        isSubmitting={createProduct.isPending}
        title={t("common.create") + " " + t("table.product")}
      >
        {/* Measurements Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Ед измерения</h3>
          {measurements.map((measurement, index) => (
            <div key={index} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Из</label>
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
                  <option value="">Из</option>
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
