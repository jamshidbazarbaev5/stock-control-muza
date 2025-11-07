import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ResourceForm } from "../helpers/ResourceForm";
import { useCreateBudget } from "../api/budget";
import { useGetStores } from "../api/store";
import { useGetCashInflowNames } from "../api/cash-inflow-name";
import { toast } from "sonner";

interface AddMoneyFormData {
  store: number;
  amount: number;
  comment?: string;
  cash_inflow_name: number;
  budget_type: string;
}

export default function AddMoney() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const createBudget = useCreateBudget();
  const { data: storesData } = useGetStores({});
  const { data: cashInflowNamesData } = useGetCashInflowNames({});

  // Prepare options for select inputs
  const stores = Array.isArray(storesData)
    ? storesData
    : storesData?.results || [];
  const cashInflowNames = Array.isArray(cashInflowNamesData)
    ? cashInflowNamesData
    : cashInflowNamesData?.results || [];

  const fields = [
    {
      name: "store",
      label: t("forms.store"),
      type: "select",
      placeholder: t("placeholders.select_store"),
      required: true,
      options: stores.map((store) => ({ value: store.id, label: store.name })),
    },
    {
      name: "cash_inflow_name",
      label: t("forms.cash_inflow_name"),
      type: "select",
      placeholder: t("placeholders.select_cash_inflow_name"),
      required: true,
      options: cashInflowNames.map((name) => ({
        value: name.id,
        label: name.name,
      })),
    },
    {
      name: "budget_type",
      label: t("forms.budget_type"),
      type: "select",
      placeholder: t("placeholders.select_budget_type"),
      required: true,
      options: [
        { value: "Наличные", label: t("forms.cash") },
        { value: "Карта", label: t("forms.card") },
        { value: "Click", label: t("forms.click") },
          { value: 'Валюта', label: t('forms.rate') },
        { value: "Перечисление", label: t("forms.transfer") },
      ],
    },
    {
      name: "amount",
      label: t("forms.amount3"),
      type: "number",
      placeholder: t("placeholders.enter_amount"),
      required: true,
      validation: {
        min: {
          value: 0.01,
          message: t("validation.amount_must_be_positive"),
        },
      },
    },
    {
      name: "comment",
      label: t("forms.comment"),
      type: "text",
      placeholder: t("placeholders.enter_comment"),
      required: false,
      validation: {
        maxLength: {
          value: 500,
          message: t("validation.comment_too_long"),
        },
        minLength: {
          value: 3,
          message: t("validation.comment_too_short"),
        },
      },
    },
  ];

  const handleSubmit = async (data: AddMoneyFormData) => {
    try {
      await createBudget.mutateAsync({
        store:
          typeof data.store === "string"
            ? parseInt(data.store, 10)
            : data.store,
        cash_inflow_name:
          typeof data.cash_inflow_name === "string"
            ? parseInt(data.cash_inflow_name, 10)
            : data.cash_inflow_name,
        amount: data.amount,
        comment: data.comment,
        budget_type: data.budget_type,
      });
      toast.success(t("messages.success.money_added"));
      navigate("/finance"); // You'll need to create this route
    } catch (error) {
      toast.error(t("messages.error.add_money"));
      console.error("Failed to add money:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <ResourceForm<AddMoneyFormData>
        fields={fields}
        onSubmit={handleSubmit}
        isSubmitting={createBudget.isPending}
        title={t("forms.add_money")}
      />
    </div>
  );
}
