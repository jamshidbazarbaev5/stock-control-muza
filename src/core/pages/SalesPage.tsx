import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Printer, Settings, Settings2 } from "lucide-react";
import { ResourceTable } from "../helpers/ResourseTable";
import {
  type Sale,
  useGetSales,
  useDeleteSale,
  type SalesResponse,
} from "../api/sale";
import { type Refund, type RefundItem, useCreateRefund } from "../api/refund";
// import { useGetProducts } from '../api/product';
import { toast } from "sonner";
import {
  saleReceiptService,
  type SaleData,
} from "@/services/saleReceiptService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetRecyclings } from "@/core/api/recycling";
import {
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Wallet,
  SmartphoneNfc,
  Landmark,
  DollarSign,
} from "lucide-react";
import { type Store, useGetStores } from "@/core/api/store.ts";
import { shiftsApi } from "@/core/api/shift";

import { useQuery } from "@tanstack/react-query";
import "../../expanded-row-dark.css";
import {
  findRecyclingForStock,
  calculateRecyclingProfit,
} from "../helpers/recyclingProfitUtils";
import {
  WideDialog,
  WideDialogContent,
  WideDialogHeader,
  WideDialogTitle,
  WideDialogFooter,
} from "@/components/ui/wide-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Undo2 } from "lucide-react";
import { api } from "../api/client";

type PaginatedData<T> = { results: T[]; count: number } | T[];

// Column visibility configuration with Russian translations
const COLUMN_CONFIG = [
  { key: "sale_id", label: "ID продажи" },
  { key: "store_read", label: "Магазин" },
  { key: "discount_amount", label: "Скидка" },
  { key: "sale_payments", label: "Способ оплаты" },
  { key: "worker", label: "Работник" },
  { key: "sale_items", label: "Товары" },
  { key: "quantity", label: "Количество" },
  { key: "total_amount", label: "Общая сумма" },
  { key: "total_pure_revenue", label: "Чистая прибыль" },
  { key: "on_credit", label: "Статус" },
  { key: "sale_refunds", label: "Возврат" },
  { key: "sold_date", label: "Дата продажи" },
  { key: "actions", label: "Действия" },
];

const STORAGE_KEY = "salesPageVisibleColumns";

export default function SalesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const { data: currentUser } = useCurrentUser();
  // const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  // const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Column visibility states
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      // Default: all columns visible
      return COLUMN_CONFIG.reduce(
        (acc, col) => {
          acc[col.key] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      );
    },
  );

  // Refund modal states
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [selectedSaleForRefund, setSelectedSaleForRefund] =
    useState<Sale | null>(null);
  const [refundQuantities, setRefundQuantities] = useState<
    Record<number, string>
  >({});
  const [refundNotes, setRefundNotes] = useState("");
  const [refundPayments, setRefundPayments] = useState<
    Array<{ payment_method: string; amount: string }>
  >([]);
  const createRefund = useCreateRefund();

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  // Select all columns
  const selectAllColumns = () => {
    const allVisible = COLUMN_CONFIG.reduce(
      (acc, col) => {
        acc[col.key] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    setVisibleColumns(allVisible);
  };

  // Deselect all columns
  const deselectAllColumns = () => {
    const allHidden = COLUMN_CONFIG.reduce(
      (acc, col) => {
        acc[col.key] = false;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    setVisibleColumns(allHidden);
  };

  // Set initial states
  // const [_selectedProduct, setSelectedProduct] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [creditStatus, setCreditStatus] = useState<string>("all");
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [productName, setProductName] = useState<string>("");
  const [saleId, setSaleId] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [selectedSoldBy, setSelectedSoldBy] = useState<string>("all");

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [
    startDate,
    endDate,
    creditStatus,
    selectedStore,
    productName,
    saleId,
    selectedShift,
    selectedSoldBy,
  ]);

  const { data: storesData } = useGetStores({});
  const { data: usersData } = useQuery({
    queryKey: ['users', {}],
    queryFn: async () => {
      const response = await api.get('users/');
      return response.data;
    },
    enabled: currentUser?.role !== "Продавец",
  });
  const { data: shiftsData } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const response = await shiftsApi.getAll();
      return response.data;
    },
    enabled: currentUser?.role !== "Продавец",
  });

  const { data: salesData, isLoading } = useGetSales({
    params: {
      page,
      store: selectedStore === "all" ? undefined : selectedStore,
      start_date: startDate || undefined,
      product: productName || undefined,
      end_date: endDate || undefined,
      on_credit: creditStatus !== "all" ? creditStatus === "true" : undefined,
      sale_id: saleId || undefined,
      shift_id: selectedShift === "all" ? undefined : selectedShift,
      sold_by: selectedSoldBy === "all" ? undefined : selectedSoldBy,
    },
  });
  const getPaginatedData = <T extends { id?: number }>(
    data: PaginatedData<T> | undefined,
  ): T[] => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.results;
  };
  // const { data: productsData } = useGetProducts({});
  // const products = Array.isArray(productsData) ? productsData : productsData?.results || [];
  const stores = getPaginatedData<Store>(storesData);
  const users = Array.isArray(usersData) ? usersData : usersData?.results || [];
  const shifts = shiftsData?.results || [];
  const deleteSale = useDeleteSale();

  // Get sales array and total count
  const sales = Array.isArray(salesData) ? salesData : salesData?.results || [];
  const totalCount = Array.isArray(salesData)
    ? sales.length
    : salesData?.count || 0;

  // Extract totals data from API response
  const totalsData = !Array.isArray(salesData)
    ? (salesData as SalesResponse)
    : null;
  const totalSumAll = totalsData?.total_sum_all || 0;
  const totalSumPage = totalsData?.total_sum_page || 0;
  const totalPaymentsAll = totalsData?.total_payments_all || {};
  const totalPaymentsPage = totalsData?.total_payments_page || {};
  const totalDebtSum = totalsData?.total_debt_sum || 0;

  // Fetch recycling data
  const { data: recyclingData } = useGetRecyclings({});

  // Helper to get recycling record for a stock
  const getRecyclingRecord = (productId: number, stockId: number) => {
    if (!recyclingData?.results) return undefined;
    return findRecyclingForStock(recyclingData.results, productId, stockId);
  };

  // Log details for each sale
  useEffect(() => {
    if (sales && sales.length > 0) {
      console.group(
        `Sales Profit Calculation Details - Page ${page} (${sales.length} items)`,
      );
      sales.forEach((sale: any) => {
        logSaleDetails(sale);
      });
      console.groupEnd();
    }
  }, [sales, page]);

  // Reset page to 1 when search filters change
  useEffect(() => {
    setPage(1);
  }, [productName]);

  // Debug function to show profit calculation details
  const logSaleDetails = (sale: any) => {
    console.group(`Sale #${sale.id} Details`);
    console.log("Store:", sale.store_read?.name);

    sale.sale_items?.forEach((item: any, index: number) => {
      const product = item.product_read;

      console.group(`Item ${index + 1}: ${product?.product_name}`);
      console.log("Item ID:", item.id);
      console.log("Product ID:", product?.id);
      console.log("Category:", product?.category_read?.category_name);
      console.log("Quantity:", item.quantity);

      if (product?.measurement) {
        const measurements = product.measurement || [];
        console.log(
          "Measurements:",
          measurements.map((m: any) => ({
            from_unit: m.from_unit?.short_name,
            to_unit: m.to_unit?.short_name,
            value: m.number,
          })),
        );
      }

      console.log("\nProfit Calculation Process:");

      // First check for recycling record like in create-sale.tsx
      if (product?.id && item?.id) {
        const recyclingRecord = getRecyclingRecord(product.id, item.id);
        if (recyclingRecord) {
          console.log(
            "Calculation Type: Recycled Product (with recycling record)",
          );
          const profit = calculateRecyclingProfit(
            recyclingRecord,
            Number(item.quantity),
            Number(item.price_per_unit),
          );
          console.log(
            "Formula: See recyclingProfitUtils.calculateRecyclingProfit",
          );
          console.log("Calculation Steps:");
          console.log("1. Recycling Record:", recyclingRecord);
          console.log("2. Quantity:", item.quantity);
          console.log("3. Subtotal (custom selling price):", item.subtotal);
          console.log("4. Calculated profit:", profit);
          console.log("Note: Using recycling profit calculation");
          return;
        }
      }

      // Standard profit calculation (simplified as stock details not available in new structure)
      console.log("Calculation Type: Standard Product");
      console.log("Note: Profit calculation now handled by backend");
      console.log("Subtotal:", item.subtotal);
      console.log("Quantity:", item.quantity);
      console.log("\nFinal Values:");
      console.log("- Total Selling Price:", item.subtotal);
      console.log("- Total Pure Revenue:", sale.total_pure_revenue);
      console.groupEnd();
    });
    console.groupEnd();
  };

  const formatCurrency = (amount: string | number | undefined) => {
    return new Intl.NumberFormat("ru-RU").format(Number(amount));
  };

  // const formatDate = (dateString: string) => {
  //   try {
  //     const date = new Date(dateString);
  //     return date.toLocaleDateString('ru-RU', {
  //       year: 'numeric',
  //       month: '2-digit',
  //       day: '2-digit',
  //       hour: '2-digit',
  //       minute: '2-digit'
  //     });
  //   } catch (error) {
  //     return '-';
  //   }
  // };

  const handleDelete = async (id: number) => {
    // Find the sale to be deleted
    const saleToDelete = sales.find((sale: any) => sale.id === id);
    if (!saleToDelete) {
      toast.error(t("messages.error.delete", { item: t("navigation.sales") }));
      return;
    }
    // Don't allow deletion if on_credit is true
    // if (saleToDelete.on_credit) {
    //   toast.error("Нельзя удалить продажу с долгом");
    //   return;
    // }
    // Get the store budget and sale total_amount
    // Some store_read objects may not have budget, so fallback to 0 if missing
    const storeBudget = Number(
      saleToDelete.store_read && "budget" in saleToDelete.store_read
        ? (saleToDelete.store_read as any).budget
        : 0,
    );
    const saleAmount = Number(saleToDelete.total_amount ?? 0);
    // If deleting would make budget negative, show error
    if (storeBudget - saleAmount < 0) {
      toast.error(
        t("messages.error.delete_budget_negative", {
          item: t("navigation.sales"),
        }) || "Cannot delete: store budget would be negative.",
      );
      return;
    }

    try {
      await deleteSale.mutateAsync(id);
      toast.success(
        t("messages.success.deleted", { item: t("navigation.sales") }),
      );
      // setIsDetailsModalOpen(false);
    } catch (error) {
      toast.error(t("messages.error.delete", { item: t("navigation.sales") }));
      console.error("Failed to delete sale:", error);
    }
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setCreditStatus("all");
    setSelectedStore("all");
    setProductName("");
    setSaleId("");
    setSelectedShift("all");
    setSelectedSoldBy("all");
    setPage(1);
  };

  const handleOpenRefundModal = (sale: Sale) => {
    setSelectedSaleForRefund(sale);
    setRefundQuantities({});
    setRefundNotes("");
    setRefundPayments([{ payment_method: "Наличные", amount: "" }]);
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async () => {
    if (!selectedSaleForRefund?.id) {
      toast.error(t("errors.no_sale_selected"));
      return;
    }

    // Prepare refund items
    const refundItems: RefundItem[] = [];

    Object.entries(refundQuantities).forEach(([saleItemId, quantity]) => {
      const parsedQuantity = parseFloat(quantity);
      if (parsedQuantity > 0) {
        refundItems.push({
          sale_item: parseInt(saleItemId),
          quantity: parsedQuantity,
        });
      }
    });

    if (refundItems.length === 0) {
      toast.error(t("errors.no_items_selected_for_refund"));
      return;
    }

    if (!refundNotes.trim()) {
      toast.error(t("errors.refund_notes_required"));
      return;
    }

    // Validate refund payments
    if (refundPayments.length === 0) {
      toast.error(
        t(
          "errors.refund_payments_required",
          "Добавьте хотя бы один способ возврата",
        ),
      );
      return;
    }

    const invalidPayments = refundPayments.some(
      (p) => !p.amount || parseFloat(p.amount) <= 0,
    );
    if (invalidPayments) {
      toast.error(
        t(
          "errors.invalid_payment_amounts",
          "Укажите корректные суммы для всех способов возврата",
        ),
      );
      return;
    }

    const refundData = {
      sale: selectedSaleForRefund.id,
      notes: refundNotes,
      refund_items: refundItems,
      refund_payments: refundPayments,
    } as Refund;

    try {
      await createRefund.mutateAsync(refundData);
      toast.success(t("messages.success.refund_created"));
      // Invalidate sales query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setIsRefundModalOpen(false);
      setSelectedSaleForRefund(null);
      setRefundQuantities({});
      setRefundNotes("");
      setRefundPayments([]);
    } catch (error: any) {
      toast.error(
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          t("messages.error.refund_failed"),
      );
      console.error("Failed to create refund:", error);
    }
  };

  const handleRowClick = (row: Sale) => {
    if (row.id === expandedRowId) {
      setExpandedRowId(null);
    } else {
      setExpandedRowId(row.id || null);
    }
  };

  const renderExpandedRow = (row: Sale) => {
    const hasItems = row.sale_items?.length > 0;
    const hasRefunds = (row.sale_refunds?.length ?? 0) > 0;

    if (!hasItems && !hasRefunds) {
      return (
        <div className="p-4 text-center text-gray-500">
          {t("messages.no_items_found")}
        </div>
      );
    }

    return (
      <div className="p-2 space-y-3">
        {/* Worker Information Section */}
        {row.worker_read && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              👤 Продавец
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                Инфо
              </span>
            </h3>
            <div className="space-y-1">
              <div className="dark:bg-expanded-row-dark bg-gray-50 p-2 rounded border-l-4 border-purple-400 transition-all duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 font-medium">Имя:</span>
                    <p className="font-medium text-gray-700 text-sm break-words">
                      {row.worker_read.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Телефон:</span>
                    <p className="font-medium text-gray-700 text-sm break-words">
                      {row.worker_read.phone_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Роль:</span>
                    <p className="font-medium text-gray-700 text-sm break-words">
                      {row.worker_read.role}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Смена:</span>
                    <p className="font-medium text-sm">
                      {row.worker_read.has_active_shift ? (
                        <span className="text-green-600">✓ Активна</span>
                      ) : (
                        <span className="text-gray-500">Неактивна</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sale Items Section */}
        {hasItems && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              {t("common.sale_items")}
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {row.sale_items.length}
              </span>
            </h3>
            <div className="space-y-1">
              {row.sale_items.map((item, index) => (
                <div
                  key={index}
                  className="dark:bg-expanded-row-dark bg-gray-50 p-2 rounded border-l-4 border-blue-400 transition-all duration-200"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                    <div className="sm:col-span-1">
                      <span className="text-gray-500 font-medium text-xs">
                        #{item.id}
                      </span>
                    </div>
                    <div className="sm:col-span-1 md:col-span-2">
                      <span
                        className="font-medium text-gray-800 line-clamp-2 text-xs sm:text-sm break-words"
                        title={
                          item.stock_name
                            ? `${item.product_read?.product_name} (${item.stock_name})`
                            : item.product_read?.product_name || "-"
                        }
                      >
                        {item.stock_name
                          ? `${item.product_read?.product_name} (${item.stock_name})`
                          : item.product_read?.product_name || "-"}
                      </span>
                    </div>
                    <div className="sm:col-span-1">
                      <span className="font-medium text-gray-700 text-xs">
                        {parseFloat(item.quantity).toString()}{" "}
                        <span className="text-gray-500">
                          {item.product_read?.base_unit
                            ? item.product_read.available_units?.find(
                                (u: any) => u.id === item.selling_unit,
                              )?.short_name || ""
                            : ""}
                        </span>
                      </span>
                    </div>
                    <div className="sm:col-span-1">
                      <span className="font-semibold text-emerald-600 text-xs sm:text-sm">
                        {formatCurrency(item?.price_per_unit)}
                      </span>
                    </div>
                  </div>
                  {row.sale_debt?.client_read && (
                    <div className="mt-1 pt-1 border-t border-gray-200">
                      <div className="flex gap-3 text-xs">
                        <span
                          className="hover:underline cursor-pointer text-blue-600"
                          onClick={() => {
                            navigate(
                              `/debts/${row.sale_debt?.client_read?.id}`,
                            );
                          }}
                        >
                          {row.sale_debt.client_read.name}
                        </span>
                        <span
                          className="hover:underline cursor-pointer text-gray-600"
                          onClick={() => {
                            navigate(
                              `/debts/${row.sale_debt?.client_read?.id}`,
                            );
                          }}
                        >
                          {row.sale_debt.client_read.phone_number}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sale Refunds Section */}
        {hasRefunds && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <span className="text-red-600">🔄 Возвраты</span>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {row.sale_refunds?.length ?? 0}
              </span>
            </h3>
            <div className="space-y-1">
              {row.sale_refunds?.map((refund, refundIndex) => (
                <div
                  key={refundIndex}
                  className="border-l-4 border-red-400 pl-2 bg-red-50 rounded-r-md p-2"
                >
                  <div className="mb-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        {/*<span className="font-semibold text-red-700">*/}
                        {/*  #{refund.id}*/}
                        {/*</span>*/}
                        <span className="text-gray-600">
                          {new Date(refund.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-gray-500 text-[10px]">
                          {new Date(refund.created_at).toLocaleTimeString(
                            "ru-RU",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                        {refund.refunded_by && (
                          <span className="text-blue-600 text-[10px] bg-blue-100 px-1 py-0.5 rounded">
                            Имя: {refund.refunded_by}
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-red-700 bg-red-200 px-2 py-0.5 rounded text-xs">
                        -{formatCurrency(refund.total_refund_amount)}
                      </span>
                    </div>
                    {refund.notes && (
                      <p className="text-xs text-gray-600 italic bg-white p-1 rounded">
                        "{refund.notes}"
                      </p>
                    )}
                    {refund.refund_payments &&
                      refund.refund_payments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {refund.refund_payments.map((p: any, i: number) => (
                            <div
                              key={i}
                              className="inline-flex items-center gap-1 bg-white border border-red-200 px-2 py-0.5 rounded text-xs"
                            >
                              {p.payment_method === "Наличные" && (
                                <Wallet className="h-3.5 w-3.5 text-green-600" />
                              )}
                              {p.payment_method === "Карта" && (
                                <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                              )}
                              {p.payment_method === "Click" && (
                                <SmartphoneNfc className="h-3.5 w-3.5 text-purple-600" />
                              )}
                              {p.payment_method === "Перечисление" && (
                                <Landmark className="h-3.5 w-3.5 text-orange-500" />
                              )}
                              {p.payment_method === "Валюта" && (
                                <DollarSign className="h-3.5 w-3.5 text-yellow-600" />
                              )}
                              <span className="text-gray-700">
                                {p.payment_method}:
                              </span>
                              <span className="font-medium text-red-700">
                                - {formatCurrency(p.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                  <div className="space-y-1">
                    {refund.refund_items.map((refundItem, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="bg-white p-1 rounded border border-red-200"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs items-center">
                          <div className="sm:col-span-2">
                            <span className="font-medium text-gray-800 text-xs sm:text-sm line-clamp-2 break-words">
                              {refundItem.sale_item.stock_name
                                ? `${refundItem.sale_item.product_read?.product_name} (${refundItem.sale_item.stock_name})`
                                : refundItem.sale_item.product_read
                                    ?.product_name || "-"}
                            </span>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-gray-600 text-xs">
                              Кол-во:{" "}
                              {parseFloat(refundItem.quantity).toString()}
                            </div>
                            <div className="font-medium text-red-600 text-xs">
                              {formatCurrency(refundItem.subtotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle manual thermal printing (like POSInterface but not automatic)
  const handlePrintReceipt = async (sale: Sale) => {
    try {
      console.log("🖨️ Printing sale receipt manually...");
      const printResult = await saleReceiptService.printWithFallback(
        sale as unknown as SaleData,
      );
      saleReceiptService.showPrintNotification(printResult);
      console.log("🖨️ Receipt print result:", printResult);
    } catch (printError) {
      console.error("❌ Receipt printing failed:", printError);
      saleReceiptService.showPrintNotification({
        success: false,
        method: "failed",
        message: "Не удалось напечатать чек",
        error:
          printError instanceof Error ? printError.message : "Unknown error",
      });
    }
  };

  const allColumns = [
    {
      header: "ID продажи",
      accessorKey: "sale_id",
      cell: (row: Sale) => row.sale_id || "-",
    },
    {
      header: t("table.store"),
      accessorKey: "store_read",
      cell: (row: Sale) => row.store_read?.name || "-",
    },
    {
      header: t("table.payment_method"),
      accessorKey: "sale_payments",
      cell: (row: any) => (
        <div className="flex flex-col items-center gap-1">
          {row.sale_payments.map((payment: any, index: number) => (
            <div
              key={index}
              className="flex items-center gap-1 text-xs justify-center"
            >
              {payment.payment_method === "Наличные" && (
                <Wallet className="h-4 w-4 text-green-600" />
              )}
              {payment.payment_method === "Карта" && (
                <CreditCard className="h-4 w-4 text-blue-600" />
              )}
              {payment.payment_method === "Click" && (
                <SmartphoneNfc className="h-4 w-4 text-purple-600" />
              )}
              {payment.payment_method === "Перечисление" && (
                <Landmark className="h-4 w-4 text-orange-500" />
              )}
              {payment.payment_method === "Валюта" && (
                <DollarSign className="h-4 w-4 text-yellow-600" />
              )}
              <span className="whitespace-nowrap">
                {formatCurrency(payment.amount)}
              </span>
              {payment.change_amount && parseFloat(payment.change_amount) > 0 && (
                <span className="text-gray-500">
                  (сдача: {formatCurrency(payment.change_amount)})
                </span>
              )}
            </div>
          ))}
        </div>
      ),
    },
     {
      header: t("table.discount_amount"),
      accessorKey: "discount_amount",
      cell: (row: any) => row?.discount_amount,
    },
    {
      header: t("table.worker"),
      accessorKey: "worker",
      cell: (row: any) => row?.worker_read?.name,
    },
    {
      header: t("table.items"),
      accessorKey: "sale_items",
      cell: (row: Sale) => {
        if (!row.sale_items?.length) return "-";
        const itemsText = row.sale_items
          .map((item) => {
            const product = item.product_read?.product_name || "-";
            const stockName = item.stock_name;
            return stockName ? `${product} (${stockName})` : product;
          })
          .join(" • ");
        return (
          <div className="max-w-[300px]">
            <p className="text-sm truncate" title={itemsText}>
              {itemsText}
            </p>
          </div>
        );
      },
    },
    {
      header: t("table.quantity"),
      accessorKey: "quantity",
      cell: (row: Sale) => {
        if (!row.sale_items?.length) return "-";
        const quantities = row.sale_items
          .map((item) => {
            const unitName =
              item.product_read?.available_units?.find(
                (u: any) => u.id === item.selling_unit,
              )?.short_name || "";
            // Format quantity to remove trailing zeros
            const formattedQuantity = parseFloat(item.quantity).toString();
            return `${formattedQuantity} ${unitName}`;
          })
          .join(" • ");
        return (
          <div className="max-w-[200px]">
            <p className="text-sm truncate" title={quantities}>
              {quantities}
            </p>
          </div>
        );
      },
    },
    {
      header: t("table.total_amount"),
      accessorKey: "total_amount",
      cell: (row: Sale) => (
        <span className="font-medium text-emerald-600">
          {formatCurrency(row.total_amount)}
        </span>
      ),
    },
    // Show for all superusers OR if role is Администратор
    ...(currentUser?.is_superuser || currentUser?.role === "Администратор"
      ? [
          {
            header: t("table.total_pure_revenue"),
            accessorKey: "total_pure_revenue",
            cell: (row: Sale) => (
              <span className="font-medium text-emerald-600">
                {formatCurrency(row.total_pure_revenue || "0")}
              </span>
            ),
          },
        ]
      : []),
    {
      header: t("table.status"),
      accessorKey: "on_credit",
      cell: (row: Sale) => (
        <div className="flex flex-col gap-1">
          {row.is_paid ? (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <CheckCircle2 className="h-3 w-3" />
              {t("common.paid")}
            </div>
          ) : (
            <div
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                row.on_credit
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {row.on_credit ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {row.on_credit ? t("common.on_credit") : t("common.paid2")}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Возврат",
      accessorKey: "sale_refunds",
      cell: (row: Sale) => (
        <div className="flex items-center justify-center">
          {row.sale_refunds && row.sale_refunds.length > 0 ? (
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                {row.sale_refunds.length}
              </span>
              <span className="text-xs text-red-600">возврат</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      ),
    },
    {
      header: t("table.sold_date"),
      accessorKey: "sold_date",
      cell: (row: Sale) => (
        <div className="whitespace-nowrap">
          {row.sold_date
            ? new Date(row.sold_date).toLocaleDateString("ru-RU", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-"}
        </div>
      ),
    },
    {
      header: t("common.actions"),
      accessorKey: "actions",
      cell: (row: Sale) => (
        <div className="flex items-center gap-2">
          {currentUser?.is_mobile_user === false && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintReceipt(row)}
            >
              <Printer className="w-4 h-4 mr-2" />
              {t("common.print")}
            </Button>
          )}
          {(currentUser?.role === "Продавец" || currentUser?.is_superuser) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm("Вы уверены, что хотите удалить эту продажу?")) {
                  handleDelete(row.id!);
                }
              }}
            >
              {t("common.delete")}
            </Button>
          )}
        </div>
      ),
    },
    // {
    //   header: t('common.actions'),
    //   accessorKey: 'actions',
    //   cell: (row: Sale) => (
    //     <div className="flex items-center gap-2">
    //       <Button
    //         variant="outline"
    //         size="sm"
    //         onClick={() => {
    //           setSelectedSale(row);
    //           setIsDetailsModalOpen(true);
    //         }}
    //       >
    //         {t('common.details')}
    //       </Button>
    //     </div>
    //   ),
    // }
  ];

  // Filter columns based on visibility settings
  const columns = allColumns.filter((col) => visibleColumns[col.accessorKey]);

  return (
    <div className="container mx-auto py-4 sm:py-6 md:py-8 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">
          {t("navigation.sales")}
        </h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsColumnModalOpen(true)}
            className="flex-1 sm:flex-none sm:w-auto"
            size="sm"
          >
            <Settings className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Настройки</span>
          </Button>
          {!currentUser?.is_superuser && (
            <Button
              onClick={() => navigate("/create-sale")}
              className="bg-primary hover:bg-primary/90 flex-1 sm:flex-none sm:w-auto"
              size="sm"
            >
              {t("common.create")}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {/* <Card className="p-3 sm:p-4 mb-4 sm:mb-6"> */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-medium">
          {t("common.filters")}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearFilters}
          className="w-full sm:w-auto"
        >
          {t("common.reset") || "Сбросить"}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("forms.type_product_name")}
          </label>
          <Input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder={t("forms.type_product_name")}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">ID продажи</label>
          <Input
            type="text"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            placeholder="Введите ID продажи"
            className="w-full"
          />
        </div>
        {currentUser?.is_superuser && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("forms.select_store")}
            </label>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("forms.select_store")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("forms.all_stores")}</SelectItem>
                {stores?.map((store: Store) =>
                  store.id ? (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.name}
                    </SelectItem>
                  ) : null,
                ) || null}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentUser?.role !== "Продавец" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("forms.start_date")}</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("forms.end_date")}</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("table.credit_status")}
          </label>
          <Select value={creditStatus} onValueChange={setCreditStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("placeholders.select_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="true">{t("common.on_credit")}</SelectItem>
              <SelectItem value="false">{t("common.paid2")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {currentUser?.role !== "Продавец" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Смена</label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите смену" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все смены</SelectItem>
                  {shifts?.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id.toString()}>
                      Смена #{shift.id} - {shift.cashier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Продавец</label>
              <Select value={selectedSoldBy} onValueChange={setSelectedSoldBy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите продавца" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все продавцы</SelectItem>
                  {users?.map((user:any) =>
                    user.id ? (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ) : null,
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
      {/* </Card> */}

      {/* Table */}
      <div className="overflow-hidden rounded-lg mb-4 sm:mb-6">
        <Card className="overflow-x-auto">
          <div className="min-w-[320px] sm:min-w-[800px]">
            <ResourceTable
              data={sales}
              columns={columns}
              isLoading={isLoading}
              onDelete={
                currentUser?.is_mobile_user === false &&
                currentUser?.role !== "Продавец"
                  ? handleDelete
                  : undefined
              }
              // canDelete={(sale: Sale) => !sale.on_credit}
              totalCount={totalCount}
              onRefund={
                currentUser?.is_mobile_user === false &&
                (currentUser?.role === "Продавец" ||
                  currentUser?.role === "Админ")
                  ? handleOpenRefundModal
                  : undefined
              }
              canRefund={(sale: Sale) => !sale.on_credit}
              pageSize={30}
              currentPage={page}
              onPageChange={(newPage) => setPage(newPage)}
              expandedRowRenderer={(row: Sale) => renderExpandedRow(row)}
              onRowClick={(row: Sale) => handleRowClick(row)}
            />
          </div>
        </Card>
      </div>

      {/* Totals Summary Section */}
      {totalsData && (
        <Card className="p-4 sm:p-6 mb-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Итоги</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sum All */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600">
                    Общая сумма (все)
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(totalSumAll)} UZS
                </p>
              </div>

              {/* Total Sum Page */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-600">
                    Сумма на странице
                  </span>
                </div>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(totalSumPage)} UZS
                </p>
              </div>

              {/* Total Debt */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium text-gray-600">
                    Общий долг
                  </span>
                </div>
                <p className="text-2xl font-bold text-amber-700">
                  {formatCurrency(totalDebtSum)} UZS
                </p>
              </div>

              {/* Placeholder for balance */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-600">
                    Всего записей
                  </span>
                </div>
                <p className="text-2xl font-bold text-purple-700">
                  {totalCount}
                </p>
              </div>
            </div>

            {/* Payment Methods - All Pages */}
            <div className="mt-6">
              <h4 className="text-md font-semibold text-gray-700 mb-3">
                Способы оплаты (все страницы)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(totalPaymentsAll).map(([method, amount]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      {method === "Наличные" && (
                        <Wallet className="h-5 w-5 text-green-600" />
                      )}
                      {method === "Карта" && (
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      )}
                        {method === "Click" && (
                        <SmartphoneNfc className="h-5 w-5 text-purple-600" />
                      )}
                      {!["Наличные", "Карта", "Click"].includes(method) && (
                        <Landmark className="h-5 w-5 text-gray-600" />
                      )}
                      <span className="font- medium text-gray-700">
                        {method}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(amount)} UZS
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Methods - Current Page */}
            <div className="mt-4">
              <h4 className="text-md font-semibold text-gray-700 mb-3">
                Способы оплаты (текущая страница)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(totalPaymentsPage).map(([method, amount]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      {method === "Наличные" && (
                        <Wallet className="h-5 w-5 text-green-600" />
                      )}
                      {method === "Карта" && (
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      )}
                      {method === "Click" && (
                        <SmartphoneNfc className="h-5 w-5 text-purple-600" />
                      )}
                      {!["Наличные", "Карта", "Click"].includes(method) && (
                        <Landmark className="h-5 w-5 text-gray-600" />
                      )}
                      <span className="font-medium text-gray-700">
                        {method}
                      </span>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(amount)} UZS
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/*<Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>*/}
      {/*  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">*/}
      {/*    <DialogHeader className="border-b p-6">*/}
      {/*      <DialogTitle className="flex items-center gap-2 text-xl">*/}
      {/*        <span>{t('navigation.sales')} #{selectedSale?.id}</span>*/}
      {/*        {selectedSale?.on_credit && (*/}
      {/*          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">*/}
      {/*            <AlertCircle className="h-3 w-3" />*/}
      {/*            {t('common.on_credit')}*/}
      {/*          </span>*/}
      {/*        )}*/}
      {/*      </DialogTitle>*/}
      {/*    </DialogHeader>*/}
      {/*    */}
      {/*    <ScrollArea className="flex-1 p-6">*/}
      {/*      {selectedSale && (*/}
      {/*        <div className="space-y-6">*/}
      {/*          /!* Header Information *!/*/}
      {/*          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-50 p-4 rounded-lg">*/}
      {/*            <div className="flex items-start gap-2">*/}
      {/*              <Store className="h-5 w-5 text-gray-400 mt-0.5" />*/}
      {/*              <div>*/}
      {/*                <h3 className="font-medium text-gray-500 text-sm">{t('table.store')}</h3>*/}
      {/*                <p className="text-gray-900 font-medium">{selectedSale.store_read?.name || '-'}</p>*/}
      {/*              </div>*/}
      {/*            </div>*/}
      {/*            <div className="flex items-start gap-2">*/}
      {/*              <div className="flex-shrink-0">*/}
      {/*                {selectedSale?.sale_payments?.[0]?.payment_method === 'Наличные' && <Wallet className="h-5 w-5 text-green-500 mt-0.5" />}*/}
      {/*                {selectedSale?.sale_payments?.[0]?.payment_method === 'Карта' && <CreditCard className="h-5 w-5 text-blue-500 mt-0.5" />}*/}
      {/*                {selectedSale?.sale_payments?.[0]?.payment_method === 'Click' && <SmartphoneNfc className="h-5 w-5 text-purple-500 mt-0.5" />}*/}
      {/*              </div>*/}
      {/*              <div>*/}
      {/*                <h3 className="font-medium text-gray-500 text-sm">{t('table.payment_method')}</h3>*/}
      {/*                <div className="space-y-1">*/}
      {/*                  {selectedSale?.sale_payments?.map((payment, index) => (*/}
      {/*                    <div key={index} className="flex items-center gap-2">*/}
      {/*                      {payment.payment_method === 'Наличные' && <span className="text-green-600 font-medium">Наличные</span>}*/}
      {/*                      {payment.payment_method === 'Карта' && <span className="text-blue-600 font-medium">Карта</span>}*/}
      {/*                      {payment.payment_method === 'Click' && <span className="text-purple-600 font-medium">Click</span>}*/}
      {/*                      <span className="text-sm text-gray-600">({formatCurrency(payment.amount)} UZS)</span>*/}
      {/*                    </div>*/}
      {/*                  ))}*/}
      {/*                </div>*/}
      {/*              </div>*/}
      {/*            </div>*/}
      {/*            <div className="flex items-start gap-2">*/}
      {/*              <Tag className="h-5 w-5 text-emerald-500 mt-0.5" />*/}
      {/*              <div>*/}
      {/*                <h3 className="font-medium text-gray-500 text-sm">{t('forms.total_amount')}</h3>*/}
      {/*                <p className="font-medium text-emerald-600">{formatCurrency(selectedSale.total_amount)} UZS</p>*/}
      {/*              </div>*/}
      {/*            </div>*/}
      {/*            <div className="flex items-start gap-2">*/}
      {/*              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />*/}
      {/*              <div>*/}
      {/*                <h3 className="font-medium text-gray-500 text-sm">{t('forms.payment_date')}</h3>*/}
      {/*                <p className="text-gray-900">{selectedSale.created_at ? formatDate(selectedSale.created_at) : '-'}</p>*/}
      {/*              </div>*/}
      {/*            </div>*/}
      {/*          </div>*/}

      {/*          /!* Sale Items *!/*/}
      {/*          <div className="bg-white rounded-lg">*/}
      {/*            <h3 className="font-semibold text-gray-800 mb-3 text-lg flex items-center gap-2">*/}
      {/*              {t('common.sale_items')} */}
      {/*              <span className="text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">*/}
      {/*                {selectedSale.sale_items?.length || 0}*/}
      {/*              </span>*/}
      {/*            </h3>*/}
      {/*            <div className="space-y-3">*/}
      {/*              {selectedSale.sale_items?.map((item, index) => (*/}
      {/*                <div key={index} className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-all duration-200">*/}
      {/*                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">*/}
      {/*                    <div>*/}
      {/*                      <span className="text-sm text-gray-500 block mb-1">{t('table.product')}</span>*/}
      {/*                      <span className="font-medium line-clamp-2" title={item.stock_read?.product_read?.product_name || '-'}>*/}
      {/*                        {item.stock_read?.product_read?.product_name || '-'}*/}
      {/*                      </span>*/}
      {/*                    </div>*/}
      {/*                    <div>*/}
      {/*                      <span className="text-sm text-gray-500 block mb-1">{t('table.quantity')}</span>*/}
      {/*                      <span className="font-medium">*/}
      {/*                        {item.quantity} {item.selling_method === 'Штук' ? t('table.pieces') : t('table.measurement')}*/}
      {/*                      </span>*/}
      {/*                    </div>*/}
      {/*                    <div>*/}
      {/*                      <span className="text-sm text-gray-500 block mb-1">{t('table.price')}</span>*/}
      {/*                      <span className="font-medium">*/}
      {/*                        {formatCurrency(Number(item.subtotal) / Number(item.quantity))} */}
      {/*                      </span>*/}
      {/*                    </div>*/}
      {/*                    <div>*/}
      {/*                      <span className="text-sm text-gray-500 block mb-1">{t('forms.amount3')}</span>*/}
      {/*                      <span className="font-medium text-emerald-600">{formatCurrency(item.subtotal)}</span>*/}
      {/*                    </div>*/}
      {/*                  </div>*/}
      {/*                </div>*/}
      {/*              ))}*/}
      {/*            </div>*/}
      {/*          </div>*/}

      {/*          /!* Credit Information *!/*/}
      {/*          {selectedSale.on_credit && selectedSale.sale_debt && (*/}
      {/*            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">*/}
      {/*              <h3 className="font-semibold text-gray-800 mb-3 text-lg flex items-center gap-2">*/}
      {/*                {t('table.credit_info')}*/}
      {/*                <span className="text-xs bg-amber-200 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">*/}
      {/*                  <AlertCircle className="h-3 w-3" />*/}
      {/*                  {t('common.on_credit')}*/}
      {/*                </span>*/}
      {/*              </h3>*/}
      {/*              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">*/}
      {/*                <div>*/}
      {/*                  <span className="text-sm text-gray-500 block mb-1">{t('table.client')}</span>*/}
      {/*                  <div className="font-medium flex flex-col">*/}
      {/*                    <span>{selectedSale.sale_debt.client_read?.name || '-'}</span>*/}
      {/*                    {selectedSale.sale_debt.client_read?.phone_number && (*/}
      {/*                      <span className="text-sm text-amber-600">*/}
      {/*                        {selectedSale.sale_debt.client_read.phone_number}*/}
      {/*                      </span>*/}
      {/*                    )}*/}
      {/*                  </div>*/}
      {/*                </div>*/}
      {/*                <div>*/}
      {/*                  <span className="text-sm text-gray-500 block mb-1">{t('forms.due_date')}</span>*/}
      {/*                  <span className="font-medium">*/}
      {/*                    {selectedSale.sale_debt.due_date ? formatDate(selectedSale.sale_debt.due_date) : '-'}*/}
      {/*                  </span>*/}
      {/*                </div>*/}
      {/*              </div>*/}
      {/*            </div>*/}
      {/*          )}*/}
      {/*        </div>*/}
      {/*      )}*/}
      {/*    </ScrollArea>*/}

      {/*    <div className="border-t p-6 mt-auto flex justify-between items-center">*/}
      {/*      <Button */}
      {/*        variant="destructive"*/}
      {/*        size="sm"*/}
      {/*        onClick={() => handleDelete(selectedSale?.id || 0)}*/}
      {/*      >*/}
      {/*        {t('common.delete')}*/}
      {/*      </Button>*/}
      {/*      <div className="flex gap-2">*/}
      {/*        <Button */}
      {/*          variant="outline" */}
      {/*          onClick={() => setIsDetailsModalOpen(false)}*/}
      {/*        >*/}
      {/*          {t('common.close')}*/}
      {/*        </Button>*/}
      {/*        <Button */}
      {/*          variant="default"*/}
      {/*          onClick={() => navigate(`/edit-sale/${selectedSale?.id}`)}*/}
      {/*        >*/}
      {/*          {t('common.edit')}*/}
      {/*        </Button>*/}
      {/*      </div>*/}
      {/*    </div>*/}
      {/*  </DialogContent>*/}
      {/*</Dialog>*/}

      {/* Refund Modal */}
      <WideDialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
        <WideDialogContent
          className="max-h-[90vh] overflow-hidden p-0"
          width="wide"
        >
          <WideDialogHeader className="p-6 pb-4 border-b">
            <WideDialogTitle className="text-xl font-bold flex items-center gap-2">
              <Undo2 className="h-5 w-5" />
              {t("common.refund")} - {t("navigation.sales")} #
              {selectedSaleForRefund?.id}
            </WideDialogTitle>
          </WideDialogHeader>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {selectedSaleForRefund && (
              <div className="space-y-6">
                {/* Sale Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">
                    {t("table.sale_info")}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">{t("table.store")}:</span>
                      <span className="ml-2 font-medium break-words">
                        {selectedSaleForRefund.store_read?.name || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("table.total_amount")}:
                      </span>
                      <span className="ml-2 font-medium text-emerald-600 break-words">
                        {formatCurrency(selectedSaleForRefund.total_amount)} UZS
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t("forms.date")}:</span>
                      <span className="ml-2 font-medium">
                        {selectedSaleForRefund.created_at
                          ? new Date(
                              selectedSaleForRefund.created_at,
                            ).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                    {selectedSaleForRefund.sale_debt?.client_read && (
                      <div>
                        <span className="text-gray-500">
                          {t("table.client")}:
                        </span>
                        <span className="ml-2 font-medium break-words">
                          {selectedSaleForRefund.sale_debt.client_read.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Refund Items Selection */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">
                    {t("common.select_items_for_refund")}
                  </h3>
                  <div className="space-y-3">
                    {selectedSaleForRefund.sale_items?.map((item) => {
                      const product = item.product_read;
                      const maxQuantity = parseFloat(item.quantity);

                      return (
                        <div
                          key={item.id}
                          className="bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                            <div className="md:col-span-2">
                              <div className="font-medium">
                                {product?.product_name || "-"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {t("table.quantity")}: {item.quantity}{" "}
                                {product?.available_units?.find(
                                  (u: any) => u.id === item.selling_unit,
                                )?.short_name || ""}
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-gray-500">
                                Цена за единицу
                              </div>
                              <div className="font-medium text-green-600">
                                {formatCurrency(item?.price_per_unit || "0")}{" "}
                                UZS
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-gray-500">
                                {t("table.price")}
                              </div>
                              <div className="font-medium">
                                {formatCurrency(
                                  (
                                    parseFloat(item?.price_per_unit || "0") /
                                    parseFloat(item.quantity.toString())
                                  ).toString(),
                                )}{" "}
                                UZS
                              </div>
                            </div>

                            <div>
                              <label className="text-sm text-gray-600 mb-1 block">
                                {t("common.refund_quantity")}
                              </label>
                              <Input
                                type="number"
                                min="0"
                                max={maxQuantity}
                                step="0.01"
                                value={refundQuantities[item.id!] || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const numValue = parseFloat(value);

                                  if (numValue > maxQuantity) {
                                    toast.error(
                                      `${t("errors.max_quantity")}: ${maxQuantity}`,
                                    );
                                    return;
                                  }

                                  // Update refund quantities
                                  setRefundQuantities((prev) => ({
                                    ...prev,
                                    [item.id!]: value,
                                  }));

                                  // Auto-calculate and update refund payment amount
                                  if (numValue > 0) {
                                    const refundAmount = (
                                      parseFloat(item?.price_per_unit || "0") *
                                      numValue
                                    ).toFixed(2);
                                    setRefundPayments((prev) => {
                                      const updated = [...prev];
                                      if (updated.length === 0) {
                                        updated.push({
                                          payment_method: "Наличные",
                                          amount: refundAmount,
                                        });
                                      } else {
                                        // Calculate total from all refund items
                                        let totalRefundAmount = 0;
                                        Object.entries(
                                          refundQuantities,
                                        ).forEach(([saleItemId, qty]) => {
                                          const foundItem =
                                            selectedSaleForRefund.sale_items?.find(
                                              (si) =>
                                                si.id?.toString() ===
                                                saleItemId,
                                            );
                                          if (foundItem && qty) {
                                            totalRefundAmount +=
                                              parseFloat(
                                                foundItem.price_per_unit || "0",
                                              ) * parseFloat(qty);
                                          }
                                        });
                                        // Add current item amount
                                        totalRefundAmount +=
                                          parseFloat(
                                            item?.price_per_unit || "0",
                                          ) * numValue;
                                        updated[0].amount =
                                          totalRefundAmount.toFixed(2);
                                      }
                                      return updated;
                                    });
                                  }
                                }}
                                placeholder={`0 - ${maxQuantity}`}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Refund Payments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-700">
                      {t("common.refund_payments", "Методы возврата")}
                      <span className="text-red-500">*</span>
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setRefundPayments([
                          ...refundPayments,
                          { payment_method: "Наличные", amount: "" },
                        ])
                      }
                    >
                      + Добавить платёж
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {refundPayments.map((payment, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[200px_1fr_auto] gap-3 items-center bg-gray-50 p-4 rounded-lg"
                      >
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Метод платежа
                          </label>
                          <Select
                            value={payment.payment_method}
                            onValueChange={(value) => {
                              const updated = [...refundPayments];
                              updated[index].payment_method = value;
                              setRefundPayments(updated);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
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
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Сумма
                          </label>
                          <Input
                            type="number"
                            value={payment.amount}
                            onChange={(e) => {
                              const updated = [...refundPayments];
                              updated[index].amount = e.target.value;
                              setRefundPayments(updated);
                            }}
                            placeholder="Введите сумму возврата"
                            className="w-full"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="self-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (refundPayments.length > 1) {
                                const updated = refundPayments.filter(
                                  (_, i) => i !== index,
                                );
                                setRefundPayments(updated);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 h-9 w-9 p-0"
                            disabled={refundPayments.length === 1}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="font-medium text-gray-700 mb-2 block">
                    {t("common.notes")} <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    placeholder={t("placeholders.refund_notes")}
                    rows={3}
                    className="w-full"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <WideDialogFooter className="p-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsRefundModalOpen(false);
                setSelectedSaleForRefund(null);
                setRefundQuantities({});
                setRefundNotes("");
                setRefundPayments([]);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleRefundSubmit}
              disabled={createRefund.isPending || !refundNotes.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              {createRefund.isPending ? (
                <>{t("common.processing")}...</>
              ) : (
                <>{t("common.confirm_refund")}</>
              )}
            </Button>
          </WideDialogFooter>
        </WideDialogContent>
      </WideDialog>

      {/* Column Visibility Modal */}
      <Dialog open={isColumnModalOpen} onOpenChange={setIsColumnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Настройка колонок таблицы
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllColumns}
                className="flex-1"
              >
                Выбрать все
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAllColumns}
                className="flex-1"
              >
                Снять все
              </Button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {COLUMN_CONFIG.map((column) => (
                <div
                  key={column.key}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Checkbox
                    id={column.key}
                    checked={visibleColumns[column.key]}
                    onCheckedChange={() => toggleColumn(column.key)}
                  />
                  <label
                    htmlFor={column.key}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsColumnModalOpen(false)}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
