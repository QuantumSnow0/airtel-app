import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import * as XLSX from "xlsx";
import { dataPreloader } from "../../lib/dataPreloader";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

interface Lead {
  id: string;
  customer_name: string;
  airtel_number: string;
  alternate_number: string;
  email?: string;
  preferred_package?: string;
  installation_town?: string;
  delivery_landmark?: string;
  visit_date?: string;
  visit_time?: string;
  agent_type?: string;
  enterprise_cp?: string;
  agent_name?: string;
  agent_mobile?: string;
  lead_type?: string;
  connection_type?: string;
  created_at: string;
}

export default function HomeScreen() {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [yesterdayCount, setYesterdayCount] = useState<number | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedNumberId, setCopiedNumberId] = useState<string | null>(null);
  const [duplicateStatus, setDuplicateStatus] = useState<{
    [key: string]: "red" | "orange" | null;
  }>({});
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [todayDuplicateCount, setTodayDuplicateCount] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedTown, setSelectedTown] = useState<string | null>(null); // null = All towns
  const [dateFilter, setDateFilter] = useState<"today" | "all" | "custom">(
    "all"
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD format
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [availableTowns, setAvailableTowns] = useState<string[]>([]);
  const [showTownList, setShowTownList] = useState(false);
  const [pendingExportOption, setPendingExportOption] = useState<
    "full" | "airtel" | "alternate" | null
  >(null);

  // Fetch available towns for filter
  const fetchTowns = useCallback(async () => {
    console.log(
      "🔍 fetchTowns called, isSupabaseConfigured:",
      isSupabaseConfigured
    );
    if (!isSupabaseConfigured) {
      console.log("⚠️ Supabase not configured, skipping town fetch");
      return;
    }

    try {
      const supabase = getSupabaseClient();
      console.log("📡 Fetching towns from database...");
      const { data, error } = await supabase
        .from("leads")
        .select("installation_town")
        .order("installation_town", { ascending: true });

      if (error) {
        console.error("❌ Error fetching towns:", error);
        setAvailableTowns([]);
      } else {
        console.log("✅ Raw data received:", data?.length, "rows");
        // Get unique towns
        const uniqueTowns = Array.from(
          new Set(data?.map((item) => item.installation_town) || [])
        ).filter((town) => town && town.trim() !== "");
        console.log(
          "🏙️ Fetched",
          uniqueTowns.length,
          "unique towns:",
          uniqueTowns
        );
        setAvailableTowns(uniqueTowns);
      }
    } catch (error) {
      console.error("❌ Exception in fetchTowns:", error);
      setAvailableTowns([]);
    }
  }, []);

  // Fetch towns on mount - separate useEffect
  useEffect(() => {
    console.log("🚀 Component mounted, calling fetchTowns...");
    fetchTowns();
  }, [fetchTowns]);

  useEffect(() => {
    // Request notification permissions
    const setupNotifications = async () => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Notification permissions not granted");
        return;
      }

      // Configure notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    };

    setupNotifications();

    if (isSupabaseConfigured) {
      // Check if data was preloaded
      const preloadedData = dataPreloader.getHomeData();

      if (preloadedData) {
        // Use preloaded data immediately - no loading state needed!
        setTotalCount(preloadedData.totalCount);
        setTodayCount(preloadedData.todayCount);
        setYesterdayCount(preloadedData.yesterdayCount);
        setLeads(preloadedData.leads);
        setLoading(false);
        console.log("Using preloaded home data - instant load!");
      } else {
        // Data not preloaded yet, fetch normally
        fetchCounts();
      }

      // Set up Realtime subscription
      const supabase = getSupabaseClient();
      const channel = supabase
        .channel("leads-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT", // Only listen to INSERT events for new customers
            schema: "public",
            table: "leads",
          },
          async (payload) => {
            const newLead = payload.new as Lead;

            // Check if the new customer was registered today
            const leadDate = new Date(newLead.created_at);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            leadDate.setHours(0, 0, 0, 0);

            if (leadDate.getTime() === today.getTime()) {
              // New customer registered today - send notification
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "New Customer Registered! 🎉",
                  body: `${newLead.customer_name || "A new customer"} just signed up today`,
                  sound: true,
                  data: { leadId: newLead.id },
                },
                trigger: null, // Show immediately
              });
            }

            // Refetch counts when any change occurs (without showing loading)
            fetchCounts(false);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE", // Also listen to UPDATE events
            schema: "public",
            table: "leads",
          },
          () => {
            // Refetch counts when any update occurs
            fetchCounts(false);
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCounts = async (showLoading = true) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      const supabase = getSupabaseClient();

      // Fetch total count
      const { count: total, error: totalError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        console.error("Error fetching total count:", {
          error: totalError,
          message: totalError.message,
          details: totalError.details,
          hint: totalError.hint,
          code: totalError.code,
        });
        setTotalCount(0);
      } else {
        setTotalCount(total || 0);
      }

      // Fetch today's count
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayStart = todayDate.toISOString();
      const tomorrow = new Date(todayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = tomorrow.toISOString();

      const { count: todayCount, error: todayError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lt("created_at", tomorrowStart);

      if (todayError) {
        console.error("Error fetching today's count:", {
          error: todayError,
          message: todayError.message,
          details: todayError.details,
          hint: todayError.hint,
          code: todayError.code,
        });
        setTodayCount(0);
      } else {
        setTodayCount(todayCount || 0);
      }

      // Fetch yesterday's count
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStart = yesterdayDate.toISOString();

      const { count: yesterdayCount, error: yesterdayError } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterdayStart)
        .lt("created_at", todayStart);

      if (yesterdayError) {
        console.error("Error fetching yesterday's count:", {
          error: yesterdayError,
          message: yesterdayError.message,
          details: yesterdayError.details,
          hint: yesterdayError.hint,
          code: yesterdayError.code,
        });
        setYesterdayCount(0);
      } else {
        setYesterdayCount(yesterdayCount || 0);
      }

      // Fetch leads data with all fields needed for duplicate detection
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select(
          "id, customer_name, airtel_number, alternate_number, email, preferred_package, installation_town, delivery_landmark, visit_date, visit_time, agent_type, enterprise_cp, agent_name, agent_mobile, lead_type, connection_type, created_at"
        )
        .order("created_at", { ascending: false });

      if (leadsError) {
        console.error("Error fetching leads:", {
          error: leadsError,
          message: leadsError.message,
          details: leadsError.details,
          hint: leadsError.hint,
          code: leadsError.code,
        });
        setLeads([]);
      } else {
        setLeads(leadsData || []);
      }
    } catch (error) {
      console.error("Unexpected error in fetchCounts:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      setTotalCount(0);
      setTodayCount(0);
      setLeads([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Format date as "4 thurs 2025"
  const formatDate = () => {
    const today = new Date();
    const day = today.getDate();
    const dayNames = ["sun", "mon", "tues", "wed", "thurs", "fri", "sat"];
    const dayName = dayNames[today.getDay()];
    const year = today.getFullYear();
    return `${day} ${dayName} ${year}`;
  };

  // Format date with ordinal as "4th thursday 2025"
  const formatDateWithOrdinal = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[date.getDay()];
    const year = date.getFullYear();

    // Get ordinal suffix
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return `${getOrdinal(day)} ${dayName} ${year}`;
  };

  // Check if date is today
  const isToday = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Group leads by date
  const groupLeadsByDate = (leads: Lead[]) => {
    const grouped: { [key: string]: Lead[] } = {};

    leads.forEach((lead) => {
      const date = new Date(lead.created_at);
      // Create a date key using YYYY-MM-DD format
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const dateKey = `${year}-${month}-${day}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(lead);
    });

    // Convert to array and sort by date (newest first)
    return Object.entries(grouped)
      .sort(([dateKeyA], [dateKeyB]) => {
        // Parse the date keys and compare
        const [yearA, monthA, dayA] = dateKeyA.split("-").map(Number);
        const [yearB, monthB, dayB] = dateKeyB.split("-").map(Number);
        const dateA = new Date(yearA, monthA, dayA).getTime();
        const dateB = new Date(yearB, monthB, dayB).getTime();
        return dateB - dateA;
      })
      .map(([dateKey, leads]) => ({
        dateKey,
        date: leads[0].created_at,
        leads,
      }));
  };

  // Format name: capitalize first letter of each word
  const formatName = (name: string) => {
    if (!name) return name;
    return name
      .split(" ")
      .map((word) => {
        if (!word) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  // Check if two names are similar (case-insensitive match)
  const areNamesSimilar = (name1: string, name2: string): boolean => {
    if (!name1 || !name2) return false;
    return name1.trim().toLowerCase() === name2.trim().toLowerCase();
  };

  // Check if all details match (excluding timestamps)
  const allDetailsMatch = (lead1: Lead, lead2: Lead): boolean => {
    return (
      lead1.customer_name === lead2.customer_name &&
      lead1.airtel_number === lead2.airtel_number &&
      lead1.alternate_number === lead2.alternate_number &&
      lead1.email === lead2.email &&
      lead1.preferred_package === lead2.preferred_package &&
      lead1.installation_town === lead2.installation_town &&
      lead1.delivery_landmark === lead2.delivery_landmark &&
      lead1.agent_type === lead2.agent_type &&
      lead1.enterprise_cp === lead2.enterprise_cp &&
      lead1.agent_name === lead2.agent_name &&
      lead1.agent_mobile === lead2.agent_mobile &&
      lead1.lead_type === lead2.lead_type &&
      lead1.connection_type === lead2.connection_type
    );
  };

  // Check duplicate status for a lead
  const checkDuplicateStatus = (
    currentLead: Lead,
    allLeads: Lead[]
  ): "red" | "orange" | null => {
    for (const otherLead of allLeads) {
      // Skip comparing with itself
      if (currentLead.id === otherLead.id) continue;

      // Check 1: All details match (excluding timestamps) → RED
      if (allDetailsMatch(currentLead, otherLead)) {
        return "red";
      }

      // Check 2: Both phone numbers + email match → RED
      if (
        currentLead.airtel_number === otherLead.airtel_number &&
        currentLead.alternate_number === otherLead.alternate_number &&
        currentLead.email &&
        currentLead.email === otherLead.email
      ) {
        return "red";
      }

      // Check 3: Different name but both phone numbers match → ORANGE
      if (
        currentLead.customer_name !== otherLead.customer_name &&
        currentLead.airtel_number === otherLead.airtel_number &&
        currentLead.alternate_number === otherLead.alternate_number
      ) {
        return "orange";
      }

      // Check 4: Only email matches → ORANGE
      if (
        currentLead.email &&
        currentLead.email === otherLead.email &&
        (currentLead.airtel_number !== otherLead.airtel_number ||
          currentLead.alternate_number !== otherLead.alternate_number ||
          currentLead.customer_name !== otherLead.customer_name)
      ) {
        return "orange";
      }

      // Check 5: Same customer_name + same airtel_number → RED
      if (
        currentLead.customer_name === otherLead.customer_name &&
        currentLead.airtel_number === otherLead.airtel_number
      ) {
        return "red";
      }

      // Check 6: Similar customer names (case-insensitive) with at least one phone number matches → RED
      if (
        areNamesSimilar(currentLead.customer_name, otherLead.customer_name) &&
        (currentLead.airtel_number === otherLead.airtel_number ||
          currentLead.alternate_number === otherLead.alternate_number)
      ) {
        return "red";
      }

      // Check 7: Same airtel_number OR same alternate_number (just one number matches) → ORANGE
      if (
        (currentLead.airtel_number === otherLead.airtel_number &&
          currentLead.alternate_number !== otherLead.alternate_number) ||
        (currentLead.alternate_number === otherLead.alternate_number &&
          currentLead.airtel_number !== otherLead.airtel_number)
      ) {
        return "orange";
      }
    }

    return null;
  };

  // Check if two leads are duplicates of each other
  const areLeadsDuplicates = (lead1: Lead, lead2: Lead): boolean => {
    if (lead1.id === lead2.id) return false;
    const status = checkDuplicateStatus(lead1, [lead2]);
    return status === "red" || status === "orange";
  };

  // Group leads that are duplicates of each other
  const groupDuplicates = (allLeads: Lead[]): Map<string, string[]> => {
    const groups = new Map<string, string[]>();
    const processed = new Set<string>();

    allLeads.forEach((lead) => {
      if (processed.has(lead.id)) return;

      const group: string[] = [lead.id];
      processed.add(lead.id);

      // Find all leads that are duplicates of this one
      allLeads.forEach((otherLead) => {
        if (lead.id === otherLead.id || processed.has(otherLead.id)) return;

        if (areLeadsDuplicates(lead, otherLead)) {
          group.push(otherLead.id);
          processed.add(otherLead.id);
        }
      });

      if (group.length > 1) {
        // Create a unique key for this group (use the first lead's id)
        groups.set(lead.id, group);
      }
    });

    return groups;
  };

  // Calculate duplicate status for all leads
  useEffect(() => {
    if (leads.length > 0) {
      const status: { [key: string]: "red" | "orange" | null } = {};
      leads.forEach((lead) => {
        status[lead.id] = checkDuplicateStatus(lead, leads);
      });
      setDuplicateStatus(status);

      // Count unique duplicate groups (only count extras, not all duplicates)
      const duplicateGroups = groupDuplicates(leads);
      let totalExtras = 0;
      duplicateGroups.forEach((group) => {
        // For each group, count (group size - 1) as extras
        // e.g., if 2 identical records, count 1 extra; if 3 identical, count 2 extras
        totalExtras += group.length - 1;
      });
      setDuplicateCount(totalExtras);

      // Calculate today's duplicate count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let todayExtras = 0;

      duplicateGroups.forEach((group) => {
        const groupLeads = group
          .map((id) => leads.find((l) => l.id === id))
          .filter(Boolean) as Lead[];
        const todayLeadsInGroup = groupLeads.filter((lead) => {
          const leadDate = new Date(lead.created_at);
          leadDate.setHours(0, 0, 0, 0);
          return leadDate.getTime() === today.getTime();
        });

        if (todayLeadsInGroup.length > 0) {
          // If multiple today's leads in same duplicate group, count extras
          if (todayLeadsInGroup.length > 1) {
            todayExtras += todayLeadsInGroup.length - 1;
          } else if (groupLeads.length > 1) {
            // One today's lead is duplicate of older lead(s) - count it
            todayExtras += 1;
          }
        }
      });

      setTodayDuplicateCount(todayExtras);
    } else {
      setDuplicateCount(0);
      setTodayDuplicateCount(0);
    }
  }, [leads]);

  // Format phone number: remove 254 prefix and show as 07 or 01
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    // Remove any spaces or dashes
    let cleaned = phone.replace(/\s|-/g, "");
    // Remove 254 prefix if present
    if (cleaned.startsWith("254")) {
      cleaned = cleaned.substring(3);
    }
    // Ensure it starts with 0
    if (!cleaned.startsWith("0")) {
      cleaned = "0" + cleaned;
    }
    return cleaned;
  };

  // Get full phone number with 254 prefix for calling
  const getFullPhoneNumber = (phone: string) => {
    if (!phone) return phone;
    let cleaned = phone.replace(/\s|-/g, "");
    if (!cleaned.startsWith("254")) {
      if (cleaned.startsWith("0")) {
        cleaned = "254" + cleaned.substring(1);
      } else {
        cleaned = "254" + cleaned;
      }
    }
    return cleaned;
  };

  // Copy phone number to clipboard
  const handleCopyNumber = async (phone: string, numberId: string) => {
    const formatted = formatPhoneNumber(phone);
    await Clipboard.setStringAsync(formatted);

    // Show "Copied" text
    setCopiedNumberId(numberId);

    // Hide "Copied" text after 2 seconds
    setTimeout(() => {
      setCopiedNumberId(null);
    }, 2000);
  };

  // Call phone number
  const handleCallNumber = (phone: string) => {
    const fullNumber = getFullPhoneNumber(phone);
    const phoneUrl = `tel:${fullNumber}`;
    Linking.openURL(phoneUrl).catch((err) => {
      console.error("Error calling:", err);
    });
  };

  // Get phone number in 254 format (12 digits) for SMS API
  const getPhoneForSMS = (phone: string): string => {
    if (!phone) return "";
    // Remove any spaces, dashes, or + signs
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

    // If starts with 0, replace with 254 (e.g., 0712345678 -> 254712345678)
    if (cleaned.startsWith("0")) {
      cleaned = "254" + cleaned.substring(1);
    }
    // If doesn't start with 254, add it (assume it's a local number)
    else if (!cleaned.startsWith("254")) {
      cleaned = "254" + cleaned;
    }

    // Ensure it's exactly 12 digits (254 + 9 digits)
    // If longer, truncate; if shorter, it's invalid
    if (cleaned.length > 12) {
      cleaned = cleaned.substring(0, 12);
    } else if (cleaned.length < 12) {
      // Invalid number, return empty string
      return "";
    }

    return cleaned;
  };

  // Export SMS format Excel (exact format from image)
  const exportSMSFormat = async (
    phoneType: "airtel" | "alternate",
    town: string | null = null,
    dateFilterType: "today" | "all" | string = "all"
  ) => {
    if (!isSupabaseConfigured) {
      Alert.alert("Error", "Supabase is not configured");
      return;
    }

    setExporting(true);
    try {
      const supabase = getSupabaseClient();

      // Build query with filters
      let query = supabase
        .from("leads")
        .select("airtel_number, alternate_number")
        .order("created_at", { ascending: false });

      // Apply town filter
      if (town) {
        query = query.eq("installation_town", town);
      }

      // Apply date filter
      if (dateFilterType === "today") {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayStart = todayDate.toISOString();
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();
        query = query
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart);
      } else if (dateFilterType !== "all") {
        // Custom date (YYYY-MM-DD format)
        const selectedDateObj = new Date(dateFilterType);
        selectedDateObj.setHours(0, 0, 0, 0);
        const dateStart = selectedDateObj.toISOString();
        const nextDay = new Date(selectedDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const dateEnd = nextDay.toISOString();
        query = query.gte("created_at", dateStart).lt("created_at", dateEnd);
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error("Error fetching customers:", error);
        Alert.alert("Error", "Failed to fetch customers data");
        return;
      }

      if (!customers || customers.length === 0) {
        Alert.alert("No Data", "No customers found to export");
        return;
      }

      // Format data for SMS API (exact format from image)
      const excelData = customers
        .map((customer) => {
          const phone =
            phoneType === "airtel"
              ? customer.airtel_number
              : customer.alternate_number;
          const phoneForSMS = getPhoneForSMS(phone || "");

          // Only include if phone number exists and is valid
          if (!phoneForSMS || phoneForSMS.length !== 12) return null;

          return {
            "Cell Number": phoneForSMS,
            Username: "",
            "Order Id": "",
            Currency: "",
            Amount: "",
          };
        })
        .filter((row) => row !== null); // Remove invalid entries

      if (excelData.length === 0) {
        Alert.alert("No Data", `No valid ${phoneType} numbers found to export`);
        return;
      }

      // Add red dot in Currency column (first data row)
      // In Excel, we'll set the cell value to a special marker, but for now just leave empty
      // The red dot might need to be added manually or via cell styling

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths to match the image
      const columnWidths = [
        { wch: 15 }, // Cell Number
        { wch: 15 }, // Username
        { wch: 15 }, // Order Id
        { wch: 12 }, // Currency
        { wch: 12 }, // Amount
      ];
      ws["!cols"] = columnWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SMS Numbers");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, {
        type: "base64",
        bookType: "xlsx",
      });

      // Create file name with filters
      const timestamp = new Date().toISOString().split("T")[0];
      const townPart = town ? `_${town.replace(/\s+/g, "_")}` : "";
      let datePart = "";
      if (dateFilterType === "today") {
        datePart = "_Today";
      } else if (dateFilterType !== "all") {
        datePart = `_${dateFilterType}`;
      }
      const fileName = `SMS_Numbers_${phoneType}${townPart}${datePart}_${timestamp}.xlsx`;

      // Use cache directory for temporary file
      const file = new File(Paths.cache, fileName);

      // Write file
      file.write(excelBuffer, { encoding: "base64" });
      const fileUri = file.uri;

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export SMS Numbers",
        });
      } else {
        Alert.alert(
          "Success",
          `Excel file saved: ${fileName}\n\nFile location: ${fileUri}`
        );
      }
    } catch (error) {
      console.error("Error exporting SMS format:", error);
      Alert.alert(
        "Error",
        `Failed to export Excel file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  };

  // Toggle export menu
  const handleExportToExcel = () => {
    if (!isSupabaseConfigured) {
      Alert.alert("Error", "Supabase is not configured");
      return;
    }
    setShowExportMenu(!showExportMenu);
  };

  // Handle export option selection - open filter modal (memoized)
  const handleExportOption = useCallback(
    (option: "full" | "airtel" | "alternate") => {
      setShowExportMenu(false);
      setPendingExportOption(option);
      // Reset filters to default
      setSelectedTown(null);
      setDateFilter("all");
      setSelectedDate(null);
      setShowTownList(false);
      // Open filter modal
      setShowFilterModal(true);
    },
    []
  );

  // Memoized modal close handler
  const handleCloseModal = useCallback(() => {
    setShowFilterModal(false);
    setPendingExportOption(null);
  }, []);

  // Apply filters and export (memoized to prevent re-creation)
  const handleApplyFiltersAndExport = useCallback(() => {
    setShowFilterModal(false);
    const option = pendingExportOption;
    if (!option) return;

    // Determine date filter value
    let dateFilterValue: "today" | "all" | string = "all";
    if (dateFilter === "today") {
      dateFilterValue = "today";
    } else if (dateFilter === "custom" && selectedDate) {
      dateFilterValue = selectedDate;
    }

    // Export with filters
    if (option === "full") {
      exportFullDetails(selectedTown, dateFilterValue);
    } else {
      exportSMSFormat(option, selectedTown, dateFilterValue);
    }

    setPendingExportOption(null);
  }, [pendingExportOption, dateFilter, selectedDate, selectedTown]);

  // Format date for display
  const formatSelectedDate = (dateString: string | null) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthName = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${monthName} ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  // Export full customer details
  const exportFullDetails = async (
    town: string | null = null,
    dateFilterType: "today" | "all" | string = "all"
  ) => {
    setExporting(true);
    try {
      const supabase = getSupabaseClient();

      // Build query with filters
      let query = supabase
        .from("leads")
        .select(
          "id, customer_name, airtel_number, alternate_number, email, preferred_package, installation_town, delivery_landmark, visit_date, visit_time, created_at"
        )
        .order("created_at", { ascending: false });

      // Apply town filter
      if (town) {
        query = query.eq("installation_town", town);
      }

      // Apply date filter
      if (dateFilterType === "today") {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayStart = todayDate.toISOString();
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = tomorrow.toISOString();
        query = query
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart);
      } else if (dateFilterType !== "all") {
        // Custom date (YYYY-MM-DD format)
        const selectedDateObj = new Date(dateFilterType);
        selectedDateObj.setHours(0, 0, 0, 0);
        const dateStart = selectedDateObj.toISOString();
        const nextDay = new Date(selectedDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const dateEnd = nextDay.toISOString();
        query = query.gte("created_at", dateStart).lt("created_at", dateEnd);
      }

      const { data: customers, error } = await query;

      if (error) {
        console.error("Error fetching customers:", error);
        Alert.alert("Error", "Failed to fetch customers data");
        return;
      }

      if (!customers || customers.length === 0) {
        Alert.alert("No Data", "No customers found to export");
        return;
      }

      // Format data for Excel (excluding agent details)
      const excelData = customers.map((customer, index) => {
        // Format phone numbers
        const airtelFormatted = formatPhoneNumber(customer.airtel_number || "");
        const alternateFormatted = formatPhoneNumber(
          customer.alternate_number || ""
        );

        // Format dates
        const visitDate = customer.visit_date
          ? new Date(customer.visit_date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "";

        return {
          "#": index + 1,
          "Customer Name": formatName(customer.customer_name || ""),
          "Airtel Number": airtelFormatted,
          "Alternate Number": alternateFormatted,
          Email: customer.email || "",
          Package: customer.preferred_package || "",
          "Installation Town": customer.installation_town || "",
          "Delivery Landmark": customer.delivery_landmark || "",
          "Visit Date": visitDate,
          "Visit Time": customer.visit_time || "",
        };
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 5 }, // #
        { wch: 25 }, // Customer Name
        { wch: 15 }, // Airtel Number
        { wch: 15 }, // Alternate Number
        { wch: 25 }, // Email
        { wch: 15 }, // Package
        { wch: 20 }, // Installation Town
        { wch: 25 }, // Delivery Landmark
        { wch: 15 }, // Visit Date
        { wch: 12 }, // Visit Time
      ];
      ws["!cols"] = columnWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers");

      // Generate Excel file buffer
      const excelBuffer = XLSX.write(wb, {
        type: "base64",
        bookType: "xlsx",
      });

      // Create file name with filters
      const timestamp = new Date().toISOString().split("T")[0];
      const townPart = town ? `_${town.replace(/\s+/g, "_")}` : "";
      let datePart = "";
      if (dateFilterType === "today") {
        datePart = "_Today";
      } else if (dateFilterType !== "all") {
        datePart = `_${dateFilterType}`;
      }
      const fileName = `Airtel_Customers${townPart}${datePart}_${timestamp}.xlsx`;

      // Use cache directory for temporary file
      const file = new File(Paths.cache, fileName);

      // Write file using the File API (write is synchronous, but we need to await the file creation)
      file.write(excelBuffer, { encoding: "base64" });
      const fileUri = file.uri;

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export Customers to Excel",
        });
      } else {
        Alert.alert(
          "Success",
          `Excel file saved: ${fileName}\n\nFile location: ${fileUri}`
        );
      }
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      Alert.alert(
        "Error",
        `Failed to export Excel file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Airtel Dashboard</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerDate}>{formatDate()}</Text>
          <View style={styles.exportContainer}>
            <TouchableOpacity
              onPress={handleExportToExcel}
              disabled={exporting}
              style={styles.exportIconButton}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#FFD700" />
              )}
            </TouchableOpacity>
            {showExportMenu && (
              <View style={styles.exportMenuOverlay}>
                <View style={styles.exportMenu}>
                  <TouchableOpacity
                    style={styles.exportMenuItem}
                    onPress={() => handleExportOption("full")}
                  >
                    <Text style={styles.exportMenuText}>Full Details</Text>
                  </TouchableOpacity>
                  <View style={styles.exportMenuSeparator} />
                  <TouchableOpacity
                    style={styles.exportMenuItem}
                    onPress={() => handleExportOption("airtel")}
                  >
                    <Text style={styles.exportMenuText}>SMS (Airtel)</Text>
                  </TouchableOpacity>
                  <View style={styles.exportMenuSeparator} />
                  <TouchableOpacity
                    style={styles.exportMenuItem}
                    onPress={() => handleExportOption("alternate")}
                  >
                    <Text style={styles.exportMenuText}>SMS (Alternate)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.statsRow}>
        {/* Left: Registered Today */}
        <View style={styles.statItem}>
          <View style={styles.countRow}>
            {loading ? (
              <Text style={styles.countTextToday}>-</Text>
            ) : (
              <Text style={styles.countTextToday}>
                {todayCount !== null
                  ? Math.max(0, todayCount - todayDuplicateCount)
                  : 0}
              </Text>
            )}
            {!loading && todayCount !== null && yesterdayCount !== null && (
              <View style={styles.trendContainer}>
                <Ionicons
                  name={
                    todayCount - todayDuplicateCount > yesterdayCount
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={20}
                  color={
                    todayCount - todayDuplicateCount > yesterdayCount
                      ? "#10B981"
                      : "#EF4444"
                  }
                  style={styles.trendIcon}
                />
                {yesterdayCount > 0 && (
                  <Text
                    style={[
                      styles.percentageText,
                      todayCount - todayDuplicateCount > yesterdayCount
                        ? styles.percentageTextGreen
                        : styles.percentageTextRed,
                    ]}
                  >
                    {Math.abs(
                      Math.round(
                        ((todayCount - todayDuplicateCount - yesterdayCount) /
                          yesterdayCount) *
                          100
                      )
                    )}
                    %
                  </Text>
                )}
              </View>
            )}
          </View>
          <Text style={styles.labelText}>registered today</Text>
        </View>

        {/* Separator */}
        <View style={styles.separator} />

        {/* Right: Total Registered */}
        <View style={styles.statItem}>
          {loading ? (
            <Text style={styles.countText}>-</Text>
          ) : (
            <Text style={styles.countText}>
              {totalCount !== null
                ? Math.max(0, totalCount - duplicateCount)
                : 0}
            </Text>
          )}
          <Text style={styles.labelText}>total registered</Text>
        </View>
      </View>

      {/* Customers Data Section */}
      <View style={styles.customersSection}>
        <ScrollView
          style={styles.customersList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchCounts(false);
                setRefreshing(false);
              }}
              tintColor="#FFD700"
              colors={["#FFD700"]}
            />
          }
        >
          {/* Table Rows */}
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : leads.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No customers found</Text>
            </View>
          ) : (
            (() => {
              const groupedLeads = groupLeadsByDate(leads);
              let globalIndex = 0;

              return groupedLeads.map((group) => {
                const isTodayGroup = isToday(group.date);

                return (
                  <View key={group.dateKey}>
                    {/* Date Separator - Skip for today */}
                    {!isTodayGroup && (
                      <View style={styles.dateSeparator}>
                        <Text style={styles.dateText}>
                          {formatDateWithOrdinal(group.date)}
                        </Text>
                        <Text style={styles.dateCount}>
                          {group.leads.length} registered
                        </Text>
                      </View>
                    )}

                    {/* Leads for this date */}
                    {group.leads.map((lead) => {
                      globalIndex++;
                      const isTodayLead = isToday(lead.created_at);
                      const duplicateColor = duplicateStatus[lead.id];
                      const isRed = duplicateColor === "red";
                      const isOrange = duplicateColor === "orange";

                      return (
                        <View key={lead.id} style={styles.tableRow}>
                          <Text style={styles.cellNumber}>{globalIndex}</Text>
                          <Text
                            style={[
                              styles.cellName,
                              isTodayLead &&
                                !isRed &&
                                !isOrange &&
                                styles.cellNameToday,
                              isRed && styles.cellNameRed,
                              isOrange && styles.cellNameOrange,
                            ]}
                            numberOfLines={1}
                          >
                            {formatName(lead.customer_name)}
                          </Text>
                          <View style={styles.cellNumbers}>
                            <TouchableOpacity
                              onPress={() =>
                                handleCopyNumber(
                                  lead.airtel_number,
                                  `${lead.id}-airtel`
                                )
                              }
                              onLongPress={() =>
                                handleCallNumber(lead.airtel_number)
                              }
                              delayLongPress={500}
                            >
                              <Text
                                style={styles.cellNumberText}
                                numberOfLines={1}
                              >
                                {copiedNumberId === `${lead.id}-airtel`
                                  ? "Copied"
                                  : formatPhoneNumber(lead.airtel_number)}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() =>
                                handleCopyNumber(
                                  lead.alternate_number,
                                  `${lead.id}-safaricom`
                                )
                              }
                              onLongPress={() =>
                                handleCallNumber(lead.alternate_number)
                              }
                              delayLongPress={500}
                            >
                              <Text
                                style={styles.cellNumberText}
                                numberOfLines={1}
                              >
                                {copiedNumberId === `${lead.id}-safaricom`
                                  ? "Copied"
                                  : formatPhoneNumber(lead.alternate_number)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              });
            })()
          )}
        </ScrollView>
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseModal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Filters</Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={true}
            >
              {/* Town Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Town</Text>
                <TouchableOpacity
                  style={styles.townDropdownContainer}
                  onPress={() => {
                    console.log(
                      "🏙️ Dropdown clicked, current showTownList:",
                      showTownList,
                      "availableTowns:",
                      availableTowns.length
                    );
                    setShowTownList((prev) => !prev);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.townDropdownHeader}>
                    <Text style={styles.townDropdownHeaderText}>
                      {selectedTown || "All Towns"}
                    </Text>
                    <Ionicons
                      name={showTownList ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#FFD700"
                    />
                  </View>
                </TouchableOpacity>
                {showTownList && (
                  <ScrollView
                    style={styles.townListContainer}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    <TouchableOpacity
                      style={[
                        styles.modalItem,
                        selectedTown === null && styles.modalItemActive,
                      ]}
                      onPress={() => {
                        setSelectedTown(null);
                        setShowTownList(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          selectedTown === null && styles.modalItemTextActive,
                        ]}
                      >
                        All Towns
                      </Text>
                      {selectedTown === null && (
                        <Ionicons name="checkmark" size={20} color="#FFD700" />
                      )}
                    </TouchableOpacity>
                    {availableTowns.length === 0 ? (
                      <View style={styles.modalItem}>
                        <Text style={styles.modalItemText}>
                          No towns available
                        </Text>
                      </View>
                    ) : (
                      availableTowns.map((town) => (
                        <TouchableOpacity
                          key={town}
                          style={[
                            styles.modalItem,
                            selectedTown === town && styles.modalItemActive,
                          ]}
                          onPress={() => {
                            setSelectedTown(town);
                            setShowTownList(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.modalItemText,
                              selectedTown === town &&
                                styles.modalItemTextActive,
                            ]}
                          >
                            {town}
                          </Text>
                          {selectedTown === town && (
                            <Ionicons
                              name="checkmark"
                              size={20}
                              color="#FFD700"
                            />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Date Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Date</Text>
                <View style={styles.dateButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      dateFilter === "all" && styles.dateButtonSelected,
                    ]}
                    onPress={() => {
                      setDateFilter("all");
                      setSelectedDate(null);
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        dateFilter === "all" && styles.dateButtonTextSelected,
                      ]}
                    >
                      All Time
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      dateFilter === "today" && styles.dateButtonSelected,
                    ]}
                    onPress={() => {
                      setDateFilter("today");
                      setSelectedDate(null);
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        dateFilter === "today" && styles.dateButtonTextSelected,
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      dateFilter === "custom" && styles.dateButtonSelected,
                    ]}
                    onPress={() => {
                      setDateFilter("custom");
                      setShowDatePicker(!showDatePicker);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        dateFilter === "custom" &&
                          styles.dateButtonTextSelected,
                      ]}
                    >
                      {selectedDate
                        ? formatSelectedDate(selectedDate)
                        : "Custom"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {dateFilter === "custom" && showDatePicker && (
                  <View style={styles.calendarWrapper}>
                    <Calendar
                      onDayPress={(day) => {
                        setSelectedDate(day.dateString);
                      }}
                      markedDates={{
                        [selectedDate || ""]: {
                          selected: true,
                          selectedColor: "#FFD700",
                          selectedTextColor: "#000000",
                        },
                      }}
                      theme={{
                        backgroundColor: "#0A0A0A",
                        calendarBackground: "#0A0A0A",
                        textSectionTitleColor: "#9CA3AF",
                        selectedDayBackgroundColor: "#FFD700",
                        selectedDayTextColor: "#000000",
                        todayTextColor: "#FFD700",
                        dayTextColor: "#FFFFFF",
                        textDisabledColor: "#4B5563",
                        dotColor: "#FFD700",
                        selectedDotColor: "#000000",
                        arrowColor: "#FFD700",
                        monthTextColor: "#FFFFFF",
                        indicatorColor: "#FFD700",
                        textDayFontFamily: "Inter_400Regular",
                        textMonthFontFamily: "Montserrat_600SemiBold",
                        textDayHeaderFontFamily: "Inter_600SemiBold",
                        textDayFontSize: 14,
                        textMonthFontSize: 16,
                        textDayHeaderFontSize: 12,
                      }}
                      enableSwipeMonths={true}
                    />
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowFilterModal(false);
                  setPendingExportOption(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleApplyFiltersAndExport}
              >
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A", // Dark background
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    width: "100%",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFD700", // Golden/yellow color
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerDate: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    color: "#9CA3AF",
    textTransform: "lowercase",
    flexShrink: 0,
  },
  exportContainer: {
    position: "relative",
  },
  exportIconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
  },
  exportMenuOverlay: {
    position: "absolute",
    top: 40,
    right: 0,
    zIndex: 1000,
  },
  exportMenu: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    minWidth: 160,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  exportMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  exportMenuText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  exportMenuSeparator: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginHorizontal: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
    width: "100%",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  separator: {
    width: 1,
    height: 60,
    backgroundColor: "#2A2A2A",
    marginHorizontal: 16,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  countContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  duplicateCountText: {
    position: "absolute",
    top: -8,
    right: -20,
    color: "#EF4444", // Red color for duplicate count
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  countText: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#FFD700", // Yellow/gold accent (Airtel brand color)
    letterSpacing: -0.5,
  },
  countTextToday: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#10B981", // Green color for today's count
    letterSpacing: -0.5,
  },
  trendContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: 8,
  },
  trendIcon: {
    marginTop: 4,
  },
  percentageText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  percentageTextGreen: {
    color: "#10B981",
  },
  percentageTextRed: {
    color: "#EF4444",
  },
  labelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF", // White text for dark background
    marginTop: 8,
    letterSpacing: 0.2,
  },
  customersSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 62, // Add bottom padding to avoid tab bar
  },
  customersList: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    width: "100%",
    alignItems: "center",
  },
  cellNumber: {
    width: 30,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "left",
    flexShrink: 0,
    flexGrow: 0,
  },
  cellName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFD700", // Golden color for name
    marginRight: 16,
    textAlign: "left",
    flexShrink: 1,
    minWidth: 0,
  },
  cellNameToday: {
    color: "#10B981", // Green color for today's registrations
  },
  cellNameRed: {
    color: "#EF4444", // Red color for duplicates
  },
  cellNameOrange: {
    color: "#FB923C", // Orange color for potential duplicates
  },
  dateSeparator: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#9CA3AF",
    textTransform: "lowercase",
  },
  dateCount: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    color: "#9CA3AF",
  },
  cellNumbers: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    width: 216, // 100 + 16 + 100
  },
  cellNumberText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF", // White color for numbers
    width: 100,
    textAlign: "right",
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    width: "85%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFD700",
  },
  modalBody: {
    maxHeight: 500,
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  townDropdownContainer: {
    marginBottom: 12,
  },
  townDropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  townDropdownHeaderText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  townListContainer: {
    maxHeight: 250,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  dateButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  dateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  dateButtonSelected: {
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderColor: "#FFD700",
  },
  dateButtonText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  dateButtonTextSelected: {
    color: "#FFD700",
    fontFamily: "Inter_600SemiBold",
  },
  calendarWrapper: {
    marginTop: 12,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    overflow: "hidden",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
  },
  exportButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#FFD700",
  },
  exportButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#000000",
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  modalItemActive: {
    backgroundColor: "rgba(255, 215, 0, 0.1)",
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  modalItemTextActive: {
    color: "#FFD700",
    fontFamily: "Inter_600SemiBold",
  },
  modalCloseButton: {
    padding: 4,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  dateModalContent: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  dateModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  dateModalTitle: {
    fontSize: 18,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
    flex: 1,
    textAlign: "center",
  },
  dateModalCancel: {
    padding: 4,
  },
  dateModalCancelText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  dateModalDone: {
    padding: 4,
  },
  dateModalDoneText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
  quickDateButton: {
    padding: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: "#0A0A0A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  quickDateButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#FFD700",
  },
});
