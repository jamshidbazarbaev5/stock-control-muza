import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ResourceTable } from "../helpers/ResourseTable";
import {
  type Client,
  useGetClients,
  useDeleteClient,
  useIncrementBalance,
  useClientCashOut,
} from "../api/client";
import { useGetStores } from "../api/store";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCurrentUser } from "../hooks/useCurrentUser";

const formSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  store: z.number().min(1, "Store is required"),
  payment_method: z.enum(["Наличные", "Карта", "Click", "Перечисление"]),
});

type FormData = z.infer<typeof formSchema>;

interface BalanceIncrementDialogProps {
  clientId: number;
  isOpen: boolean;
  onClose: () => void;
}

function BalanceIncrementDialog({
                                  clientId,
                                  isOpen,
                                  onClose,
                                }: BalanceIncrementDialogProps) {
  const { t } = useTranslation();
  const incrementBalance = useIncrementBalance();
  const { data: currentUser } = useCurrentUser();
  const { data: storesData } = useGetStores({});
  const stores = Array.isArray(storesData) ? storesData : storesData?.results || [];
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      store: undefined,
      payment_method: "Наличные",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await incrementBalance.mutateAsync({ 
        id: clientId, 
        amount: data.amount,
        store: data.store,
        payment_method: data.payment_method,
      });
      toast.success(t("messages.success.balance_incremented"));
      form.reset();
      onClose();
    } catch (error) {
      toast.error(t("messages.error.balance_increment"));
      console.error("Failed to increment balance:", error);
    }
  };

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("forms.increment_balance")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentUser?.is_superuser && (
                <FormField
                  control={form.control}
                  name="store"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("forms.store")}</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(val) => field.onChange(parseInt(val))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("placeholders.select_store")} />
                          </SelectTrigger>
                          <SelectContent>
                            {stores.map((store) => (
                              <SelectItem key={store.id} value={store.id!.toString()}>
                                {store.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("forms.amount")}</FormLabel>
                        <FormControl>
                          <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) =>
                                  field.onChange(parseFloat(e.target.value))
                              }
                          />
                        </FormControl>
                      </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.payment_method")}</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("placeholders.select_payment_method")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Наличные">{t("payment_types.cash")}</SelectItem>
                              <SelectItem value="Карта">{t("payment_types.card")}</SelectItem>
                              <SelectItem value="Click">{t("payment_types.click")}</SelectItem>
                              <SelectItem value="Перечисление">Перечисление</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                  )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={incrementBalance.isPending}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
  );
}

// Cash-out dialog
const cashOutSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  store: z.number().min(1, "Store is required"),
  payment_method: z.enum(["Наличные", "Карта", "Click", "Перечисление"]),
});

type CashOutForm = z.infer<typeof cashOutSchema>;

interface CashOutDialogProps {
  clientId: number;
  isOpen: boolean;
  onClose: () => void;
}

function CashOutDialog({ clientId, isOpen, onClose }: CashOutDialogProps) {
  const { t } = useTranslation();
  const cashOut = useClientCashOut();
  const { data: currentUser } = useCurrentUser();
  const { data: storesData } = useGetStores({});
  const stores = Array.isArray(storesData) ? storesData : storesData?.results || [];
  const form = useForm<CashOutForm>({
    resolver: zodResolver(cashOutSchema),
    defaultValues: { amount: 0, store: undefined, payment_method: "Наличные" },
  });

  const onSubmit = async (data: CashOutForm) => {
    try {
      await cashOut.mutateAsync({ 
        id: clientId, 
        amount: data.amount,
        store: data.store,
        payment_method: data.payment_method,
      });
      toast.success(t("common.payment_successful", "Успешно"));
      form.reset();
      onClose();
    } catch (error) {
      toast.error(t("common.payment_failed", "Ошибка"));
      console.error("Failed to cash out:", error);
    }
  };

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Обналичичка</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentUser?.is_superuser && (
                <FormField
                  control={form.control}
                  name="store"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("forms.store")}</FormLabel>
                      <FormControl>
                        <Select 
                          value={field.value?.toString()} 
                          onValueChange={(val) => field.onChange(parseInt(val))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("placeholders.select_store")} />
                          </SelectTrigger>
                          <SelectContent>
                            {stores.map((store) => (
                              <SelectItem key={store.id} value={store.id!.toString()}>
                                {store.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.amount")}</FormLabel>
                        <FormControl>
                          <Input
                              type="number"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.payment_method")}</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("placeholders.select_payment_method")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Наличные">{t("payment_types.cash")}</SelectItem>
                              <SelectItem value="Карта">{t("payment_types.card")}</SelectItem>
                              <SelectItem value="Click">{t("payment_types.click")}</SelectItem>
                              <SelectItem value="Перечисление">Перечисление</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                  )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={cashOut.isPending}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
  );
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [cashOutClientId, setCashOutClientId] = useState<number | null>(null);
  const { data: clientsData, isLoading } = useGetClients({
    params: selectedType === "all" ? {} : { type: selectedType },
  });
  const deleteClient = useDeleteClient();
  const { data: currentUser } = useCurrentUser();
  const clients = Array.isArray(clientsData)
      ? clientsData
      : clientsData?.results || [];
  const totalCount = Array.isArray(clientsData)
      ? clients.length
      : clientsData?.count || 0;

  const columns = [
    {
      header: t("forms.client_type"),
      accessorKey: "type",
    },
    {
      header: t("forms.name"),
      accessorKey: (row: Client) =>
          row.type === "Юр.лицо"
              ? row.name + " (" + row.ceo_name + ")"
              : row.name,
    },
    {
      header: t("forms.phone"),
      accessorKey: "phone_number",
    },
    {
      header: t("forms.address"),
      accessorKey: "address",
    },
    {
      header: t("forms.balance"),
      accessorKey: (row: Client) => ("balance" in row ? row.balance : "-"),
    },
    {
      header: "",
      id: "actions",
      accessorKey: "id",
      cell: (row: Client) => (
          <div className="flex gap-2">
            <Button
                variant="outline"
                onClick={() => navigate(`/clients/${row.id}/history`)}
            >
              {t("common.history")}
            </Button>
            <Button
                variant="outline"
                onClick={() => navigate(`/debts/${row.id}`)}
            >
              Долги
            </Button>
            {currentUser?.is_superuser && row.type === "Юр.лицо" && (
                <>
                  <Button
                      variant="outline"
                      onClick={() => row.id && setSelectedClientId(row.id)}
                  >
                    {t("common.increment_balance")}
                  </Button>
                  <Button
                      variant="outline"
                      onClick={() => row.id && setCashOutClientId(row.id)}
                  >
                    Обналичичка
                  </Button>
                </>
            )}
          </div>
      ),
    },
  ];

  const handleDelete = async (id: number) => {
    try {
      if (currentUser?.is_superuser) {
        await deleteClient.mutateAsync(id);
        toast.success(
            t("messages.success.deleted", { item: t("navigation.clients") }),
        );
      }
    } catch (error) {
      toast.error(
          t("messages.error.delete", { item: t("navigation.clients") }),
      );
      console.error("Failed to delete client:", error);
    }
  };

  return (
      <div className="container py-8 px-4">
        <div className="mb-4">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue placeholder={t("forms.select_client_type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="Физ.лицо">{t("forms.individual")}</SelectItem>
              <SelectItem value="Юр.лицо">{t("forms.legal_entity")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ResourceTable<Client>
            data={clients}
            columns={columns}
            isLoading={isLoading}
            onAdd={!currentUser?.is_superuser ? () => navigate('/create-client') : undefined}
            onEdit={!currentUser?.is_superuser ? (client) => navigate(`/edit-client/${client.id}`) : undefined}
            onDelete={!currentUser?.is_superuser ? handleDelete : undefined}
            totalCount={totalCount}
        />
        {selectedClientId && (
            <BalanceIncrementDialog
                clientId={selectedClientId}
                isOpen={!!selectedClientId}
                onClose={() => setSelectedClientId(null)}
            />
        )}
        {cashOutClientId && (
            <CashOutDialog
                clientId={cashOutClientId}
                isOpen={!!cashOutClientId}
                onClose={() => setCashOutClientId(null)}
            />
        )}
      </div>
  );
}
