import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useGetIncomes } from "../api/income";
import { useGetUsers } from "../api/user";
import { ResourceTable } from "../helpers/ResourseTable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetStores } from "../api/store";
import type { Store } from "../api/store";
import { useGetClients } from "../api/client";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useCurrentUser } from "../hooks/useCurrentUser";

export default function IncomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedWorker, setSelectedWorker] = useState("all");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedStore, selectedSource, selectedWorker, startDate, endDate]);

  const { data: storesData } = useGetStores();
  const { data: usersData } = useGetUsers();
  const { data: clientsData } = useGetClients({});
  const stores = Array.isArray(storesData)
    ? storesData
    : storesData?.results || [];
  const users = Array.isArray(usersData) ? usersData : usersData?.results || [];
  const clients = Array.isArray(clientsData) ? clientsData : clientsData?.results || [];
  const { data: currentUser } = useCurrentUser();

  // Helper function to find client ID by name
  const findClientIdByName = (clientName: string) => {
    const client = clients.find(c => c.name === clientName);
    return client?.id;
  };
  const { data: incomesData, isLoading } = useGetIncomes({
    params: {
      ...(selectedStore !== "all" && { store: selectedStore }),
      ...(selectedSource !== "all" && { source: selectedSource }),
      ...(selectedWorker !== "all" && { worker: selectedWorker }),
      ...(startDate && { start_date: format(startDate, "yyyy-MM-dd") }),
      ...(endDate && { end_date: format(endDate, "yyyy-MM-dd") }),
      page: page,
    },
  });

  const incomes = Array.isArray(incomesData)
    ? incomesData
    : incomesData?.results || [];
  const totalCount = Array.isArray(incomesData)
    ? incomes.length
    : incomesData?.count || 0;

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("ru-RU").format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "-";
    }
  };

  const columns = [
    {
      header: t("forms.store"),
      accessorKey: "store_read.name",
      cell: (row: any) => row.store_read?.name || "-",
    },
    {
      header: t("table.source"),
      accessorKey: "source",
      cell: (row: any) => row.source || "-",
    },
    {
      header: t("forms.amount3"),
      accessorKey: "total_amount  ",
      cell: (row: any) => (
        <span className="font-medium text-emerald-600">
          {formatCurrency(row.total_amount)} uzs
        </span>
      ),
    },
    {
      header: t("forms.payment_method"),
      accessorKey: "description.Payment Method",
      cell: (row: any) => {
        if (row.description["Payment Method"]) {
          return row.description["Payment Method"];
        }
        if (row.description.Payments?.length > 0) {
          return row.description.Payments.map((p: any) => p.Method).join(", ");
        }
        return "-";
      },
    },
    {
      header: t("forms.client"),
      accessorKey: "description.Client",
      cell: (row: any) => {
        const clientName = row.description.Client;
        if (clientName && row.source === "Погашение долга") {
          return (
            <span 
              className="hover:underline cursor-pointer text-blue-600"
              onClick={() => {
                const clientId = findClientIdByName(clientName);
                if (clientId) {
                  navigate(`/debts/${clientId}`);
                }
              }}
            >
              {clientName}
            </span>
          );
        }
        return clientName || "-";
      },
    },

    {
      header: t("forms.worker"),
      accessorKey: "worker_read.name",
      cell: (row: any) =>
        row.description.Worker || row.worker_read?.name || "-",
    },
    {
      header: t("forms.date"),
      accessorKey: "timestamp",
      cell: (row: any) =>
        formatDate(
          row.description["Sold Date"] ||
            row.description["Timestamp"] ||
            row.timestamp,
        ),
    },
    {
      header: "Действия",
      accessorKey: "actions",
      cell: (row: any) => {
        if (row.source === "Погашение долга" && row.description.Client) {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const clientId = findClientIdByName(row.description.Client);
                if (clientId) {
                  navigate(`/debts/${clientId}`);
                }
              }}
            >
              Долги
            </Button>
          );
        }
        return null;
      },
    },
  ];

  // Render expanded row with product details
  const renderExpandedRow = (row: any) => {
    // Check if the row has Items in the description
    const items = row.description?.Items || [];

    if (items.length === 0) {
      return (
        <div className="p-4 text-gray-500">{t("messages.error.general")}</div>
      );
    }

    return (
      <div className="p-4">
        <h3 className="text-sm font-medium mb-2">{t("table.items")}</h3>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100">
              <TableHead className="text-xs">{t("table.product")}</TableHead>
              <TableHead className="text-xs">{t("table.quantity")}</TableHead>
              <TableHead className="text-xs">
                {t("forms.selling_method")}
              </TableHead>
              <TableHead className="text-xs">{t("forms.amount4")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any, index: number) => (
              <TableRow key={index} className="border-b border-gray-100">
                <TableCell className="py-2">{item.Product}</TableCell>
                <TableCell className="py-2">{item.Quantity}</TableCell>
                <TableCell className="py-2">
                  {item["Selling Method"] || "-"}
                </TableCell>
                <TableCell className="py-2">
                  {formatCurrency(item.Subtotal)} UZS
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("navigation.incomes")}</h1>
      </div>

      <div className="flex gap-4 mb-6">
        {currentUser?.is_superuser && (
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("forms.select_store")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("forms.all_stores")}</SelectItem>
              {stores.map((store: Store) => (
                <SelectItem key={store.id} value={String(store.id)}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedSource} onValueChange={setSelectedSource}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("forms.select_source")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("forms.all_sources")}</SelectItem>
            <SelectItem value="Погашение долга">Погашение долга</SelectItem>
            <SelectItem value="Продажа">Продажа</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedWorker} onValueChange={setSelectedWorker}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("forms.select_worker")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("forms.all_workers")}</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-4">
          <DatePicker
            selected={startDate}
            onChange={(date: Date | null) => setStartDate(date)}
            selectsStart
            startDate={startDate}
            endDate={endDate}
            dateFormat="dd/MM/yyyy"
            placeholderText={t("forms.start_date")}
            className="w-[200px] flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <DatePicker
            selected={endDate}
            onChange={(date: Date | null) => setEndDate(date)}
            selectsEnd
            startDate={startDate}
            endDate={endDate}
            minDate={startDate || undefined}
            dateFormat="dd/MM/yyyy"
            placeholderText={t("forms.end_date")}
            className="w-[200px] flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <Card>
        <ResourceTable
          data={incomes}
          columns={columns}
          isLoading={isLoading}
          totalCount={totalCount}
          pageSize={30}
          currentPage={page}
          onPageChange={(newPage) => setPage(newPage)}
          expandedRowRenderer={renderExpandedRow}
          onRowClick={(row) => console.log("Row clicked:", row)}
        />
      </Card>
    </div>
  );
}
