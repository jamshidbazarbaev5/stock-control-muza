  import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import type { Product } from "../api/product";
import { fetchAllProducts } from "../api/fetchAllProducts";
import { OpenShiftForm } from "@/components/OpenShiftForm";
import type { Stock } from "../api/stock";
import { StockSelectionModal } from "@/components/StockSelectionModal";
import {
  WideDialog,
  WideDialogContent,
  WideDialogHeader,
  WideDialogTitle,
} from "@/components/ui/wide-dialog";

interface ProductInCart {
  id: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  product: Product;
  barcode?: string;
  selectedUnit: {
    id: number;
    short_name: string;
    factor: number;
    is_base: boolean;
  } | null;
  stock?: Stock;
  stockId?: number;
}

interface ExtendedUser extends User {
  store_read?: {
    id: number;
    name: string;
    address: string;
    phone_number: string;
    budget: string;
    created_at: string;
    is_main: boolean;
    parent_store: number | null;
    owner: number;
  };
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useGetStores } from "../api/store";
import { useGetClients, useCreateClient } from "../api/client";

import { useQuery } from "@tanstack/react-query";
import api from "../api/api";
import { useCreateSale } from "@/core/api/sale";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { addDays } from "date-fns";
import { type User } from "../api/user";

interface FormSaleItem {
  product_write: number;
  selling_unit: number;
  quantity: number;
  price_per_unit: string;
  stock?: number;
}

interface FormSalePayment {
  payment_method: string;
  amount: number;
  exchange_rate?: number;
  change_amount?: number;
}

interface CurrencyRate {
  created_at: string;
  rate: string;
  currency_detail: {
    id: number;
    name: string;
    short_name: string;
    is_base: boolean;
  };
}

interface SaleFormData {
  store: string;
  sale_items: FormSaleItem[];
  on_credit: boolean;
  total_amount: string;
  discount_amount?: string;
  sale_payments: FormSalePayment[];
  sold_by?: number;
  sale_debt?: {
    client: number;
    due_date: string;
    deposit?: number;
    deposit_payment_method?: string;
  };
}

// Helper function to get the base unit from available units
function getBaseUnit(availableUnits: any[]) {
  return availableUnits?.find((unit) => unit.is_base) || availableUnits?.[0];
}

// Wrapper component to handle shift check
function CreateSaleWrapper() {
  const { data: currentUser } = useCurrentUser();

  // Check if user has active shift - if not, show OpenShiftForm
  if (currentUser && !currentUser.has_active_shift) {
    return <OpenShiftForm />;
  }

  return <CreateSale />;
}

function CreateSale() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();

  // Get URL parameters
  const searchParams = new URLSearchParams(location.search);
  const productId = searchParams.get("productId");

  // Initialize selectedStore and check user roles
  const isAdmin = currentUser?.role === "Администратор";
  const isSuperUser = currentUser?.is_superuser === true;

  // Only fetch users if admin/superuser (sellers should not fetch)
  const usersQuery = useQuery({
    queryKey: ['users', {}],
    queryFn: async () => {
      const response = await api.get('users/');
      return response.data;
    },
    enabled: (isAdmin || isSuperUser) && currentUser?.role !== 'Продавец',
    retry: false,
  });

  const users = (isAdmin || isSuperUser) && currentUser?.role !== 'Продавец' && !usersQuery.isError
    ? (Array.isArray(usersQuery.data) ? usersQuery.data : usersQuery.data?.results || [])
    : [];
  const [selectedStore, setSelectedStore] = useState<string | null>(
    currentUser?.store_read?.id?.toString() || null,
  );
  const [cartProducts, setCartProducts] = useState<ProductInCart[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [fetchedProducts, setFetchedProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(
    null,
  );
  const searchRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Stock selection modal state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [productForStockSelection, setProductForStockSelection] =
    useState<Product | null>(null);
  const [pendingProductIndex, setPendingProductIndex] = useState<number>(-1);

  // Client creation modal state
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    type: 'Физ.лицо' as 'Физ.лицо' | 'Юр.лицо',
    name: '',
    phone_number: '+998',
    address: '',
    ceo_name: '',
    balance: 0,
  });
  const createClientMutation = useCreateClient();

  // Effect for enforcing seller's store
  useEffect(() => {
    if (!isAdmin && currentUser?.store_read?.id) {
      setSelectedStore(currentUser.store_read.id.toString());
      form.setValue("store", currentUser.store_read.id.toString());
    }
  }, [isAdmin, currentUser?.store_read?.id]);

  const form = useForm<SaleFormData>({
    defaultValues: {
      sale_items: [
        {
          product_write: productId ? Number(productId) : 0,
          selling_unit: 0,
          quantity: 1,
          price_per_unit: "0",
        },
      ],
      sale_payments: [{ payment_method: "Наличные", amount: 0 }],
      on_credit: false,
      total_amount: "0",
      discount_amount: "0",
      store: currentUser?.store_read?.id?.toString() || "0",
      sold_by: !isSuperUser && !isAdmin ? currentUser?.id : undefined,
      sale_debt: {
        client: 0,
        due_date: addDays(new Date(), 30).toISOString().split("T")[0],
        deposit_payment_method: "Наличные",
      },
    },
    mode: "onChange",
  });

  // Effect for handling store selection
  useEffect(() => {
    if (currentUser?.store_read?.id) {
      setSelectedStore(currentUser.store_read.id.toString());
      form.setValue("store", currentUser.store_read.id.toString());
    }
    if (!isSuperUser && !isAdmin && currentUser?.id) {
      form.setValue("sold_by", currentUser.id);
    }
  }, [currentUser?.store_read?.id, currentUser?.id, isAdmin, isSuperUser]);

  // For non-admin (seller), we don't show the store selection as it's automatic
  useEffect(() => {
    if (!isAdmin && currentUser?.store_read?.id) {
      form.setValue("store", currentUser.store_read.id.toString());
      form.setValue("sold_by", currentUser.id);
    }
  }, [isAdmin, currentUser?.store_read?.id, currentUser?.id]);

  // Fetch data with search term for stocks
  const { data: storesData, isLoading: storesLoading } = useGetStores({});
  const { data: clientsData } = useGetClients({
    params: form.watch("on_credit") ? { name: searchTerm } : undefined,
  });
  const createSale = useCreateSale();
  // Remove the filter to show all clients
  const clients = Array.isArray(clientsData)
    ? clientsData
    : clientsData?.results || [];

  // Prepare data arrays
  const stores = Array.isArray(storesData)
    ? storesData
    : storesData?.results || [];

  // Fetch products when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLoadingProducts(true);
      fetchAllProducts({
        product_name: productSearchTerm.length > 0 ? productSearchTerm : undefined,
      })
        .then((data) => setFetchedProducts(data))
        .catch((error) => {
          console.error("Error fetching products:", error);
          toast.error("Failed to load products");
        })
        .finally(() => setLoadingProducts(false));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [productSearchTerm]);

  // Products are already filtered by non_zero in fetchAllProducts
  const filteredProducts = fetchedProducts;

  // When the component mounts, initialize the form with default values
  useEffect(() => {
    const defaultValues: SaleFormData = {
      store: "0",
      sale_items: [
        {
          product_write: 0,
          quantity: 1,
          selling_unit: 0,
          price_per_unit: "0",
        },
      ],
      sale_payments: [
        {
          payment_method: "Наличные",
          amount: 0,
        },
      ],
      on_credit: false,
      total_amount: "0",
    };

    // If we have URL parameters, don't overwrite them with defaults
    if (!productId) {
      form.reset(defaultValues);
    } else {
      // Only set defaults for fields that haven't been set yet
      const currentValues = form.getValues();
      if (!currentValues.store) {
        form.setValue("store", defaultValues.store);
      }
      if (
        !currentValues.sale_payments ||
        currentValues.sale_payments.length === 0
      ) {
        form.setValue("sale_payments", defaultValues.sale_payments);
      }
      if (!currentValues.total_amount) {
        form.setValue("total_amount", defaultValues.total_amount);
      }
    }
  }, [form, productId]);

  // Set initial product if we have parameters from URL
  useEffect(() => {
    // Only proceed if data is loaded and we have products data
    if (!storesLoading && fetchedProducts.length > 0) {
      console.log("Setting initial values from URL params:", { productId });

      const currentSaleItems = form.getValues("sale_items");
      if (!currentSaleItems || currentSaleItems.length === 0) {
        form.setValue("sale_items", [
          {
            product_write: 0,
            quantity: 1,
            selling_unit: 0,
            price_per_unit: "0",
          },
        ]);
      }

      const handleProduct = (product: Product) => {
        // Get base unit (is_base: true) as default
        // @ts-ignore
        const defaultUnit = getBaseUnit(product.available_units) || {
          id: product.base_unit || 1,
          short_name: "шт",
          factor: 1,
          is_base: true,
        };

        // Use selling_price from product data, fallback to min_price
        const price = product.selling_price
          ? parseFloat(String(product.selling_price))
          : product.min_price
            ? parseFloat(String(product.min_price))
            : 10000;

        // Create cart item
        const newProduct: ProductInCart = {
          id: Date.now(),
          productId: product.id || 0,
          name: product.product_name,
          price: price,
          quantity: 1,
          total: price,
          product: product,
          barcode: product.barcode,
          selectedUnit: defaultUnit || null,
        };

        setCartProducts([newProduct]);

        // Set form values with explicit trigger to force re-render
        form.setValue("sale_items.0.product_write", product.id || 0, {
          shouldValidate: true,
          shouldDirty: true,
        });
        form.setValue("sale_items.0.selling_unit", defaultUnit?.id || 1, {
          shouldValidate: true,
          shouldDirty: true,
        });
        form.setValue("sale_items.0.quantity", 1, {
          shouldValidate: true,
          shouldDirty: true,
        });
        form.setValue("sale_items.0.price_per_unit", price.toString(), {
          shouldValidate: true,
          shouldDirty: true,
        });

        // Force form to re-render
        form.trigger(`sale_items.0.selling_unit`);

        updateTotalAmount();
      };

      // Use a timeout to ensure the component is fully mounted
      setTimeout(() => {
        if (productId) {
          const product = fetchedProducts.find((p) => p.id === Number(productId));
          if (product) {
            handleProduct(product);
          }
        }
      }, 200);
    }
  }, [productId, fetchedProducts, form, storesLoading]);

  // Sync form selling_unit values when cartProducts change
  useEffect(() => {
    cartProducts.forEach((cartProduct, index) => {
      if (cartProduct.selectedUnit && cartProduct.productId > 0) {
        const currentFormValue = form.getValues(
          `sale_items.${index}.selling_unit`,
        );
        if (currentFormValue !== cartProduct.selectedUnit.id) {
          form.setValue(
            `sale_items.${index}.selling_unit`,
            cartProduct.selectedUnit.id,
            {
              shouldValidate: true,
              shouldDirty: true,
            },
          );
        }
      }
    });
  }, [cartProducts, form]);

  const updateTotalAmount = () => {
    const items = form.getValues("sale_items");
    const total = items.reduce((sum, item) => {
      const quantity = item.quantity || 0;
      const pricePerUnit = parseFloat(item.price_per_unit) || 0;
      const actualTotal = quantity * pricePerUnit;
      return sum + actualTotal;
    }, 0);
    form.setValue("total_amount", total.toString());

    const discountAmount = parseFloat(form.getValues("discount_amount") || "0");
    const expectedTotal = total - discountAmount;
    const payments = form.getValues("sale_payments");
    
    if (payments.length === 1) {
      form.setValue("sale_payments.0.amount", expectedTotal);
    } else if (payments.length > 1) {
      // Adjust last payment to match expected total
      const otherPaymentsTotal = payments.slice(0, -1).reduce((sum, p) => sum + (p.amount || 0), 0);
      const lastPaymentAmount = Math.max(0, expectedTotal - otherPaymentsTotal);
      form.setValue(`sale_payments.${payments.length - 1}.amount`, lastPaymentAmount);
    }
  };

  // Helper function to add product to cart
  const addProductToCart = (
    selectedProduct: Product,
    index: number,
    stock?: Stock,
  ) => {
    // Get base unit (is_base: true) as default
    // @ts-ignore
    const defaultUnit = getBaseUnit(selectedProduct.available_units) || {
      id: selectedProduct.base_unit || 1,
      short_name: "шт",
      factor: 1,
      is_base: true,
    };

    // Use selling_price from product data, fallback to min_price
    const price = selectedProduct.selling_price
      ? parseFloat(String(selectedProduct.selling_price))
      : selectedProduct.min_price
        ? parseFloat(String(selectedProduct.min_price))
        : 10000;

    // Preserve existing quantity if product is already in cart, otherwise use 1
    const existingQuantity = cartProducts[index]?.quantity || 1;

    // Update cart products
    const newCartProducts = [...cartProducts];
    if (newCartProducts[index]) {
      newCartProducts[index] = {
        id: Date.now() + index,
        productId: selectedProduct.id || 0,
        name: selectedProduct.product_name,
        price: price,
        quantity: existingQuantity,
        total: price * existingQuantity,
        product: selectedProduct,
        barcode: selectedProduct.barcode,
        selectedUnit: defaultUnit,
        stock: stock,
        stockId: stock?.id,
      };
    } else {
      newCartProducts[index] = {
        id: Date.now() + index,
        productId: selectedProduct.id || 0,
        name: selectedProduct.product_name,
        price: price,
        quantity: 1,
        total: price,
        product: selectedProduct,
        barcode: selectedProduct.barcode,
        selectedUnit: defaultUnit,
        stock: stock,
        stockId: stock?.id,
      };
    }
    setCartProducts(newCartProducts);

    // Set form values with explicit trigger to force re-render
    form.setValue(
      `sale_items.${index}.product_write`,
      selectedProduct.id || 0,
      { shouldValidate: true, shouldDirty: true },
    );
    form.setValue(`sale_items.${index}.selling_unit`, defaultUnit?.id || 1, {
      shouldValidate: true,
      shouldDirty: true,
    });
    form.setValue(`sale_items.${index}.price_per_unit`, price.toString(), {
      shouldValidate: true,
      shouldDirty: true,
    });
    // Preserve existing quantity
    form.setValue(`sale_items.${index}.quantity`, existingQuantity, {
      shouldValidate: true,
      shouldDirty: true,
    });

    // Set stock ID if present
    if (stock?.id) {
      form.setValue(`sale_items.${index}.stock`, stock.id, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }

    // Force form to re-render the selling_unit field
    form.trigger(`sale_items.${index}.selling_unit`);

    updateTotalAmount();
  };

  const handleProductSelection = (value: string, index: number) => {
    const productId = parseInt(value, 10);
    const selectedProduct = filteredProducts.find(
      (product) => product.id === productId,
    );

    console.log("Product selected:", productId, selectedProduct?.product_name);

    if (!selectedProduct) return;

    // Check if product has quantity available
    const availableQuantity =
      typeof selectedProduct.quantity === "string"
        ? parseFloat(selectedProduct.quantity)
        : selectedProduct.quantity || 0;
    if (availableQuantity <= 0) {
      toast.error(t("messages.error.insufficient_quantity"));
      return;
    }

    // Check if product requires stock selection
    if (selectedProduct.category_read?.sell_from_stock) {
      setProductForStockSelection(selectedProduct);
      setPendingProductIndex(index);
      setIsStockModalOpen(true);
      return;
    }

    // Add product without stock
    addProductToCart(selectedProduct, index);
  };

  // Handle stock selection
  const handleStockSelect = (stock: Stock) => {
    if (productForStockSelection && pendingProductIndex >= 0) {
      addProductToCart(productForStockSelection, pendingProductIndex, stock);
      setProductForStockSelection(null);
      setPendingProductIndex(-1);
    }
  };

const handleQuantityChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const inputValue = e.target.value;
    
    // Replace comma with period for decimal separator (locale support)
    const normalizedValue = inputValue.replace(',', '.');
    
    // Allow only numbers and decimal point
    const sanitizedValue = normalizedValue.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points
    const decimalCount = (sanitizedValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      return;
    }
    
    // Allow empty input or partial decimal input (like "1.")
    if (sanitizedValue === '' || sanitizedValue === '.') {
      form.setValue(`sale_items.${index}.quantity`, sanitizedValue as any);
      
      // Update cart product with 0 quantity for calculation
      const currentProduct = cartProducts[index];
      if (currentProduct) {
        const newCartProducts = [...cartProducts];
        newCartProducts[index] = {
          ...currentProduct,
          quantity: 0,
          total: 0,
        };
        setCartProducts(newCartProducts);
      }
      updateTotalAmount();
      return;
    }

    const value = parseFloat(sanitizedValue);
    
    // If not a valid number yet (like "1."), allow it but don't validate
    if (isNaN(value)) {
      form.setValue(`sale_items.${index}.quantity`, sanitizedValue as any);
      return;
    }

    // Get the current product from cart
    const currentProduct = cartProducts[index];
    if (!currentProduct) return;

    const maxQuantity =
      typeof currentProduct.product.quantity === "string"
        ? parseFloat(currentProduct.product.quantity)
        : currentProduct.product.quantity || 0;

    if (value > maxQuantity) {
      toast.error(t("messages.error.insufficient_quantity"));
      form.setValue(`sale_items.${index}.quantity`, maxQuantity);

      // Update cart product
      const newCartProducts = [...cartProducts];
      newCartProducts[index] = {
        ...currentProduct,
        quantity: maxQuantity,
        total: currentProduct.price * maxQuantity,
      };
      setCartProducts(newCartProducts);
    } else {
      // Allow the string value (for partial input like "1.")
      form.setValue(`sale_items.${index}.quantity`, sanitizedValue as any);

      // Update cart product with the numeric value
      const newCartProducts = [...cartProducts];
      newCartProducts[index] = {
        ...currentProduct,
        quantity: value,
        total: currentProduct.price * value,
      };
      setCartProducts(newCartProducts);
    }
    updateTotalAmount();
  };

  const [usdInputValues, setUsdInputValues] = useState<{[key: number]: string}>({});

  const handleUsdChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const inputValue = e.target.value;
    const normalizedValue = inputValue.replace(',', '.');
    const sanitizedValue = normalizedValue.replace(/[^\d.]/g, '');
    const decimalCount = (sanitizedValue.match(/\./g) || []).length;
    if (decimalCount > 1) return;
    
    setUsdInputValues(prev => ({ ...prev, [index]: sanitizedValue }));
    
    const exchangeRate = form.watch(`sale_payments.${index}.exchange_rate`) || 1;
    const usdAmount = parseFloat(sanitizedValue) || 0;
    const uzsAmount = parseFloat((usdAmount * exchangeRate).toFixed(2));
    form.setValue(`sale_payments.${index}.amount`, uzsAmount);
    
    const totalAmount = parseFloat(form.getValues("total_amount") || "0");
    const discountAmount = parseFloat(form.getValues("discount_amount") || "0");
    const finalTotal = totalAmount - discountAmount;
    const changeAmount = Math.max(0, uzsAmount - finalTotal);
    form.setValue(`sale_payments.${index}.change_amount`, changeAmount);
  };



  const handlePriceChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const newValue = e.target.value.replace(/[^0-9.]/g, "");
    const newPrice = parseFloat(newValue) || 0;
    const quantity = form.getValues(`sale_items.${index}.quantity`) || 1;

    // Get the current product from cart
    const currentProduct = cartProducts[index];
    if (!currentProduct) return;

    // Update cart product with new price
    const newCartProducts = [...cartProducts];
    newCartProducts[index] = {
      ...currentProduct,
      price: newPrice,
      total: newPrice * quantity,
    };
    setCartProducts(newCartProducts);

    form.setValue(`sale_items.${index}.price_per_unit`, newValue);
    updateTotalAmount();
  };

  const handleSubmit = async (data: SaleFormData) => {
    try {
      // Calculate total_amount from items (price * quantity)
      const totalFromItems = data.sale_items.reduce((sum, item) => {
        const quantity = item.quantity || 0;
        const pricePerUnit = parseFloat(item.price_per_unit) || 0;
        return sum + (quantity * pricePerUnit);
      }, 0);
      
      const discountAmount = parseFloat(data.discount_amount || "0");
      const expectedPaymentTotal = totalFromItems - discountAmount;
      
      // Validate payment amounts sum (subtract change amount)
      const actualPaymentTotal = data.sale_payments.reduce((sum, payment) => {
        const paymentAmount = parseFloat(String(payment.amount)) || 0;
        const changeAmount = parseFloat(String(payment.change_amount)) || 0;
        return sum + (paymentAmount - changeAmount);
      }, 0);
      
      if (Math.abs(actualPaymentTotal - expectedPaymentTotal) > 0.01) {
        toast.error(`Сумма платежей (${actualPaymentTotal.toFixed(2)}) должна равняться общей сумме минус скидка (${expectedPaymentTotal.toFixed(2)})`);
        return;
      }
      
      // Set total_amount from items calculation
      data.total_amount = totalFromItems.toString();
      data.discount_amount = discountAmount.toString();

      // Set store based on user role
      if (!isAdmin && !isSuperUser && currentUser?.store_read?.id) {
        // Seller: use their own store
        data.store = currentUser.store_read.id.toString();
      } else if ((isAdmin || isSuperUser) && selectedStore) {
        // Admin/Superuser: use selected store (from selected user)
        data.store = selectedStore;
      }

      // Prevent submission if store is 0 or invalid
      if (!data.store || data.store === "0") {
        toast.error(t("validation.required", { field: t("table.store") }));
        return;
      }

      // Validate sold_by for superuser/admin
      if ((isSuperUser || isAdmin) && !data.sold_by) {
        toast.error(t("validation.required", { field: t("table.seller") }));
        return;
      }

      // Validate debt sale fields when on_credit is true
      if (data.on_credit) {
        if (!data.sale_debt?.client || data.sale_debt.client === 0) {
          toast.error(t("validation.required", { field: t("table.client") }));
          return;
        }
        if (!data.sale_debt?.due_date) {
          toast.error(t("validation.required", { field: t("table.due_date") }));
          return;
        }
      }


      // Validate all items meet minimum price requirements
      const hasInvalidPrices = data.sale_items.some((item, index) => {
        const cartProduct = cartProducts[index];
        if (cartProduct && cartProduct.product.min_price) {
          const pricePerUnit = parseFloat(item.price_per_unit);
          const minPrice = parseFloat(String(cartProduct.product.min_price));
          return pricePerUnit < minPrice;
        }
        return false;
      });

      if (hasInvalidPrices) {
        toast.error("Cannot sell below minimum price");
        return;
      }

      const formattedData = {
        store: parseInt(data.store),
        payment_method: data.sale_payments[0]?.payment_method || "Наличные",
        total_amount: Number(String(data.total_amount).replace(/,/g, "")).toFixed(2),
        discount_amount: Number(String(data.discount_amount || "0").replace(/,/g, "")).toFixed(2),
        ...(isAdmin || isSuperUser ? { sold_by: data.sold_by } : {}),
        on_credit: data.on_credit,
        sale_items: data.sale_items.map((item) => ({
          product_write: item.product_write,
          quantity: item.quantity.toString(),
          selling_unit: item.selling_unit,
          price_per_unit: item.price_per_unit,
          ...(item.stock ? { stock: item.stock } : {}),
        })),
        sale_payments: data.sale_payments.map((payment, index) => {
          const usdAmount = payment.payment_method === "Валюта" && usdInputValues[index]
            ? parseFloat(usdInputValues[index])
            : payment.payment_method === "Валюта" && payment.exchange_rate
            ? payment.amount / payment.exchange_rate
            : payment.amount;
          
          return {
            payment_method: payment.payment_method,
            amount: payment.payment_method === "Валюта" 
              ? Number(usdAmount).toFixed(2)
              : Number(String(payment.amount).replace(/,/g, "")).toFixed(2),
            ...(payment.payment_method === "Валюта" && payment.exchange_rate && {
              exchange_rate: payment.exchange_rate,
            }),
            ...(payment.payment_method === "Валюта" && payment.change_amount && {
              change_amount: Number(String(payment.change_amount).replace(/,/g, "")).toFixed(2),
            }),
          };
        }),
        ...(data.sale_debt?.client && !data.on_credit
          ? { client: data.sale_debt.client }
          : {}),
        ...(data.on_credit && data.sale_debt?.client
          ? {
              sale_debt: {
                client: data.sale_debt.client,
                due_date: data.sale_debt.due_date,
                ...(data.sale_debt.deposit
                  ? {
                      deposit: Number(
                        String(data.sale_debt.deposit).replace(/,/g, ""),
                      ).toFixed(2),
                      deposit_payment_method:
                        data.sale_debt.deposit_payment_method || "Наличные",
                    }
                  : {}),
              },
            }
          : {}),
      };

      await createSale.mutateAsync(formattedData);
      toast.success(t("messages.created_successfully"));
      navigate("/sales");
    } catch (error) {
      console.error("Error creating sale:", error);
      toast.error(t("messages.error_creating"));
    }
  };





  const addSaleItem = () => {
    const currentItems = form.getValues("sale_items") || [];
    form.setValue("sale_items", [
      ...currentItems,
      {
        product_write: 0,
        quantity: 1,
        selling_unit: 0,
        price_per_unit: "0",
      },
    ]);

    // Add empty cart product with default unit
    const defaultUnit = {
      id: 1,
      short_name: "шт",
      factor: 1,
      is_base: true,
    };

    setCartProducts([
      ...cartProducts,
      {
        id: Date.now(),
        productId: 0,
        name: "",
        price: 0,
        quantity: 1,
        total: 0,
        product: {} as Product,
        barcode: "",
        selectedUnit: defaultUnit,
      },
    ]);
  };

  const removeSaleItem = (index: number) => {
    const items = form.getValues("sale_items");
    form.setValue(
      "sale_items",
      items.filter((_, i) => i !== index),
    );

    // Remove from cart products
    const newCartProducts = cartProducts.filter((_, i) => i !== index);
    setCartProducts(newCartProducts);

    updateTotalAmount();
  };

  // Add isMobile state and handleMobileSearch
  const [isMobile, setIsMobile] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [_loadingRates, setLoadingRates] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ),
      );
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch currency rates
  const fetchCurrencyRates = async () => {
    try {
      setLoadingRates(true);
      const response = await fetch('https://test.bondify.uz/api/v1/currency/rates/');
      const data = await response.json();
      setCurrencyRates(data);
    } catch (error) {
      console.error('Error fetching currency rates:', error);
      toast.error('Ошибка загрузки курсов валют');
    } finally {
      setLoadingRates(false);
    }
  };

  // Fetch rates on component mount
  useEffect(() => {
    fetchCurrencyRates();
  }, []);
  const handleMobileSearch = (
    value: string,
    setter: (value: string) => void,
  ) => {
    if (isMobile) {
      setTimeout(() => {
        setter(value);
      }, 50);
    } else {
      setter(value);
    }
  };

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeSearchIndex !== null) {
        const currentRef = searchRefs.current[activeSearchIndex];
        if (currentRef && !currentRef.contains(event.target as Node)) {
          setActiveSearchIndex(null);
          setProductSearchTerm("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeSearchIndex]);

  // Update payment amount when discount changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "discount_amount") {
        const totalAmount = parseFloat(form.getValues("total_amount") || "0");
        const discountAmount = parseFloat(value.discount_amount || "0");
        const expectedTotal = totalAmount - discountAmount;
        const payments = form.getValues("sale_payments");
        
        if (payments.length === 1) {
          form.setValue("sale_payments.0.amount", expectedTotal);
        } else if (payments.length > 1) {
          const otherPaymentsTotal = payments.slice(0, -1).reduce((sum, p) => sum + (p.amount || 0), 0);
          const lastPaymentAmount = Math.max(0, expectedTotal - otherPaymentsTotal);
          form.setValue(`sale_payments.${payments.length - 1}.amount`, lastPaymentAmount);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Check for prices below minimum (blocking submission)
  const hasBelowMinPrices = cartProducts.some((product) => {
    if (product.product.min_price) {
      const minPrice = parseFloat(String(product.product.min_price));
      return product.price < minPrice;
    }
    return false;
  });

  return (
    <div className="container mx-auto py-4 sm:py-8 px-2 sm:px-4">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
        {t("common.create")} {t("navigation.sale")}
      </h1>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4 sm:space-y-6"
        >
          {/* Store Selection - Only shown for superuser */}
          {isSuperUser && (
            <div className="w-full sm:w-2/3 lg:w-1/2">
              <FormField
                control={form.control}
                name="store"
                rules={{ required: t("validation.required") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("table.store")}</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedStore(value);
                        // Reset sold_by when store changes
                        form.setValue("sold_by", undefined);
                      }}
                    >
                      <SelectTrigger
                        className={
                          form.formState.errors.store ? "border-red-500" : ""
                        }
                      >
                        <SelectValue
                          placeholder={t("placeholders.select_store")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem
                            key={store.id}
                            value={store.id?.toString() || ""}
                          >
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.store && (
                      <p className="text-sm text-red-500 mt-1">
                        {form.formState.errors.store.message}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Seller Selection - Only shown for superuser or admin */}
          {(isSuperUser || isAdmin) && (
            <div className="w-full sm:w-2/3 lg:w-1/2">
              <FormField
                control={form.control}
                name="sold_by"
                rules={{ required: t("validation.required") }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("table.seller")}</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => {
                        field.onChange(parseInt(value, 10));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("placeholders.select_seller")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((user:any) => {
                            const selectedStore = form.watch("store");
                            // Cast user to ExtendedUser to access store_read
                            const extendedUser = user as ExtendedUser;
                            return (
                              (user.role === "Продавец" ||
                                user.role === "Администратор") &&
                              extendedUser.store_read &&
                              (!selectedStore ||
                                extendedUser.store_read.id.toString() ===
                                  selectedStore)
                            );
                          })
                          .map((user:any) => (
                            <SelectItem
                              key={user.id}
                              value={user.id?.toString() || ""}
                            >
                              {user.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Sale Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base sm:text-lg font-semibold">
                {t("common.sale_items")}
              </h2>
              <Button type="button" onClick={addSaleItem}>
                {t("common.add_item")}
              </Button>
            </div>

            {form.watch("sale_items").map((_, index: number) => (
              <div
                key={`${index}-${cartProducts[index]?.productId || 0}`}
                className="flex flex-col sm:flex-row flex-wrap items-start gap-2 sm:gap-4 p-3 sm:p-4 border rounded-lg bg-white dark:bg-card dark:border-border shadow-sm"
              >
                <div className="w-full sm:w-[250px]">
                  <FormField
                    control={form.control}
                    name={`sale_items.${index}.product_write`}
                    rules={{ required: t("validation.required") }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("table.product")}
                        </FormLabel>
                        <div
                          className="relative"
                          ref={(el) => {
                            searchRefs.current[index] = el;
                          }}
                        >
                          <Input
                            type="text"
                            placeholder={t("placeholders.search_products")}
                            value={
                              activeSearchIndex === index
                                ? productSearchTerm
                                : ""
                            }
                            onChange={(e) => {
                              handleMobileSearch(
                                e.target.value,
                                setProductSearchTerm,
                              );
                              setActiveSearchIndex(index);
                            }}
                            onFocus={() => {
                              setActiveSearchIndex(index);
                            }}
                            className={`w-full ${
                              form.formState.errors.sale_items?.[index]
                                ?.product_write
                                ? "border-red-500"
                                : ""
                            }`}
                            autoComplete="off"
                          />
                          {activeSearchIndex === index && (
                            <div className="absolute z-50 w-full mt-1 bg-white  border-2 border-gray-300  rounded-lg shadow-xl max-h-[300px] overflow-y-auto">
                              {loadingProducts ? (
                                <div className="px-4 py-4 text-center text-gray-600 dark:text-gray-400 text-sm bg-white dark:bg-gray-800">
                                  Loading...
                                </div>
                              ) : filteredProducts.length > 0 ? (
                                filteredProducts.map((product:any) => (
                                    <div
                                      key={product.id}
                                      className="px-4 py-3 bg-white hover:bg-blue-50 active:bg-blue-100 dark:bg-gray-800 dark:hover:bg-gray-700 dark:active:bg-gray-600 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-all duration-150"
                                      onClick={() => {
                                        handleProductSelection(
                                          product.id?.toString() || "",
                                          index,
                                        );
                                        setProductSearchTerm("");
                                        setActiveSearchIndex(null);
                                      }}
                                    >
                                      <div className="flex justify-between items-center gap-2">
                                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                                          {product.product_name}
                                        </span>
                                        {currentUser?.can_view_quantity !== false && (
                                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            {(
                                              (typeof product.quantity === "string"
                                                ? parseFloat(product.quantity)
                                                : product.quantity || 0) +
                                              (typeof product.extra_quantity === "string"
                                                ? parseFloat(product.extra_quantity)
                                                : product.extra_quantity || 0)
                                            ).toFixed(2)}{" "}
                                            {product.available_units?.[0]
                                              ?.short_name || "шт"}
                                          </span>
                                        )}
                                      </div>
                                      {product.barcode && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                          {product.barcode}
                                        </div>
                                      )}
                                    </div>
                                  ))
                              ) : (
                                <div className="px-4 py-4 text-center text-gray-600 dark:text-gray-400 text-sm bg-white dark:bg-gray-800">
                                  {t("common.no_results")}
                                </div>
                              )}
                            </div>
                          )}
                          {field.value > 0 && activeSearchIndex !== index && (
                            <div className="mt-2 px-3 py-2 bg-blue-50 border border-black-300 rounded-md text-sm flex justify-between items-center shadow-sm">
                              <span className="font-medium text-black-900 ">
                                {cartProducts[index]?.name ||
                                  t("common.selected")}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSearchIndex(index);
                                  setProductSearchTerm("");
                                }}
                                className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 hover:underline text-xs font-medium"
                              >
                                {t("common.edit")}
                              </button>
                            </div>
                          )}
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="w-full sm:w-[250px]">
                  <FormField
                    key={`selling_unit_${index}_${cartProducts[index]?.productId || 0}`}
                    control={form.control}
                    name={`sale_items.${index}.selling_unit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("common.selling_unit")}
                        </FormLabel>
                        <Select
                          value={
                            cartProducts[index]?.selectedUnit?.id?.toString() ||
                            field.value?.toString() ||
                            ""
                          }
                          onValueChange={(value) => {
                            const unitId = parseInt(value, 10);
                            field.onChange(unitId);
                            // Update the cart product's selected unit
                            const selectedUnit = cartProducts[
                              index
                            ]?.product?.available_units?.find(
                              (unit) => unit.id === unitId,
                            );
                            if (selectedUnit && cartProducts[index]) {
                              const newCartProducts = [...cartProducts];
                              newCartProducts[index].selectedUnit =
                                selectedUnit;
                              setCartProducts(newCartProducts);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("placeholders.select_unit")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {cartProducts[index]?.product?.available_units?.map(
                              (unit) => (
                                <SelectItem
                                  key={unit.id}
                                  value={unit.id.toString()}
                                >
                                  {unit.short_name} {unit.is_base && "(base)"}
                                </SelectItem>
                              ),
                            ) || <SelectItem value="1">шт</SelectItem>}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="w-full sm:w-[120px]">
  <FormField
    control={form.control}
    name={`sale_items.${index}.quantity`}
    render={({ field }) => (
      <FormItem>
        <FormLabel className="text-sm font-medium">
          {t("table.quantity")}
        </FormLabel>
        <FormControl>
          <Input
            type="text"              // 👈 CHANGED FROM "number" TO "text"
            inputMode="decimal"      // 👈 ADDED THIS
            placeholder={t("placeholders.enter_quantity")}
            className="text-right"
            value={field.value?.toString() || ''} // 👈 CHANGED THIS
            onChange={(e) => handleQuantityChange(e, index)}
          />
        </FormControl>
      </FormItem>
    )}
  />
</div>

                <div className="w-full sm:w-[150px]">
                  <FormField
                    control={form.control}
                    name={`sale_items.${index}.price_per_unit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {t("table.price_per_unit")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            className="text-right font-medium"
                            {...field}
                            onChange={(e) => handlePriceChange(e, index)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {index > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removeSaleItem(index)}
                    className="mt-2 sm:mt-8"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Payment Methods */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-semibold">
              {t("table.payment_methods")}
            </h3>
            {form.watch("sale_payments").map((payment, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-end"
              >
                <FormField
                  control={form.control}
                  name={`sale_payments.${index}.payment_method`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t("table.payment_method")}</FormLabel>
                      <Select
                        value={
                          typeof field.value === "string" ? field.value : ""
                        }
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value === "Валюта") {
                            const defaultRate = currencyRates[0] ? parseFloat(currencyRates[0].rate) : 12500;
                            form.setValue(`sale_payments.${index}.exchange_rate`, defaultRate);
                            form.setValue(`sale_payments.${index}.change_amount`, 0);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Наличные">
                            {t("payment.cash")}
                          </SelectItem>
                          <SelectItem value="Click">
                            {t("payment.click")}
                          </SelectItem>
                          <SelectItem value="Карта">
                            {t("payment.card")}
                          </SelectItem>
                          <SelectItem value="Перечисление">
                            {t("payment.per")}
                          </SelectItem>
                          <SelectItem value="Валюта">
                            Валюта (USD)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                {payment.payment_method === "Валюта" ? (
                  <>
                    <FormField
                      control={form.control}
                      name={`sale_payments.${index}.amount`}
                      render={({ }) => {
                        return (
                          <FormItem className="flex-1">
                            <FormLabel>Сумма ($)</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                inputMode="decimal"
                                className="text-right"
                                value={usdInputValues[index] || ''}
                                onChange={(e) => handleUsdChange(e, index)}
                              />
                            </FormControl>
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name={`sale_payments.${index}.exchange_rate`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Курс (UZS)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => {
                                const newRate = Number(e.target.value);
                                field.onChange(newRate);
                                const currentAmount = form.watch(`sale_payments.${index}.amount`) || 0;
                                const oldRate = form.watch(`sale_payments.${index}.exchange_rate`) || 1;
                                const usdAmount = currentAmount / oldRate;
                                const uzsAmount = usdAmount * newRate;
                                const totalAmount = parseFloat(form.getValues("total_amount") || "0");
                                const discountAmount = parseFloat(form.getValues("discount_amount") || "0");
                                const finalTotal = totalAmount - discountAmount;
                                const changeAmount = Math.max(0, uzsAmount - finalTotal);
                                form.setValue(`sale_payments.${index}.amount`, uzsAmount);
                                form.setValue(`sale_payments.${index}.change_amount`, changeAmount);
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {(form.watch(`sale_payments.${index}.change_amount`) || 0) > 0 && (
                      <FormItem className="flex-1">
                        <FormLabel className="text-blue-600">Сдача</FormLabel>
                        <div className="text-lg font-bold text-blue-600 mt-2">
                          {(form.watch(`sale_payments.${index}.change_amount`) || 0).toLocaleString()} UZS
                        </div>
                      </FormItem>
                    )}
                  </>
                ) : (
                  <FormField
                    control={form.control}
                    name={`sale_payments.${index}.amount`}
                    render={({ field: { onChange, value } }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t("table.amount")}</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            value={
                              value !== undefined && value !== null
                                ? Number(value).toLocaleString()
                                : ""
                            }
                            onChange={(e) => {
                              // Remove all non-digit and non-decimal characters for parsing
                              const rawValue = e.target.value
                                .replace(/[^\d.,]/g, "")
                                .replace(/,/g, "");
                              const newAmount = parseFloat(rawValue) || 0;
                              const totalAmount = parseFloat(
                                form.watch("total_amount"),
                              );
                              const otherPaymentsTotal = form
                                .watch("sale_payments")
                                .filter((_, i) => i !== index)
                                .reduce((sum, p) => sum + (p.amount || 0), 0);

                              // Update payment amount
                              if (newAmount + otherPaymentsTotal > totalAmount) {
                                onChange(totalAmount - otherPaymentsTotal);
                              } else {
                                onChange(newAmount);
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                {index > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      const payments = form.getValues("sale_payments");
                      payments.splice(index, 1);
                      const totalAmount = parseFloat(form.watch("total_amount"));
                      const discountAmount = parseFloat(form.watch("discount_amount") || "0");
                      const expectedTotal = totalAmount - discountAmount;
                      const currentTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                      
                      if (payments.length > 0 && currentTotal !== expectedTotal) {
                        const remaining = expectedTotal - payments.slice(0, -1).reduce((sum, p) => sum + (p.amount || 0), 0);
                        payments[payments.length - 1].amount = Math.max(0, remaining);
                      }
                      form.setValue("sale_payments", payments);
                    }}
                    className="mt-0 sm:mt-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const payments = form.getValues("sale_payments");
                const totalAmount = parseFloat(form.watch("total_amount"));
                const discountAmount = parseFloat(form.watch("discount_amount") || "0");
                const expectedTotal = totalAmount - discountAmount;
                const currentTotal = payments.reduce(
                  (sum, p) => sum + (p.amount || 0),
                  0,
                );
                const remaining = expectedTotal - currentTotal;

                if (remaining > 0) {
                  payments.push({
                    payment_method: "Наличные",
                    amount: remaining,
                  });
                  form.setValue("sale_payments", payments);
                }
              }}
              className="w-full sm:w-auto"
            >
              {t("common.add_payment_method")}
            </Button>
          </div>

          {/* On Credit */}
          <div className="w-full sm:w-2/3 lg:w-1/2">
            <FormField
              control={form.control}
              name="on_credit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("table.on_credit")}</FormLabel>
                  <Select
                    value={field.value ? "true" : "false"}
                    onValueChange={(value) => {
                      const isCredit = value === "true";
                      field.onChange(isCredit);
                      if (!isCredit) {
                        form.setValue("sale_debt", undefined);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{t("common.yes")}</SelectItem>
                      <SelectItem value="false">{t("common.no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          {/* Client Selection */}
          <div className="w-full sm:w-2/3 lg:w-1/2">
            <FormField
              control={form.control}
              name="sale_debt.client"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-2">
                    <FormLabel>
                      {t("table.client")}
                      {form.watch("on_credit") && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreateClientModalOpen(true)}
                      className="h-8 text-xs"
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Создать клиента
                    </Button>
                  </div>
                  {/* Search input outside of Select */}
                  <Input
                    type="text"
                    placeholder={t("forms.search_clients")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-2"
                    autoComplete="off"
                  />
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(value) => {
                      field.onChange(parseInt(value, 10));
                      if (value && !form.getValues("on_credit")) {
                        form.setValue("on_credit", false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("placeholders.select_client")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="max-h-[200px] overflow-y-auto">
                        {clients && clients.length > 0 ? (
                          clients
                            .filter(
                              (client) =>
                                (form.watch("on_credit")
                                  ? true
                                  : client.type === "Юр.лицо") &&
                                client.name
                                  .toLowerCase()
                                  .includes(searchTerm.toLowerCase()),
                            )
                            .map((client) => (
                              <SelectItem
                                key={client.id}
                                value={client.id?.toString() || ""}
                              >
                                {client.name}{" "}
                                {client.type !== "Юр.лицо" &&
                                  `(${client.type})`}
                              </SelectItem>
                            ))
                        ) : (
                          <div className="p-2 text-center text-gray-500 text-sm">
                            No clients found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>

          {/* Credit Details */}
          {form.watch("on_credit") && (
            <div className="space-y-4 p-3 sm:p-4 border rounded-lg bg-amber-50 border-amber-200">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                  {t("common.on_credit")}
                </span>
              </h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sale_debt.due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("table.due_date")}
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sale_debt.deposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("table.deposit")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sale_debt.deposit_payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("table.payment_method")}
                      </FormLabel>
                      <Select
                        value={field.value || "Наличные"}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        defaultValue="Наличные"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите способ оплаты" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Наличные">Наличные</SelectItem>
                          <SelectItem value="Карта">Карта</SelectItem>
                          <SelectItem value="Click">Click</SelectItem>
                          <SelectItem value="Перечисление">
                            Перечисление
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* Total Amount Display */}
          <div className="mt-6 sm:mt-8 p-4 sm:p-6 border-2 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-card dark:to-card dark:border-border shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {t("table.total_amount")}
                </h3>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {parseFloat(form.watch("total_amount") || "0").toLocaleString()}
                </p>
              </div>
              
              {/* Discount Amount */}
              <div className="pt-3 border-t border-gray-300 dark:border-gray-600">
                <FormField
                  control={form.control}
                  name="discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-4">
                        <FormLabel className="text-base font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                          Скидка:
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="text-right text-lg font-semibold border-red-300 focus:border-red-500 focus:ring-red-500"
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Final Amount After Discount */}
              {parseFloat(form.watch("discount_amount") || "0") > 0 && (
                <div className="pt-3 border-t-2 border-gray-400 dark:border-gray-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-green-700 dark:text-green-400">
                      К оплате:
                    </h3>
                    <p className="text-2xl sm:text-4xl font-bold text-green-600 dark:text-green-400">
                      {(
                        parseFloat(form.watch("total_amount") || "0") -
                        parseFloat(form.watch("discount_amount") || "0")
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-4 sm:mt-6 h-10 sm:h-12 text-base sm:text-lg font-medium"
            disabled={createSale.isPending || hasBelowMinPrices}
          >
            {hasBelowMinPrices
              ? "Невозможно продать ниже минимальной цены"
              : createSale.isPending
                ? t("common.creating")
                : t("common.create")}
          </Button>
        </form>
      </Form>

      {/* Stock Selection Modal */}
      {productForStockSelection && (
        <StockSelectionModal
          isOpen={isStockModalOpen}
          onClose={() => {
            setIsStockModalOpen(false);
            setProductForStockSelection(null);
            setPendingProductIndex(-1);
          }}
          productId={productForStockSelection.id!}
          productName={productForStockSelection.product_name}
          onStockSelect={handleStockSelect}
        />
      )}

      {/* Client Creation Modal */}
      <WideDialog open={isCreateClientModalOpen} onOpenChange={setIsCreateClientModalOpen}>
        <WideDialogContent className="max-h-[90vh] overflow-auto">
          <WideDialogHeader>
            <WideDialogTitle>Создать клиента</WideDialogTitle>
          </WideDialogHeader>

          <div className="p-6 space-y-4">
            {/* Client Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Тип клиента *
              </label>
              <Select
                value={newClientData.type}
                onValueChange={(value: 'Физ.лицо' | 'Юр.лицо') => 
                  setNewClientData({ ...newClientData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Физ.лицо">Физ.лицо</SelectItem>
                  <SelectItem value="Юр.лицо">Юр.лицо</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {newClientData.type === 'Юр.лицо' ? 'Название компании' : 'Имя'} *
              </label>
              <Input
                type="text"
                placeholder={newClientData.type === 'Юр.лицо' ? 'Введите название компании' : 'Введите имя'}
                value={newClientData.name}
                onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Телефон *
              </label>
              <Input
                type="tel"
                placeholder="+998970953905"
                value={newClientData.phone_number}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.startsWith('998')) value = value.slice(3);
                  value = value.slice(0, 9);
                  setNewClientData({ ...newClientData, phone_number: '+998' + value });
                }}
                maxLength={13}
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Адрес *
              </label>
              <Input
                type="text"
                placeholder="Введите адрес"
                value={newClientData.address}
                onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
              />
            </div>

            {/* Corporate fields */}
            {newClientData.type === 'Юр.лицо' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Имя генерального директора *
                  </label>
                  <Input
                    type="text"
                    placeholder="Введите имя генерального директора"
                    value={newClientData.ceo_name}
                    onChange={(e) => setNewClientData({ ...newClientData, ceo_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Баланс *
                  </label>
                  <Input
                    type="number"
                    placeholder="Введите баланс"
                    value={newClientData.balance}
                    onChange={(e) => setNewClientData({ ...newClientData, balance: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                onClick={() => {
                  setIsCreateClientModalOpen(false);
                  setNewClientData({
                    type: 'Физ.лицо',
                    name: '',
                    phone_number: '+998',
                    address: '',
                    ceo_name: '',
                    balance: 0,
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    const dataToSubmit = newClientData.type === 'Физ.лицо'
                      ? {
                          type: newClientData.type,
                          name: newClientData.name,
                          phone_number: newClientData.phone_number,
                          address: newClientData.address,
                        }
                      : newClientData;

                    const createdClient = await createClientMutation.mutateAsync(dataToSubmit as any);
                    toast.success(t('messages.success.created', { item: t('navigation.clients') }));
                    form.setValue('sale_debt.client', createdClient.id);
                    setIsCreateClientModalOpen(false);
                    setNewClientData({
                      type: 'Физ.лицо',
                      name: '',
                      phone_number: '+998',
                      address: '',
                      ceo_name: '',
                      balance: 0,
                    });
                  } catch (error) {
                    toast.error(t('messages.error.create', { item: t('navigation.clients') }));
                    console.error('Error creating client:', error);
                  }
                }}
                className="flex-1"
                disabled={!newClientData.name || !newClientData.phone_number || !newClientData.address ||
                  (newClientData.type === 'Юр.лицо' && (!newClientData.ceo_name || newClientData.balance === undefined))}
              >
                Создать
              </Button>
            </div>
          </div>
        </WideDialogContent>
      </WideDialog>
    </div>
  );
}

export default CreateSaleWrapper;
