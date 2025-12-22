import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

interface HomeData {
  totalCount: number;
  todayCount: number;
  yesterdayCount: number;
  leads: any[];
  loadedAt: number;
}

interface MessagesData {
  conversations: any[];
  loadedAt: number;
}

class DataPreloader {
  private homeData: HomeData | null = null;
  private messagesData: MessagesData | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Start preloading all app data in the background
   * This should be called as early as possible (splash screen, tutorial, auth)
   */
  async preloadAll(): Promise<void> {
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    if (!isSupabaseConfigured) {
      return;
    }

    this.isLoading = true;
    this.loadPromise = this._loadAllData();
    
    try {
      await this.loadPromise;
    } catch (error) {
      console.error("Error preloading data:", error);
    } finally {
      this.isLoading = false;
    }
  }

  private async _loadAllData(): Promise<void> {
    // Load home and messages data in parallel
    await Promise.all([
      this.preloadHomeData(),
      this.preloadMessagesData(),
    ]);
  }

  /**
   * Preload home screen data (counts and leads)
   */
  async preloadHomeData(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const supabase = getSupabaseClient();

      // Fetch all data in parallel for better performance
      const [totalResult, todayResult, yesterdayResult, leadsResult] = await Promise.all([
        // Total count
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true }),
        
        // Today's count
        (async () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .gte("created_at", today.toISOString())
            .lt("created_at", tomorrow.toISOString());
        })(),
        
        // Yesterday's count
        (async () => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          const today = new Date(yesterday);
          today.setDate(today.getDate() + 1);
          return supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .gte("created_at", yesterday.toISOString())
            .lt("created_at", today.toISOString());
        })(),
        
        // All leads
        supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000), // Limit to prevent memory issues
      ]);

      this.homeData = {
        totalCount: totalResult.count || 0,
        todayCount: todayResult.count || 0,
        yesterdayCount: yesterdayResult.count || 0,
        leads: leadsResult.data || [],
        loadedAt: Date.now(),
      };

      console.log("Home data preloaded successfully");
    } catch (error) {
      console.error("Error preloading home data:", error);
    }
  }

  /**
   * Preload messages screen data (basic customer list)
   * Note: Full conversation data with messages is loaded on-demand due to complexity
   */
  async preloadMessagesData(): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const supabase = getSupabaseClient();

      // Fetch customers/leads with basic info for conversations
      // This helps speed up the initial load
      const { data: customers, error } = await supabase
        .from("leads")
        .select(
          "id, customer_name, installation_town, airtel_number, alternate_number, preferred_package, whatsapp_response, whatsapp_response_date, whatsapp_message_sent_date, created_at, status, source, is_pinned"
        )
        .order("created_at", { ascending: false })
        .limit(500); // Limit to prevent memory issues

      if (error) {
        console.error("Error preloading messages data:", error);
        return;
      }

      this.messagesData = {
        conversations: customers || [],
        loadedAt: Date.now(),
      };

      console.log("Messages data preloaded successfully");
    } catch (error) {
      console.error("Error preloading messages data:", error);
    }
  }

  /**
   * Get preloaded home data
   * Returns null if not loaded yet
   */
  getHomeData(): HomeData | null {
    // Return data if it's less than 30 seconds old
    if (this.homeData && Date.now() - this.homeData.loadedAt < 30000) {
      return this.homeData;
    }
    return null;
  }

  /**
   * Get preloaded messages data
   * Returns null if not loaded yet
   */
  getMessagesData(): MessagesData | null {
    // Return data if it's less than 30 seconds old
    if (this.messagesData && Date.now() - this.messagesData.loadedAt < 30000) {
      return this.messagesData;
    }
    return null;
  }

  /**
   * Clear cached data (useful for refresh)
   */
  clearCache(): void {
    this.homeData = null;
    this.messagesData = null;
  }

  /**
   * Check if data is currently loading
   */
  isDataLoading(): boolean {
    return this.isLoading;
  }
}

// Export singleton instance
export const dataPreloader = new DataPreloader();

