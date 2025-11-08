/**
 * Sale Receipt Service
 * Handles automatic thermal receipt printing for sales
 * Communicates with local thermal printer service running on port 3001
 * Fetches receipt template from API and renders according to template settings
 */

import api from "@/core/api/api";

export interface SaleData {
  id: number;
  sale_id?: string;
  store_read: {
    id: number;
    name: string;
    address: string;
    phone_number: string;
    budget: string;
    created_at: string;
    is_main: boolean;
    color: string;
    parent_store: number | null;
  };
  worker_read: {
    id: number;
    name: string;
    phone_number: string;
    role: string;
    is_mobile_user: boolean;
    has_active_shift: boolean;
    shift?: unknown;
    store_read: unknown;
    is_superuser: boolean;
  };
  client: unknown;
  on_credit: boolean;
  sale_items: Array<{
    id: number;
    product_read: {
      id: number;
      product_name: string;
      barcode: string;
      ikpu: string;
      category_read: unknown;
      base_unit: number;
      attribute_values: unknown[];
      history: unknown;
      min_price: unknown;
      selling_price: unknown;
      measurement: unknown[];
      available_units: Array<{
        id: number;
        short_name: string;
        factor: number;
        is_base: boolean;
      }>;
    };
    quantity: string;
    selling_unit: number;
    subtotal: string;
  }>;
  sale_debt: unknown;
  total_amount: string;
  total_pure_revenue: string;
  sale_payments: Array<{
    id: number;
    amount: string;
    payment_method: string;
    paid_at: string;
  }>;
  is_paid: boolean;
  sold_date: string;
}

export interface ReceiptTemplate {
  id: number;
  name: string;
  style: {
    styles: {
      width: string;
      margin: string;
      padding: string;
      fontSize: string;
      textColor: string;
      fontFamily: string;
      backgroundColor: string;
    };
    components: Array<{
      id: string;
      data: Record<string, unknown>;
      type: string;
      order: number;
      styles: Record<string, unknown>;
      enabled: boolean;
    }>;
  };
  created: string;
  is_used: boolean;
  store: number | null;
}

export interface PrintServiceResponse {
  message: string;
  sale_id?: number;
  timestamp?: string;
  error?: string;
  printer_ready?: boolean;
}

export interface PrintServiceHealthCheck {
  status: string;
  printer_ready: boolean;
  timestamp: string;
}

class SaleReceiptService {
  private readonly PRINT_SERVICE_URL = "http://localhost:3001";
  private readonly PRINT_TIMEOUT = 10000; // 10 seconds timeout
  private cachedTemplate: ReceiptTemplate | null = null;

  /**
   * Fetch receipt template from API (where is_used: true)
   */
  async fetchReceiptTemplate(): Promise<ReceiptTemplate | null> {
    try {
      // Return cached template if available
      if (this.cachedTemplate) {
        return this.cachedTemplate;
      }

      const response = await api.get<ReceiptTemplate[]>("receipt/template/");

      const templates = response.data;

      console.log(`📦 Fetched ${templates.length} templates from API:`);
      templates.forEach((t) => {
        console.log(
          `  - ID: ${t.id}, Name: "${t.name}", is_used: ${t.is_used}, Components: ${t.style?.components?.length || 0}`,
        );
      });

      // Find the template where is_used is true
      const activeTemplate = templates.find(
        (template) => template.is_used === true,
      );

      if (activeTemplate) {
        this.cachedTemplate = activeTemplate;
        console.log("✅ Active template found:");
        console.log(`   ID: ${activeTemplate.id}`);
        console.log(`   Name: "${activeTemplate.name}"`);
        console.log(`   Components: ${activeTemplate.style.components.length}`);
        console.log(
          `   Enabled components: ${activeTemplate.style.components.filter((c) => c.enabled).length}`,
        );
                // Log each component
        activeTemplate.style.components
          .filter((c) => c.enabled)
          .sort((a, b) => a.order - b.order)
          .forEach((c, i) => {
            console.log(
              `   ${i + 1}. [${c.type}] "${c.id}" (order: ${c.order})`,
            );
            if (c.type === "text" || c.type === "footer") {
              console.log(`      text: "${c.data?.text}"`);
            }
          });

        return activeTemplate;
      }

      console.warn("⚠️ No active receipt template found (is_used: true)");
      console.warn(
        "Available templates:",
        templates.map((t) => `${t.name} (is_used: ${t.is_used})`).join(", "),
      );
      return null;
    } catch (error) {
      console.error("❌ Failed to fetch receipt template:", error);
      return null;
    }
  }

  /**
   * Check if the thermal printer service is running and printer is ready
   */
  async checkPrinterStatus(): Promise<PrintServiceHealthCheck> {
    try {
      const response = await fetch(`${this.PRINT_SERVICE_URL}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout for health check
      });

      if (!response.ok) {
        throw new Error(
          `Health check failed: ${response.status} ${response.statusText}`,
        );
      }

      const data: PrintServiceHealthCheck = await response.json();
      return data;
    } catch (error) {
      console.error("❌ Printer service health check failed:", error);
      throw new Error(
        "Thermal printer service is not available. Please ensure the service is running.",
      );
    }
  }

  /**
   * Print sale receipt automatically using Node.js thermal printer service
   * Fetches template from API and sends to Node.js for thermal printing
   */
  async printSaleReceipt(saleData: SaleData): Promise<PrintServiceResponse> {
    try {
      console.log(
        "🖨 Starting automatic sale receipt printing via Node.js service...",
      );

      // Fetch the active template from API
      const template = await this.fetchReceiptTemplate();
      if (!template) {
        throw new Error("No active receipt template found (is_used: true)");
      }

      console.log("📄 Using template:", template.name);

      const response = await fetch(
        `${this.PRINT_SERVICE_URL}/print-sale-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            saleData,
            template,
          }),
          signal: AbortSignal.timeout(this.PRINT_TIMEOUT),
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error ||
            `Print failed: ${response.status} ${response.statusText}`,
        );
      }

      const data: PrintServiceResponse = await response.json();
      console.log(
        "✅ Sale receipt printed successfully via thermal printer:",
        data,
      );
      return data;
    } catch (error) {
      console.error("❌ Sale receipt printing failed:", error);
      throw error;
    }
  }
    /**
   * Print with automatic handling (no browser fallback - thermal printer only)
   */
  async printWithFallback(saleData: SaleData): Promise<{
    success: boolean;
    method: "thermal" | "browser" | "failed";
    message: string;
    error?: string;
  }> {
    try {
      // Use thermal printer service directly (like shift closure)
      console.log("🖨 Printing sale receipt via Node.js thermal service...");
      await this.printSaleReceipt(saleData);
      return {
        success: true,
        method: "thermal",
        message: "Чек напечатан на термопринтере H-58C",
      };
    } catch (thermalError) {
      console.error("❌ Thermal printing failed:", thermalError);
      return {
        success: false,
        method: "failed",
        message: "Ошибка печати на термопринтере",
        error:
          thermalError instanceof Error
            ? thermalError.message
            : "Unknown error",
      };
    }
  }

  /**
   * Show user notification about print status
   */
  showPrintNotification(result: {
    success: boolean;
    method: string;
    message: string;
    error?: string;
  }) {
    // Create a simple notification
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ${
        result.success
          ? "background: linear-gradient(135deg, #10b981, #059669);"
          : "background: linear-gradient(135deg, #ef4444, #dc2626);"
      }
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 18px;">${result.success ? "✅" : "❌"}</span>
        <div>
          <div style="font-size: 14px; margin-bottom: 4px;">
            ${result.success ? "Чек напечатан" : "Ошибка печати"}
          </div>
          <div style="font-size: 12px; opacity: 0.9;">
            ${result.message}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);

    // Allow manual close on click
    notification.addEventListener("click", () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }
}

// Export singleton instance
export const saleReceiptService = new SaleReceiptService();
export default saleReceiptService;