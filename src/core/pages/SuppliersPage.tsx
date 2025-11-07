import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ResourceTable } from "../helpers/ResourseTable";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ResourceForm } from "../helpers/ResourceForm";
import { toast } from "sonner";
import {
  type Supplier,
  useGetSuppliers,
  useUpdateSupplier,
  useDeleteSupplier,
  useAddSupplierBalance,
  type AddSupplierBalanceRequest,
} from "../api/supplier";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

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
import { useGetStores, type Store } from "../api/store";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, ArrowUp, ArrowDown, CreditCard } from "lucide-react";

const supplierFields = (t: (key: string) => string) => [
  {
    name: "name",
    label: t("forms.supplier_name"),
    type: "text",
    placeholder: t("placeholders.enter_name"),
    required: true,
  },
  {
    name: "phone_number",
    label: t("forms.phone"),
    type: "text",
    placeholder: t("placeholders.enter_phone"),
    required: true,
  },
];

const formatPrice = (value: number | string | null | undefined) => {
  if (value === undefined || value === null || value === "") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const columns = (t: (key: string) => string) => [
  {
    header: t("table.name"),
    accessorKey: "name",
  },
  {
    header: t("table.phone"),
    accessorKey: "phone_number",
  },
  {
    header: t("table.balance"),
    accessorKey: "balance",
    cell: (row: Supplier) => formatPrice(row.balance),
  },
  {
    header: t("table.total_debt"),
    accessorKey: "total_debt",
    cell: (row: Supplier) => formatPrice(row.total_debt),
  },
  {
    header: t("table.total_paid"),
    accessorKey: "total_paid",
    cell: (row: Supplier) => formatPrice(row.total_paid),
  },
  {
    header: t("table.remaining_debt"),
    accessorKey: "remaining_debt",
    cell: (row: Supplier) => formatPrice(row.remaining_debt),
  },
];

export default function SuppliersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false);
  const [selectedSupplierForBalance, setSelectedSupplierForBalance] =
      useState<Supplier | null>(null);
  const [balanceForm, setBalanceForm] = useState({
    store: "",
    amount: "",
    payment_method: "Наличные",
    exchange_rate: "",
  });
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isMassPaymentDialogOpen, setIsMassPaymentDialogOpen] = useState(false);
  const [massPaymentForm, setMassPaymentForm] = useState({
    supplier: "",
    store: "",
    amount: "",
    payment_type: "Наличные" as "Наличные" | "Карта" | "Click" | "Перечисление" | "Валюта",
    comment: "",
    exchange_rate: "",
  });
  const [selectedMassPaymentStore, setSelectedMassPaymentStore] = useState<Store | null>(null);

  // Queries and Mutations
  const { data: suppliersData, isLoading } = useGetSuppliers({
    params: { page },
  });
  const { data: storesData } = useGetStores({});
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const addSupplierBalance = useAddSupplierBalance();

  const massPayment = useMutation({
    mutationFn: async (data: {
      supplier: number;
      store: number;
      amount: number;
      payment_type: "Наличные" | "Карта" | "Click" | "Перечисление" | "Валюта";
      comment: string;
      exchange_rate?: number;
    }) => {
      const response = await api.post('/stock_debt_payment/mass-pay/', data);
      return response.data;
    },
  });

  const { data: currencyRates } = useQuery<CurrencyRate[]>({
    queryKey: ['currency-rates'],
    queryFn: async () => {
      const response = await api.get('/currency/rates/');
      return response.data;
    },
    enabled: balanceForm.payment_method === "Валюта" || massPaymentForm.payment_type === "Валюта",
  });

  // Get stores array
  const stores = Array.isArray(storesData)
      ? storesData
      : storesData?.results || [];

  // Get suppliers array and total count
  const suppliers = Array.isArray(suppliersData)
      ? suppliersData
      : suppliersData?.results || [];
  const totalCount = Array.isArray(suppliersData)
      ? suppliers.length
      : suppliersData?.count || 0;

  // Handlers
  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleUpdateSubmit = (data: Supplier) => {
    if (!editingSupplier?.id) return;

    updateSupplier.mutate(
        { ...data, id: editingSupplier.id },
        {
          onSuccess: () => {
            toast.success(
                t("messages.success.updated", { item: t("navigation.suppliers") }),
            );
            setIsFormOpen(false);
            setEditingSupplier(null);
          },
          onError: () =>
              toast.error(
                  t("messages.error.update", { item: t("navigation.suppliers") }),
              ),
        },
    );
  };

  const handleDelete = (id: number) => {
    deleteSupplier.mutate(id, {
      onSuccess: () =>
          toast.success(
              t("messages.success.deleted", { item: t("navigation.suppliers") }),
          ),
      onError: () =>
          toast.error(
              t("messages.error.delete", { item: t("navigation.suppliers") }),
          ),
    });
  };

  const handleRowClick = (supplier: Supplier) => {
    navigate(`/suppliers/${supplier.id}`);
  };

  const handleAddBalance = (supplier: Supplier) => {
    setSelectedSupplierForBalance(supplier);
    setBalanceForm({
      store: "",
      amount: "",
      payment_method: "Наличные",
      exchange_rate: "",
    });
    setSelectedStore(null);
    setIsBalanceDialogOpen(true);
  };

  useEffect(() => {
    if (currencyRates && currencyRates.length > 0 && balanceForm.payment_method === "Валюта" && !balanceForm.exchange_rate) {
      setBalanceForm(prev => ({ ...prev, exchange_rate: currencyRates[0].rate }));
    }
  }, [currencyRates, balanceForm.payment_method]);

  useEffect(() => {
    if (currencyRates && currencyRates.length > 0 && massPaymentForm.payment_type === "Валюта" && !massPaymentForm.exchange_rate) {
      setMassPaymentForm(prev => ({ ...prev, exchange_rate: currencyRates[0].rate }));
    }
  }, [currencyRates, massPaymentForm.payment_type]);

  const handleBalanceSubmit = async () => {
    if (
        !selectedSupplierForBalance?.id ||
        !balanceForm.store ||
        !balanceForm.amount
    ) {
      toast.error(
          t("messages.error.fill_required_fields") ||
          "Please fill all required fields",
      );
      return;
    }

    const data: AddSupplierBalanceRequest = {
      supplier: selectedSupplierForBalance.id,
      store: Number(balanceForm.store),
      amount: Number(balanceForm.amount),
      payment_method: balanceForm.payment_method,
      ...(balanceForm.payment_method === "Валюта" && balanceForm.exchange_rate && {
        exchange_rate: Number(balanceForm.exchange_rate),
      }),
    };

    addSupplierBalance.mutate(data, {
      onSuccess: () => {
        toast.success(
            t("messages.success.balance_added") || "Balance added successfully",
        );
        setIsBalanceDialogOpen(false);
        setSelectedSupplierForBalance(null);
      },
    
    });
  };

  const handleMassPayment = (supplier: Supplier) => {
    setMassPaymentForm({
      supplier: String(supplier.id),
      store: "",
      amount: "",
      payment_type: "Наличные",
      comment: "",
      exchange_rate: "",
    });
    setIsMassPaymentDialogOpen(true);
  };

  const handleMassPaymentSubmit = async () => {
    if (
        !massPaymentForm.supplier ||
        !massPaymentForm.store ||
        !massPaymentForm.amount
    ) {
      toast.error(
          t("messages.error.fill_required_fields") ||
          "Please fill all required fields",
      );
      return;
    }

    // Check budget availability
    if (selectedMassPaymentStore?.budgets) {
      const selectedBudget = selectedMassPaymentStore.budgets.find(
          (budget) => budget.budget_type === massPaymentForm.payment_type,
      );
      const budgetAmount = selectedBudget ? Number(selectedBudget.amount) : 0;
      const paymentAmount = Number(massPaymentForm.amount);

      if (budgetAmount < paymentAmount) {
        toast.error(
            t("messages.error.insufficient_budget") || "Insufficient budget for this payment method",
        );
        return;
      }
    }

    const data = {
      supplier: Number(massPaymentForm.supplier),
      store: Number(massPaymentForm.store),
      amount: Number(massPaymentForm.amount),
      payment_type: massPaymentForm.payment_type,
      comment: massPaymentForm.comment,
      ...(massPaymentForm.payment_type === "Валюта" && massPaymentForm.exchange_rate && {
        exchange_rate: Number(massPaymentForm.exchange_rate),
      }),
    };

    massPayment.mutate(data, {
      onSuccess: () => {
        toast.success(
            t("messages.success.mass_payment") || "Mass payment completed successfully",
        );
        setIsMassPaymentDialogOpen(false);
      },
    
    });
  };

  // Scroll button handlers
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  // Show/hide scroll buttons based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.body.scrollHeight;

      // Show buttons if we've scrolled more than 200px or not at bottom
      setShowScrollButtons(
          scrollPosition > 200 ||
          scrollPosition + windowHeight < documentHeight - 200,
      );
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
      <div className="container mx-auto py-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t("navigation.suppliers")}</h1>
        </div>
        <ResourceTable
            data={suppliers}
            columns={columns(t)}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={() => navigate("/create-supplier")}
            onRowClick={handleRowClick}
            totalCount={totalCount}
            pageSize={10}
            currentPage={page}
            onPageChange={(newPage) => setPage(newPage)}
            actions={(supplier: Supplier) => (
                <div className="flex gap-2">
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddBalance(supplier);
                      }}
                  >
                    <Wallet className="h-4 w-4 mr-1" />
                    {t("common.add_balance") || "Add Balance"}
                  </Button>
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMassPayment(supplier);
                      }}
                      className="bg-blue-50 hover:bg-blue-100"
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    {t("common.mass_payment") || "Mass Payment"}
                  </Button>
                </div>
            )}
        />

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <ResourceForm
                fields={supplierFields(t)}
                onSubmit={handleUpdateSubmit}
                defaultValues={editingSupplier || undefined}
                isSubmitting={updateSupplier.isPending}
                title={t("common.edit") + " " + t("navigation.suppliers")}
            />
          </DialogContent>
        </Dialog>

        {/* Add Balance Dialog */}
        <Dialog open={isBalanceDialogOpen} onOpenChange={setIsBalanceDialogOpen}>
          <DialogContent>
            <DialogTitle>
              {t("common.add_balance") || "Add Balance"} -{" "}
              {selectedSupplierForBalance?.name}
            </DialogTitle>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="payment_method">
                  {t("common.payment_method")} *
                </Label>
                <Select
                    value={balanceForm.payment_method}
                    onValueChange={(value) =>
                        setBalanceForm({ ...balanceForm, payment_method: value })
                    }
                >
                  <SelectTrigger id="payment_method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Наличные">Наличные</SelectItem>
                    <SelectItem value="Карта">Карта</SelectItem>
                    <SelectItem value="Click">Click</SelectItem>
                    <SelectItem value="Перечисление">Перечисление</SelectItem>
                    <SelectItem value="Валюта">Валюта</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {balanceForm.payment_method === "Валюта" && (
                <div className="space-y-2">
                  <Label htmlFor="exchange_rate">
                    {t("common.exchange_rate") || "Exchange Rate"} *
                  </Label>
                  <Input
                    id="exchange_rate"
                    type="number"
                    step="0.01"
                    value={balanceForm.exchange_rate}
                    onChange={(e) =>
                      setBalanceForm({ ...balanceForm, exchange_rate: e.target.value })
                    }
                    placeholder={t("placeholders.enter_exchange_rate") || "Enter exchange rate"}
                  />
                
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="store">{t("forms.store")} *</Label>
                <Select
                    value={balanceForm.store}
                    onValueChange={(value) => {
                      setBalanceForm({ ...balanceForm, store: value });
                      const store = stores.find(
                          (s: Store) => String(s.id) === value,
                      );
                      setSelectedStore(store || null);
                    }}
                >
                  <SelectTrigger id="store">
                    <SelectValue
                        placeholder={
                            t("placeholders.select_store") || "Select store"
                        }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store: Store) => (
                        <SelectItem key={store.id} value={String(store.id)}>
                          {store.name}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Display Store Budget Information based on selected payment method */}
              {selectedStore &&
                  selectedStore.budgets &&
                  balanceForm.payment_method && (
                      <div className="space-y-2 p-4 bg-muted rounded-lg">
                        <div className="font-medium text-sm">
                          {t("common.available_budget") || "Available Budget"}:
                        </div>
                        {(() => {
                          const selectedBudget = selectedStore.budgets.find(
                              (budget) =>
                                  budget.budget_type === balanceForm.payment_method,
                          );
                          const budgetAmount = selectedBudget
                              ? Number(selectedBudget.amount)
                              : 0;
                          const isInsufficient =
                              balanceForm.amount &&
                              budgetAmount < Number(balanceForm.amount);

                          return (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            {balanceForm.payment_method}:
                          </span>
                                  <span
                                      className={`font-bold text-lg ${isInsufficient ? "text-destructive" : ""}`}
                                  >
                            {budgetAmount.toLocaleString()}{" "}
                                    {t("common.currency") || "сум"}
                          </span>
                                </div>
                                {isInsufficient && (
                                    <div className="text-sm text-destructive">
                                      ⚠️{" "}
                                      {t("messages.error.insufficient_budget") ||
                                          "Insufficient budget for this payment method"}
                                    </div>
                                )}
                              </div>
                          );
                        })()}
                      </div>
                  )}

              <div className="space-y-2">
                <Label htmlFor="amount">{t("common.amount")} *</Label>
                <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={balanceForm.amount}
                    onChange={(e) =>
                        setBalanceForm({ ...balanceForm, amount: e.target.value })
                    }
                    placeholder={t("placeholders.enter_amount") || "Enter amount"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                    variant="outline"
                    onClick={() => setIsBalanceDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                    onClick={handleBalanceSubmit}
                    disabled={addSupplierBalance.isPending}
                >
                  {addSupplierBalance.isPending
                      ? t("common.submitting")
                      : t("common.submit")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mass Payment Dialog */}
        <Dialog open={isMassPaymentDialogOpen} onOpenChange={setIsMassPaymentDialogOpen}>
          <DialogContent>
            <DialogTitle>
              {t("common.mass_payment") || "Mass Payment"}
            </DialogTitle>
            <div className="space-y-4 pt-4">


              <div className="space-y-2">
                <Label htmlFor="mass_store">{t("forms.store")} *</Label>
                <Select
                    value={massPaymentForm.store}
                    onValueChange={(value) => {
                      setMassPaymentForm({ ...massPaymentForm, store: value });
                      const store = stores.find((s: Store) => String(s.id) === value);
                      setSelectedMassPaymentStore(store || null);
                    }}
                >
                  <SelectTrigger id="mass_store">
                    <SelectValue
                        placeholder={
                            t("placeholders.select_store") || "Select store"
                        }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store: Store) => (
                        <SelectItem key={store.id} value={String(store.id)}>
                          {store.name}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Display Store Budget Information */}
              {selectedMassPaymentStore?.budgets && massPaymentForm.payment_type && (
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <div className="font-medium text-sm">
                      {t("common.available_budget") || "Available Budget"}:
                    </div>
                    {(() => {
                      const selectedBudget = selectedMassPaymentStore.budgets.find(
                          (budget) => budget.budget_type === massPaymentForm.payment_type,
                      );
                      const budgetAmount = selectedBudget ? Number(selectedBudget.amount) : 0;
                      const isInsufficient = massPaymentForm.amount && budgetAmount < Number(massPaymentForm.amount);

                      return (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {massPaymentForm.payment_type}:
                        </span>
                              <span className={`font-bold text-lg ${isInsufficient ? "text-destructive" : ""}`}>
                          {budgetAmount.toLocaleString()} {t("common.currency") || "сум"}
                        </span>
                            </div>
                            {isInsufficient && (
                                <div className="text-sm text-destructive">
                                  ⚠️ {t("messages.error.insufficient_budget") || "Insufficient budget for this payment method"}
                                </div>
                            )}
                          </div>
                      );
                    })()}
                  </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mass_amount">{t("common.amount")} *</Label>
                <Input
                    id="mass_amount"
                    type="number"
                    step="0.01"
                    value={massPaymentForm.amount}
                    onChange={(e) =>
                        setMassPaymentForm({ ...massPaymentForm, amount: e.target.value })
                    }
                    placeholder={t("placeholders.enter_amount") || "Enter amount"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mass_payment_type">
                  {t("common.payment_type")} *
                </Label>
                <Select
                    value={massPaymentForm.payment_type}
                    onValueChange={(value: "Наличные" | "Карта" | "Click" | "Перечисление" | "Валюта") =>
                        setMassPaymentForm({ ...massPaymentForm, payment_type: value })
                    }
                >
                  <SelectTrigger id="mass_payment_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Наличные">Наличные</SelectItem>
                    <SelectItem value="Карта">Карта</SelectItem>
                    <SelectItem value="Click">Click</SelectItem>
                    <SelectItem value="Перечисление">Перечисление</SelectItem>
                    <SelectItem value="Валюта">Валюта</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {massPaymentForm.payment_type === "Валюта" && (
                <div className="space-y-2">
                  <Label htmlFor="mass_exchange_rate">
                    {t("common.exchange_rate") || "Exchange Rate"} *
                  </Label>
                  <Input
                    id="mass_exchange_rate"
                    type="number"
                    step="0.01"
                    value={massPaymentForm.exchange_rate}
                    onChange={(e) =>
                      setMassPaymentForm({ ...massPaymentForm, exchange_rate: e.target.value })
                    }
                    placeholder={t("placeholders.enter_exchange_rate") || "Enter exchange rate"}
                  />
                
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mass_comment">{t("common.comment")}</Label>
                <Input
                    id="mass_comment"
                    value={massPaymentForm.comment}
                    onChange={(e) =>
                        setMassPaymentForm({ ...massPaymentForm, comment: e.target.value })
                    }
                    placeholder={t("placeholders.enter_comment") || "Enter comment"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                    variant="outline"
                    onClick={() => setIsMassPaymentDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                    onClick={handleMassPaymentSubmit}
                    disabled={massPayment.isPending || (() => {
                      if (!selectedMassPaymentStore?.budgets || !massPaymentForm.payment_type || !massPaymentForm.amount) return false;
                      const selectedBudget = selectedMassPaymentStore.budgets.find(
                          (budget) => budget.budget_type === massPaymentForm.payment_type,
                      );
                      const budgetAmount = selectedBudget ? Number(selectedBudget.amount) : 0;
                      return budgetAmount < Number(massPaymentForm.amount);
                    })()}
                    className="bg-blue-500 hover:bg-blue-600"
                >
                  {massPayment.isPending
                      ? t("common.submitting")
                      : t("common.submit")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Scroll Buttons */}
        {showScrollButtons && (
            <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
              <Button
                  size="icon"
                  variant="secondary"
                  className="h-12 w-12 rounded-full shadow-lg"
                  onClick={scrollToTop}
                  title={t("common.scroll_to_top") || "Scroll to top"}
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
              <Button
                  size="icon"
                  variant="secondary"
                  className="h-12 w-12 rounded-full shadow-lg"
                  onClick={scrollToBottom}
                  title={t("common.scroll_to_bottom") || "Scroll to bottom"}
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </div>
        )}
      </div>
  );
}
